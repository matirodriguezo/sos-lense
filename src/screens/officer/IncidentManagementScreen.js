import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import {
  getIncident,
  listMessages,
  sendMessage,
  addQuickRequest,
  assignOfficer,
  startManaging,
  markMessageAsRead,
} from "../../services/incidentService";
import { getUser, getToken } from "../../services/authService";
import {
  connectSignaling,
  joinIncident,
  sendOffer,
  sendAnswer,
  sendIce,
  sendBye,
  onOffer,
  onAnswer,
  onIce,
  onBye,
  disconnect as disconnectSignaling,
} from "../../services/signalingService";
import {
  connectRealtime,
  subscribeIncident,
  on as onRealtime,
  disconnect as disconnectRealtime,
} from "../../services/realtimeService";
import MessageBubble from "../../components/MessageBubble";
import WebRTCView from "../../components/WebRTCView";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const DISPATCH_OPTIONS = [
  { id: 1, icon: "police-badge", label: "Despachar Patrulla", color: "#1976D2" },
  { id: 2, icon: "ambulance", label: "Solicitar SAMU", color: "#D32F2F" },
  { id: 3, icon: "chat-processing", label: "Chat de Texto", color: "#424242" },
];

const POLL_INTERVAL = 5000;

export default function IncidentManagementScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { incidentId, autoOpenChat } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const insets = useSafeAreaInsets();
  const [incident, setIncident] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [showChatModal, setShowChatModal] = useState(autoOpenChat || false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [userId, setUserId] = useState(null);
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);
  const markedRef = useRef(new Set());
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef(null);
  const webRef = useRef(null);

  const s = useMemo(() => makeStyles(colors), [colors]);

  const endCall = useCallback(() => {
    try {
      webRef.current?.hangUp?.();
    } catch {}
    sendBye();
    disconnectSignaling();
    navigation.reset({ index: 0, routes: [{ name: "DispatchPanel" }] });
  }, [navigation]);

  useEffect(() => {
    console.log("[IncidentMgmt] Mounted, incident:", incidentId, "autoOpenChat:", autoOpenChat);

    async function bootstrap() {
      const token = await getToken();
      const user = await getUser();
      if (user?.userId) setUserId(user.userId);
      if (token) {
        connectSignaling(token);
        joinIncident(incidentId);
        connectRealtime(token);
        subscribeIncident(incidentId);
      }
    }

    bootstrap();

    onRealtime("message:created", loadData);
    onRealtime("message:read", loadData);
    onRealtime("incident:updated", loadData);
    onRealtime("incident:status-changed", loadData);

    onOffer((sdp) => {
      console.log("[IncidentMgmt] forwarding offer to WebRTC");
      webRef.current?.forwardSignaling?.("offer", sdp);
    });
    onAnswer((sdp) => {
      console.log("[IncidentMgmt] forwarding answer to WebRTC");
      webRef.current?.forwardSignaling?.("answer", sdp);
    });
    onIce((candidate) => {
      console.log("[IncidentMgmt] forwarding ice to WebRTC");
      webRef.current?.forwardSignaling?.("ice", candidate);
    });
    onBye(() => {
      console.log("[IncidentMgmt] peer hung up");
      Alert.alert("Llamada finalizada", "El ciudadano ha cerrado la llamada.");
      endCall();
    });

    return () => {
      disconnectSignaling();
      disconnectRealtime();
      console.log("[IncidentMgmt] Unmounted");
    };
  }, [incidentId, autoOpenChat, endCall]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleWebRTCMessage = useCallback((type, data) => {
    console.log("[IncidentMgmt] WebRTC >>", type);
    switch (type) {
      case "ready":
        joinIncident(incidentId);
        setConnecting(false);
        setCallActive(true);
        break;
      case "offer":
        sendOffer(data);
        break;
      case "answer":
        sendAnswer(data);
        break;
      case "ice":
        sendIce(data);
        break;
      case "disconnected":
      case "hangup":
        endCall();
        break;
      case "error":
        console.error("[IncidentMgmt] WebRTC error:", data);
        break;
      default:
        break;
    }
  }, [incidentId, endCall]);

  const loadData = useCallback(async () => {
    try {
      const [inc, msgs, user] = await Promise.all([
        getIncident(incidentId),
        listMessages(incidentId),
        getUser(),
      ]);
      setIncident(inc);
      setMessages(msgs);
      if (user?.userId) setUserId(user.userId);

      if (inc?.officerId && inc.officerId !== user?.userId) {
        Alert.alert("Caso ya asignado", `Este caso ya fue tomado por ${inc.officerAlias || "otro oficial"}.`);
        navigation.goBack();
        return;
      }

      if (inc && !inc.officerId) {
        await assignOfficer(incidentId);
        loadData();
      }
    } catch (e) {
      console.warn("[IncidentMgmt] load error:", e.message);
    }
  }, [incidentId, navigation]);

  useEffect(() => {
    loadData();
    pollRef.current = setInterval(loadData, POLL_INTERVAL);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`);
    }, 1000);

    return () => {
      leaveChat();
      if (pollRef.current) clearInterval(pollRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadData]);

  useEffect(() => {
    if (route.params?.autoOpenChat) {
      setShowChatModal(true);
    }
  }, [route.params]);

  useEffect(() => {
    if (!showChatModal || !incident?.citizenId || !userId) return;
    const unreadMsgs = messages.filter(
      (m) => m.senderRole === "CITIZEN" && !m.readBy?.includes(userId) && !markedRef.current.has(m.id)
    );
    unreadMsgs.forEach((m) => {
      markedRef.current.add(m.id);
      markMessageAsRead(incidentId, m.id);
    });
  }, [showChatModal, messages, incident?.citizenId, userId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text);
      console.log("[IncidentMgmt] Message sent (OFFICER):", text.slice(0, 40));
      loadData();
    } catch (e) { console.warn("[IncidentMgmt] Send error:", e); }
  };

  const handleDispatchAction = (label) => {
    setShowDispatchModal(false);
    if (label === "Chat de Texto") {
      setShowChatModal(true);
      return;
    }
    Alert.alert("Despacho", `¿Confirmas el despacho de: ${label}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: async () => {
        try {
          await addQuickRequest(incidentId, label);
          await sendMessage(incidentId, `[SISTEMA] Central ha despachado: ${label}`);
          console.log("[IncidentMgmt] Dispatched:", label);
          Alert.alert("Despachado", "La unidad ha sido notificada.");
          loadData();
        } catch (e) { console.warn("[IncidentMgmt] Dispatch error:", e); }
      }},
    ]);
  };

  const handleFinalize = () => {
    Alert.alert("Finalizar procedimiento", "¿Estás seguro de que deseas cerrar este caso?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Continuar", onPress: () => {
        console.log("[IncidentMgmt] Navigating to CloseIncident");
        navigation.replace("CloseIncident", { incidentId });
      }},
    ]);
  };

  const handleBack = () => {
    Alert.alert("Salir", "¿Estás seguro de salir de este procedimiento?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => {
        console.log("[IncidentMgmt] Officer exited");
        endCall();
      }},
    ]);
  };

  const handleStart = async () => {
    try {
      await startManaging(incidentId);
      loadData();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const isMine = (msg) => msg.senderId === userId;

  const openMaps = () => {
    if (!incident?.latitude || !incident?.longitude) {
      Alert.alert("Ubicación no disponible", "No se ha registrado la ubicación del ciudadano.");
      return;
    }
    Alert.alert("Abrir mapa", "¿Deseas abrir la ubicación en tu aplicación de mapas?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Abrir", onPress: () => {
        const url = Platform.OS === "ios"
          ? `maps://app?daddr=${incident.latitude},${incident.longitude}`
          : `geo:${incident.latitude},${incident.longitude}?q=${incident.latitude},${incident.longitude}`;
        Linking.openURL(url).catch(() => {
          Linking.openURL(`https://maps.google.com/maps?daddr=${incident.latitude},${incident.longitude}`);
        });
      }},
    ]);
  };

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: "#000" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={{ flex: 1, position: "relative" }}>
        <WebRTCView
          ref={webRef}
          style={StyleSheet.absoluteFill}
          onWebRTCMessage={handleWebRTCMessage}
        />

        {connecting && (
          <View style={s.centerOverlay}>
            <Animated.View style={[s.pulseCircle, { opacity: pulseOpacity }]}>
              <MaterialCommunityIcons name="cellphone-link" size={64} color="#4ADE80" />
            </Animated.View>
            <Text style={s.connectingText}>Conectando...</Text>
            <Text style={s.connectingSub}>Estableciendo enlace con ciudadano</Text>
            <ActivityIndicator size="small" color="#4ADE80" style={{ marginTop: 20 }} />
          </View>
        )}

        <View style={[s.header, { top: insets.top }]}>
          <TouchableOpacity style={s.backBtn} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.white} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerSub, { color: colors.whiteTranslucent }]}>Procedimiento</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[s.headerTitle, { color: colors.white }]}>#{incidentId?.slice(0, 8)?.toUpperCase()}</Text>
              <Text style={[s.elapsedText, { color: colors.whiteTranslucent }]}>{elapsed}</Text>
            </View>
          </View>
          <View style={[s.statusBadge, { backgroundColor: colors.badgeRed }]}>
            <Text style={[s.statusBadgeText, { color: colors.white }]}>● EN CURSO</Text>
          </View>
        </View>

        {callActive && (
          <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: colors.blueDispatch }]} onPress={() => setShowDispatchModal(true)}>
              <MaterialCommunityIcons name="radio-handheld" size={22} color={colors.white} />
              <Text style={s.ctrlLabel}>Despacho</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: "#16A34A" }]} onPress={openMaps}>
              <Ionicons name="location-outline" size={22} color={colors.white} />
              <Text style={s.ctrlLabel}>Ubicación</Text>
            </TouchableOpacity>
            {incident?.status === "ACTIVO" && (
              <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: "#2563EB" }]} onPress={handleStart}>
                <Ionicons name="play" size={22} color={colors.white} />
                <Text style={s.ctrlLabel}>Iniciar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.ctrlBtnLarge, { backgroundColor: colors.badgeRed }]} onPress={handleFinalize}>
              <Text style={s.finalizeLabel}>Finalizar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]} onPress={() => setShowChatModal(true)}>
              <Ionicons name="chatbubble-ellipses" size={22} color={colors.white} />
              <Text style={s.ctrlLabel}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showDispatchModal} transparent animationType="slide">
        <TouchableOpacity style={[s.modalOverlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setShowDispatchModal(false)}>
          <View style={[s.dispatchSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <Text style={[s.dispatchSheetTitle, { color: colors.textPrimary }]}>Opciones de Despacho</Text>
            {incident?.address && (
              <TouchableOpacity style={[s.addressCard, { backgroundColor: colors.inputBg }]} onPress={openMaps}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={[s.addressText, { color: colors.textPrimary }]} numberOfLines={2}>{incident.address}</Text>
              </TouchableOpacity>
            )}
            <View style={s.dispatchGrid}>
              {DISPATCH_OPTIONS.map((item) => (
                <TouchableOpacity key={item.id} style={[s.dispatchBox, { backgroundColor: item.color }]} onPress={() => handleDispatchAction(item.label)}>
                  <MaterialCommunityIcons name={item.icon} size={32} color={colors.white} style={{ marginBottom: 8 }} />
                  <Text style={s.dispatchBoxText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView style={[s.modalOverlay, { backgroundColor: colors.overlay }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.chatSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <View style={s.chatSheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[s.chatSheetTitle, { color: colors.textPrimary }]}>Chat de Emergencia</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={[s.chatSheetSub, { color: colors.textSecondary }]}>Canal de respaldo — texto alternativo a LENSE</Text>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={s.chatList}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS === "android"}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={<Text style={[s.emptyChat, { color: colors.textSecondary }]}>Sin mensajes.</Text>}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMine={isMine(item)}
                  otherRole="CITIZEN"
                  otherUserId={incident?.citizenId}
                  currentUserId={userId}
                  citizenAlias={incident?.citizenAlias}
                  officerAlias={incident?.officerAlias}
                />
              )}
            />
            <View style={s.inputRow}>
              <TextInput
                style={[s.chatInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
                value={input}
                onChangeText={setInput}
                placeholder="Escriba un mensaje..."
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity style={[s.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend}>
                <Ionicons name="send" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    centerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", zIndex: 5 },
    pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(74,222,128,0.1)", justifyContent: "center", alignItems: "center" },
    connectingText: { color: "#4ADE80", marginTop: 24, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
    connectingSub: { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13 },

    header: {
      position: "absolute", left: 0, right: 0, zIndex: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 12, paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)" },
    headerCenter: { alignItems: "center" },
    headerSub: { fontSize: 11, fontWeight: "bold" },
    headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 1 },
    elapsedText: { fontSize: 11, fontWeight: "600" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
    statusBadgeText: { fontSize: 9, fontWeight: "bold", letterSpacing: 0.5 },

    bottomBar: {
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
      flexDirection: "row", justifyContent: "center", gap: 14,
      paddingTop: 10, paddingHorizontal: 16,
    },
    ctrlBtn: {
      width: 80, height: 64, borderRadius: 32,
      justifyContent: "center", alignItems: "center",
    },
    ctrlBtnLarge: {
      width: 110, height: 64, borderRadius: 32,
      justifyContent: "center", alignItems: "center",
    },
    ctrlLabel: { color: colors.white, fontSize: 10, fontWeight: "bold", marginTop: 2 },
    finalizeLabel: { color: colors.white, fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },

    dispatchSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    dispatchSheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
    addressCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
    addressText: { fontSize: 13, fontWeight: "500", flex: 1 },
    dispatchGrid: { flexDirection: "row", gap: 12 },
    dispatchBox: { flex: 1, borderRadius: 14, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
    dispatchBoxText: { color: colors.white, fontSize: 12, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },

    chatSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: "60%" },
    chatSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    chatSheetTitle: { fontSize: 18, fontWeight: "bold" },
    chatSheetSub: { fontSize: 12, marginBottom: 16 },
    chatList: { flex: 1 },
    emptyChat: { textAlign: "center", marginTop: 20 },
    inputRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    chatInput: { flex: 1, borderRadius: 8, paddingHorizontal: 16, height: 48, borderWidth: 1, textAlignVertical: "center" },
    sendBtn: { width: 48, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  });
