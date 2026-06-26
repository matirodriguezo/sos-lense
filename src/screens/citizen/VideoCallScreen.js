import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import {
  addQuickRequest,
  sendMessage,
  listenMessages,
  listenIncidentById,
  cancelIncident,
  markMessageAsRead,
} from "../../services/incidentService";
import MessageBubble from "../../components/MessageBubble";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const QUICK_OPTIONS = [
  { icon: "medical-outline", label: "Necesito Ambulancia" },
  { icon: "shield-outline", label: "Robo en progreso" },
  { icon: "hand-left-outline", label: "Necesito intérprete" },
  { icon: "car-outline", label: "Accidente de tránsito" },
  { icon: "walk-outline", label: "El sospechoso huyó" },
  { icon: "checkmark-circle-outline", label: "Estoy bien" },
];

export default function VideoCallScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { incidentId, autoOpenChat } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showChatModal, setShowChatModal] = useState(autoOpenChat || false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [incident, setIncident] = useState(null);
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid;
  const markedRef = useRef(new Set());
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const chatListRef = useRef(null);

  const s = useMemo(() => makeStyles(colors), [colors]);

  // Simulated connecting sequence
  useEffect(() => {
    console.log("[VideoCall] Mounted, incident:", incidentId, "autoOpenChat:", autoOpenChat);
    const timer = setTimeout(() => {
      setConnecting(false);
      setCallActive(true);
      console.log("[VideoCall] Connection established");
    }, 3000);
    return () => {
      clearTimeout(timer);
      console.log("[VideoCall] Unmounted");
    };
  }, []);

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

  useEffect(() => {
    const unsubMsg = listenMessages(incidentId, setMessages);
    const unsubInc = listenIncidentById(incidentId, setIncident);
    return () => { unsubMsg(); unsubInc(); };
  }, [incidentId]);

  useEffect(() => {
    if (showChatModal) enterChat(incidentId);
    else leaveChat();
    return () => { if (showChatModal) leaveChat(); };
  }, [showChatModal, incidentId]);

  useEffect(() => {
    if (route.params?.autoOpenChat) setShowChatModal(true);
  }, [route.params]);

  useEffect(() => {
    if (incident?.status === "CERRADO" || incident?.status === "ANULADO") {
      const msg = incident.status === "CERRADO"
        ? "El carabinero ha cerrado este incidente."
        : "Has cancelado este incidente.";
      Alert.alert("Incidente " + (incident.status === "CERRADO" ? "Cerrado" : "Anulado"), msg, [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    }
  }, [incident?.status]);

  useEffect(() => {
    if (!showChatModal || !incident?.officerId) return;
    const unreadMsgs = messages.filter(
      (m) => m.senderRole === "OFFICER" && !m.readBy?.includes(uid) && !markedRef.current.has(m.id)
    );
    unreadMsgs.forEach((m) => {
      markedRef.current.add(m.id);
      markMessageAsRead(incidentId, m.id, uid);
    });
  }, [messages, showChatModal, incident?.officerId]);

  const handleQuickRequest = async (request) => {
    Alert.alert("Enviar alerta rápida", `¿Confirmas el envío de: "${request}"?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Enviar", onPress: async () => {
        try {
          await addQuickRequest(incidentId, request);
          await sendMessage(incidentId, `[ALERTA RÁPIDA] ${request}`, uid, "CITIZEN");
        } catch {}
      }},
    ]);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, uid, "CITIZEN");
      console.log("[VideoCall] Message sent (CITIZEN):", text.slice(0, 40));
    } catch (e) { console.warn("[VideoCall] Send error:", e); }
  };

  const handleCloseWithReason = async () => {
    if (!closeReason.trim()) {
      Alert.alert("Motivo requerido", "Por favor indica el motivo del cierre.");
      return;
    }
    Alert.alert("Confirmar cierre", `¿Estás seguro de cerrar el incidente?\n\nMotivo: ${closeReason.trim()}`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Sí, cerrar", style: "destructive", onPress: async () => {
        try {
          await cancelIncident(incidentId, closeReason.trim());
          await sendMessage(incidentId, `[CERRADO] Incidente cerrado: ${closeReason.trim()}`, uid, "CITIZEN");
          setShowCloseModal(false);
          console.log("[VideoCall] Incident closed by citizen");
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        } catch (e) {
          console.warn("[VideoCall] Close error:", e);
          Alert.alert("Error", "No se pudo cerrar el incidente.");
        }
      }},
    ]);
  };

  const handleHangup = () => {
    Alert.alert("Finalizar llamada", "¿Estás seguro de que deseas colgar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Colgar", style: "destructive",
        onPress: () => {
          console.log("[VideoCall] Citizen hung up");
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        },
      },
    ]);
  };

  const isMine = (msg) => msg.senderId === uid;

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: "#000" }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={{ flex: 1, position: "relative" }}>
        {/* Connecting overlay */}
        {connecting ? (
          <View style={s.center}>
            <Animated.View style={[s.pulseCircle, { opacity: pulseOpacity }]}>
              <MaterialCommunityIcons name="cellphone-link" size={64} color="#4ADE80" />
            </Animated.View>
            <Text style={s.connectingText}>Conectando...</Text>
            <Text style={s.connectingSub}>Estableciendo enlace con CENCO</Text>
            <ActivityIndicator size="small" color="#4ADE80" style={{ marginTop: 20 }} />
          </View>
        ) : (
          <View style={s.center}>
            <MaterialCommunityIcons name="video" size={80} color="#4ADE80" />
            <Text style={s.connectedText}>LLAMADA ACTIVA</Text>
            <Text style={s.connectedSub}>Conexión establecida con CENCO</Text>
          </View>
        )}

        <View style={[s.topBar, { top: insets.top }]}>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LLAMADA</Text>
          </View>
          {callActive && <View style={[s.liveBadge, { backgroundColor: "#16A34A" }]}><Text style={s.liveText}>CONECTADO</Text></View>}
        </View>

        {callActive && (
          <View style={[s.bottomArea, { paddingBottom: insets.bottom + 8 }]}>
            <FlatList
              data={QUICK_OPTIONS}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.quickList}
              keyExtractor={(item) => item.label}
              initialNumToRender={6}
              maxToRenderPerBatch={6}
              windowSize={3}
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.quickPill} onPress={() => handleQuickRequest(item.label)} activeOpacity={0.7}>
                  <Ionicons name={item.icon} size={14} color="#fff" style={{ marginRight: 5 }} />
                  <Text style={s.pillLabel}>{item.label}</Text>
                </TouchableOpacity>
              )}
            />
            <View style={s.actionsRow}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "rgba(255,255,255,0.2)" }]} onPress={() => setShowChatModal(true)}>
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={s.actionLabel}>Chat</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.hangupBtn]} onPress={handleHangup}>
                <Ionicons name="call" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: "#DC2626" }]} onPress={() => setShowCloseModal(true)}>
                <Ionicons name="close" size={20} color="#fff" />
                <Text style={s.actionLabel}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.7)" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.chatSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <View style={s.chatSheetHeader}>
              <Text style={[s.chatSheetTitle, { color: colors.textPrimary }]}>Chat de Emergencia</Text>
              <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
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
              ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 20, color: colors.textSecondary }}>Sin mensajes.</Text>}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isMine={isMine(item)}
                  otherRole="OFFICER"
                  otherUserId={incident?.officerId}
                  currentUserId={uid}
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
                placeholder="Escribe un mensaje..."
                placeholderTextColor={colors.textSecondary}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity style={[s.sendBtn, { backgroundColor: colors.primary }]} onPress={handleSend}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCloseModal} transparent animationType="fade">
        <View style={[s.modalOverlay, { backgroundColor: "rgba(0,0,0,0.7)" }]}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Finalizar Incidente</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="Motivo del cierre..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <View style={s.modalButtons}>
              <TouchableOpacity style={[s.modalCancelBtn, { borderColor: colors.border }]} onPress={() => { setShowCloseModal(false); setCloseReason(""); }}>
                <Text style={[s.modalCancelText, { color: colors.textSecondary }]}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, { backgroundColor: "#DC2626" }]} onPress={handleCloseWithReason}>
                <Text style={[s.modalConfirmText, { color: "#fff" }]}>Confirmar Cierre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
    centerText: { color: "#999", marginTop: 16, fontSize: 14, fontWeight: "600" },
    pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(74,222,128,0.1)", justifyContent: "center", alignItems: "center" },
    connectingText: { color: "#4ADE80", marginTop: 24, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
    connectingSub: { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13 },
    connectedText: { color: "#4ADE80", marginTop: 24, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
    connectedSub: { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13 },

    topBar: {
      position: "absolute", left: 0, right: 0, zIndex: 10,
      flexDirection: "row", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 8,
    },
    liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, gap: 5, backgroundColor: "#DC2626" },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
    liveText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 1 },

    bottomArea: {
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
      paddingTop: 8, gap: 8,
    },
    quickList: { paddingHorizontal: 12, gap: 8 },
    quickPill: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
      backgroundColor: "rgba(0,0,0,0.5)",
      borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
    },
    pillLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
    actionsRow: {
      flexDirection: "row", justifyContent: "center", gap: 16,
      paddingHorizontal: 16,
    },
    actionBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 20, paddingVertical: 10, borderRadius: 24,
    },
    actionLabel: { color: "#fff", fontSize: 13, fontWeight: "bold" },
    hangupBtn: {
      width: 56, height: 56, borderRadius: 28, backgroundColor: "#DC2626",
      justifyContent: "center", alignItems: "center",
    },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },
    chatSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: "60%" },
    chatSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    chatSheetTitle: { fontSize: 18, fontWeight: "bold" },
    chatList: { flex: 1 },
    inputRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    chatInput: { flex: 1, borderRadius: 8, paddingHorizontal: 16, height: 48, borderWidth: 1, textAlignVertical: "center" },
    sendBtn: { width: 48, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },

    modalContent: { borderRadius: 16, padding: 24, width: "100%" },
    modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
    modalInput: { borderRadius: 8, padding: 16, fontSize: 14, borderWidth: 1, minHeight: 100 },
    modalButtons: { flexDirection: "row", gap: 12, marginTop: 24 },
    modalCancelBtn: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1 },
    modalCancelText: { fontWeight: "bold" },
    modalConfirmBtn: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    modalConfirmText: { fontWeight: "bold" },
  });
