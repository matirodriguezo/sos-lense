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
  PermissionsAndroid,
  ActivityIndicator,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import {
  addQuickRequest,
  sendMessage,
  listenMessages,
  listenIncidentById,
  cancelIncident,
} from "../../services/incidentService";
import { sendOffer, sendAnswer, sendIceCandidate, listenSignaling, clearSignaling } from "../../services/signalingService";
import WebRTCView from "../../components/WebRTCView";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

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
  const [permsOk, setPermsOk] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [webviewKey, setWebviewKey] = useState(0);
  const [callActive, setCallActive] = useState(false);
  const flatListRef = useRef(null);
  const webrtcRef = useRef(null);
  const insets = useSafeAreaInsets();
  const uid = auth.currentUser?.uid;

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS === "android") {
          const g = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
          const ok =
            g[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
            g[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
          if (!ok) return setPermsOk(false);
        }
        setPermsOk(true);
      } catch {}
    })();
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

  const remoteUidRef = useRef(null);

  const handleWebRTCMessage = useCallback((type, data) => {
    switch (type) {
      case "ready":
        setVideoReady(true);
        webrtcRef.current?.forwardSignaling("makeOffer", null);
        break;
      case "offer":
        sendOffer(incidentId, uid, data).catch(() => {});
        break;
      case "answer":
        sendAnswer(incidentId, uid, data).catch(() => {});
        break;
      case "ice":
        sendIceCandidate(incidentId, uid, data).catch(() => {});
        break;
      case "remote_on":
        setCallActive(true);
        break;
      case "disconnected":
        setCallActive(false);
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
      case "hangup":
        setCallActive(false);
        break;
      default:
        console.log("[WebRTC unknown msg]", type, data);
        break;
    }
  }, [incidentId, uid]);

  const handleRetry = useCallback(() => {
    setVideoError(false);
    setVideoReady(false);
    setWebviewKey((k) => k + 1);
  }, []);

  useEffect(() => {
    return () => { clearSignaling(incidentId, uid); };
  }, [incidentId, uid]);

  useEffect(() => {
    if (!videoReady || !remoteUidRef.current) return;
    const unsub = listenSignaling(incidentId, remoteUidRef.current, {
      onAnswer(sdp) { webrtcRef.current?.forwardSignaling("answer", sdp); },
      onIce(candidate) { webrtcRef.current?.forwardSignaling("ice", candidate); },
    });
    return () => unsub;
  }, [videoReady, incidentId]);

  useEffect(() => {
    if (!incident?.officerId) return;
    remoteUidRef.current = incident.officerId;
  }, [incident?.officerId]);

  const handleQuickRequest = async (request) => {
    try {
      await addQuickRequest(incidentId, request);
      await sendMessage(incidentId, `[ALERTA RÁPIDA] ${request}`, uid, "CITIZEN");
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, uid, "CITIZEN");
    } catch {}
  };

  const handleCloseWithReason = async () => {
    if (!closeReason.trim()) {
      Alert.alert("Motivo requerido", "Por favor indica el motivo del cierre.");
      return;
    }
    try {
      await cancelIncident(incidentId, closeReason.trim());
      await sendMessage(incidentId, `[CERRADO] Incidente cerrado: ${closeReason.trim()}`, uid, "CITIZEN");
      webrtcRef.current?.hangUp();
      await clearSignaling(incidentId, uid);
      setShowCloseModal(false);
      Alert.alert("Cerrado", "Serás redirigido al inicio.", [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo cerrar el incidente.");
    }
  };

  const handleHangup = () => {
    Alert.alert("Finalizar llamada", "¿Estás seguro de que deseas colgar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Colgar", style: "destructive",
        onPress: () => {
          webrtcRef.current?.hangUp();
          clearSignaling(incidentId, uid);
          navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        },
      },
    ]);
  };

  const isMine = (msg) => msg.senderId === uid;

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: "#000" }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={{ flex: 1, position: "relative" }}>
        {!permsOk ? (
          <View style={s.center}>
            <Ionicons name="camera-outline" size={64} color="#666" />
            <Text style={s.centerText}>Permisos de cámara denegados</Text>
          </View>
        ) : videoError ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={64} color="#FB923C" />
            <Text style={s.centerText}>Error de cámara</Text>
            {errorMsg ? <Text style={s.errorSubText}>{errorMsg}</Text> : null}
            <TouchableOpacity style={[s.retryBtn, { backgroundColor: "#4ADE80" }]} onPress={handleRetry}>
              <Text style={{ color: "#000", fontWeight: "bold" }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebRTCView key={webviewKey} ref={webrtcRef} style={{ flex: 1 }} onWebRTCMessage={handleWebRTCMessage} />
        )}

        <View style={[s.topBar, { top: insets.top }]}>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LLAMADA</Text>
          </View>
          {callActive && <View style={[s.liveBadge, { backgroundColor: "#16A34A" }]}><Text style={s.liveText}>CONECTADO</Text></View>}
        </View>

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
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 20, color: colors.textSecondary }}>Sin mensajes.</Text>}
              renderItem={({ item }) => (
                <View style={[s.chatBubble, isMine(item) ? [s.chatBubbleMine, { backgroundColor: colors.primary }] : [s.chatBubbleOther, { backgroundColor: colors.border }]]}>
                  <Text style={[s.chatMeta, isMine(item) ? { color: colors.whiteTranslucent, textAlign: "right" } : { color: colors.textSecondary }]}>
                    {isMine(item) ? "Tú" : (incident?.officerAlias || "Oficial")}
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
    errorSubText: { color: "#666", marginTop: 8, fontSize: 12, textAlign: "center", paddingHorizontal: 24 },
    retryBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },

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
    chatBubble: { maxWidth: "85%", padding: 12, borderRadius: 12, marginBottom: 12 },
    chatBubbleMine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
    chatBubbleOther: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
    chatMeta: { fontSize: 10, marginBottom: 4, fontWeight: "bold" },
    chatText: { fontSize: 14, lineHeight: 20 },
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
