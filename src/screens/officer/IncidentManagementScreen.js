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
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import {
  listenIncidentById,
  listenMessages,
  sendMessage,
  addQuickRequest,
  assignOfficer,
  sendSystemMessage,
} from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import {
  sendAnswer,
  sendIceCandidate,
  listenSignaling,
  clearSignaling,
} from "../../services/signalingService";
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
  const [permsGranted, setPermsGranted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [webviewKey, setWebviewKey] = useState(0);
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);
  const webrtcRef = useRef(null);
  const remoteUidRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "android") {
          const grants = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          const ok =
            grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
            grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
          if (!ok) {
            Alert.alert("Permiso denegado", "Cámara y micrófono son necesarios para la videollamada.");
          }
        }
        setPermsGranted(true);
      } catch {}
      setLoadingPerms(false);
    })();
  }, []);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    enterChat(incidentId);
    const unsubIncident = listenIncidentById(incidentId, (data) => {
      setIncident(data);
      if (data.officerId && data.officerId !== auth.currentUser.uid) {
        Alert.alert("Caso ya asignado", `Este caso ya fue tomado por ${data.officerAlias || "otro oficial"}.`);
        navigation.goBack();
        return;
      }
      if (data.userId) remoteUidRef.current = data.userId;
      if (!data.officerId) {
        const officerAlias = getCurrentAlias();
        assignOfficer(incidentId, auth.currentUser.uid, officerAlias);
        sendSystemMessage(incidentId, `${officerAlias || "Un oficial"} ha tomado tu caso.`);
      }
    });
    const unsubMessages = listenMessages(incidentId, setMessages);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`);
    }, 1000);

    return () => { leaveChat(); unsubIncident(); unsubMessages(); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [incidentId]);

  useEffect(() => {
    if (route.params?.autoOpenChat) {
      setShowChatModal(true);
    }
  }, [route.params]);

  const handleWebRTCMessage = useCallback((type, data) => {
    switch (type) {
      case "ready":
        setVideoReady(true);
        break;
      case "answer":
        sendAnswer(incidentId, auth.currentUser.uid, data).catch(() => {});
        break;
      case "ice":
        sendIceCandidate(incidentId, auth.currentUser.uid, data).catch(() => {});
        break;
      case "remote_on":
        setElapsed("00:00");
        break;
      case "disconnected":
        break;
      case "log":
        console.log("[WebRTC]", data);
        break;
      case "debug":
        console.log("[WebRTC Debug]", data);
        break;
      case "error":
        setVideoError(true);
        setErrorMsg(data || "");
        break;
      default:
        console.log("[WebRTC unknown msg]", type, data);
        break;
    }
    }, [incidentId]);

  useEffect(() => {
    return () => { clearSignaling(incidentId, auth.currentUser?.uid); };
  }, [incidentId]);

  useEffect(() => {
    if (!videoReady || !remoteUidRef.current) return;
    const unsub = listenSignaling(incidentId, remoteUidRef.current, {
      onOffer(sdp) { webrtcRef.current?.forwardSignaling("offer", sdp); },
      onIce(candidate) { webrtcRef.current?.forwardSignaling("ice", candidate); },
    });
    return () => unsub;
  }, [videoReady, incidentId]);

  const handleRetry = useCallback(() => {
    setVideoError(false);
    setVideoReady(false);
    setWebviewKey((k) => k + 1);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, auth.currentUser.uid, "OFFICER");
    } catch {}
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
          await sendMessage(incidentId, `[SISTEMA] Central ha despachado: ${label}`, auth.currentUser.uid, "OFFICER");
          Alert.alert("Despachado", "La unidad ha sido notificada.");
        } catch {}
      }},
    ]);
  };

  const handleFinalize = () => {
    navigation.replace("CloseIncident", { incidentId });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  const openMaps = () => {
    if (!incident?.latitude || !incident?.longitude) {
      Alert.alert("Ubicación no disponible", "No se ha registrado la ubicación del ciudadano.");
      return;
    }
    const url = Platform.OS === "ios"
      ? `maps://app?daddr=${incident.latitude},${incident.longitude}`
      : `geo:${incident.latitude},${incident.longitude}?q=${incident.latitude},${incident.longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${incident.latitude},${incident.longitude}`);
    });
  };

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.videoCallBg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.videoCallBg} />

      <View style={{ flex: 1, position: "relative" }}>
        {loadingPerms ? (
          <View style={s.permLoading}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={{ color: colors.whiteTranslucent, marginTop: 16 }}>Iniciando videollamada...</Text>
          </View>
        ) : !permsGranted ? (
          <View style={s.permLoading}>
            <Ionicons name="camera-outline" size={64} color={colors.whiteTranslucent} />
            <Text style={{ color: colors.white, marginTop: 16, fontWeight: "bold", textAlign: "center", paddingHorizontal: 40 }}>
              Permisos de cámara y micrófono denegados
            </Text>
          </View>
        ) : videoError ? (
          <View style={s.permLoading}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.warning} />
            <Text style={{ color: colors.white, marginTop: 16, fontWeight: "bold", textAlign: "center", paddingHorizontal: 40 }}>
              Error de cámara
            </Text>
            {errorMsg ? <Text style={{ color: colors.whiteTranslucent, marginTop: 8, fontSize: 12, textAlign: "center", paddingHorizontal: 24 }}>{errorMsg}</Text> : null}

            <TouchableOpacity style={[s.retryBtn, { backgroundColor: colors.primary }]} onPress={handleRetry}>
              <Text style={{ color: colors.white, fontWeight: "bold" }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebRTCView key={webviewKey} ref={webrtcRef} style={{ flex: 1 }} onWebRTCMessage={handleWebRTCMessage} />
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

        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: colors.blueDispatch }]} onPress={() => setShowDispatchModal(true)}>
            <MaterialCommunityIcons name="radio-handheld" size={22} color={colors.white} />
            <Text style={s.ctrlLabel}>Despacho</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ctrlBtnLarge, { backgroundColor: colors.badgeRed }]} onPress={handleFinalize}>
            <Text style={s.finalizeLabel}>Finalizar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]} onPress={() => setShowChatModal(true)}>
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.white} />
            <Text style={s.ctrlLabel}>Chat</Text>
          </TouchableOpacity>
        </View>
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
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              windowSize={5}
              maxToRenderPerBatch={10}
              ListEmptyComponent={<Text style={[s.emptyChat, { color: colors.textSecondary }]}>Sin mensajes.</Text>}
              renderItem={({ item }) => (
                <View style={[s.chatBubble, isMine(item) ? [s.chatBubbleMine, { backgroundColor: colors.primary }] : [s.chatBubbleOther, { backgroundColor: colors.border }]]}>
                  <Text style={[s.chatMeta, isMine(item) ? { color: colors.whiteTranslucent, textAlign: "right" } : { color: colors.textSecondary }]}>
                    {isMine(item) ? "Tú" : (incident?.citizenAlias || "Ciudadano")}
                  </Text>
                  <Text style={[s.chatText, isMine(item) ? { color: colors.white } : { color: colors.textPrimary }]}>{item.text}</Text>
                </View>
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

    header: {
      position: "absolute", left: 0, right: 0, zIndex: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 12, paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)" },
    permLoading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.videoCallBg },
    retryBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
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
    chatBubble: { maxWidth: "85%", padding: 12, borderRadius: 12, marginBottom: 12 },
    chatBubbleMine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
    chatBubbleOther: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
    chatMeta: { fontSize: 10, marginBottom: 4, fontWeight: "bold" },
    chatText: { fontSize: 14, lineHeight: 20 },
    inputRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    chatInput: { flex: 1, borderRadius: 8, paddingHorizontal: 16, height: 48, borderWidth: 1, textAlignVertical: "center" },
    sendBtn: { width: 48, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  });
