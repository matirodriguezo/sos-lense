import { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  StatusBar,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import {
  addQuickRequest,
  sendMessage,
  listenMessages,
  listenIncidentById,
  cancelIncident,
} from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const QUICK_OPTIONS = [
  { icon: "medical-outline", label: "Necesito Ambulancia", gifPath: null },
  { icon: "shield-outline", label: "Robo en progreso", gifPath: null },
  { icon: "hand-left-outline", label: "Necesito intérprete", gifPath: null },
  { icon: "car-outline", label: "Accidente de tránsito", gifPath: null },
  { icon: "walk-outline", label: "El sospechoso huyó", gifPath: null },
  { icon: "checkmark-circle-outline", label: "Estoy bien", gifPath: null },
];

export default function VideoCallScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { incidentId, autoOpenChat } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showChatModal, setShowChatModal] = useState(autoOpenChat || false);
  const [isMuted, setIsMuted] = useState(false);
  const [camFlipped, setCamFlipped] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [incident, setIncident] = useState(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const unsubMsg = listenMessages(incidentId, setMessages);
    const unsubInc = listenIncidentById(incidentId, setIncident);
    return () => {
      unsubMsg();
      unsubInc();
    };
  }, [incidentId]);

  useEffect(() => {
    if (showChatModal) {
      enterChat(incidentId);
    } else {
      leaveChat();
    }
    return () => {
      if (showChatModal) {
        leaveChat();
      }
    };
  }, [showChatModal, incidentId]);

  useEffect(() => {
    if (route.params?.autoOpenChat) {
      setShowChatModal(true);
    }
  }, [route.params]);

  useEffect(() => {
    if (incident?.status === "CERRADO") {
      Alert.alert("Incidente Cerrado", "El carabinero ha cerrado este incidente. Serás redirigido al inicio.", [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    }
    if (incident?.status === "ANULADO") {
      Alert.alert("Incidente Anulado", "Has cancelado este incidente. Serás redirigido al inicio.", [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    }
  }, [incident?.status]);

  const handleQuickRequest = async (request) => {
    try {
      await addQuickRequest(incidentId, request);
      await sendMessage(incidentId, `[ALERTA RÁPIDA] ${request}`, auth.currentUser.uid, "CITIZEN");
    } catch {}
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, auth.currentUser.uid, "CITIZEN");
    } catch {}
  };

  const handleHangup = () => {
    Alert.alert("Finalizar llamada", "¿Estás seguro de que deseas colgar?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Colgar", style: "destructive",
        onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }),
      },
    ]);
  };

  const handleCloseWithReason = async () => {
    if (!closeReason.trim()) {
      Alert.alert("Motivo requerido", "Por favor indica el motivo del cierre.");
      return;
    }
    try {
      await cancelIncident(incidentId, closeReason.trim());
      await sendMessage(incidentId, `[CERRADO] Incidente cerrado: ${closeReason.trim()}`, auth.currentUser.uid, "CITIZEN");
      setShowCloseModal(false);
      Alert.alert("Cerrado", "Serás redirigido al inicio.", [
        { text: "OK", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }) },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo cerrar el incidente.");
    }
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.videoBg }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor={colors.videoBg} />

      <View style={[s.videoContainer, { backgroundColor: colors.videoBg }]}>
        <View style={[s.floatingHeader, { top: 12 + insets.top }]}>
          <View style={[s.liveBadge, { backgroundColor: colors.badgeRed }]}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>EN VIVO</Text>
          </View>
          <Text style={s.headerTitle}>S.O.S. CARABINEROS</Text>
          <TouchableOpacity style={[s.senaBtn, { backgroundColor: colors.quickReplyBg }]} onPress={() => Alert.alert("LENSE", "Traductor en progreso")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="hand-right" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>

        <View style={s.mainVideo}>
          <Ionicons name={camFlipped ? "camera-reverse-outline" : "camera-outline"} size={64} color={colors.whiteTranslucent} />
          <Text style={s.cameraLabel}>{camFlipped ? "CÁMARA TRASERA" : "CÁMARA FRONTAL"}</Text>
        </View>

        <View style={[s.pipContainer, { top: 60 + insets.top }]}>
          <View style={[s.pipVideo, { backgroundColor: colors.videoBg, borderColor: colors.primary }]}>
            <MaterialCommunityIcons name="police-badge-outline" size={32} color={colors.white} style={{opacity: 0.5}} />
            <View style={s.pipBadge}>
              <View style={s.pipBadgeDot} />
              <Text style={s.pipBadgeText}>OFICIAL</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[s.quickSection, { backgroundColor: colors.videoBg }]}>
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
            <TouchableOpacity style={[s.quickPill, { backgroundColor: colors.quickReplyBg, borderColor: colors.whiteTranslucent }]} onPress={() => handleQuickRequest(item.label)} activeOpacity={0.7}>
              {item.gifPath ? (
                <Image source={item.gifPath} style={s.pillGif} resizeMode="contain" />
              ) : (
                <Ionicons name={item.icon} size={16} color={colors.white} style={{ marginRight: 6 }} />
              )}
              <Text style={s.pillLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={[s.controlDock, { backgroundColor: colors.videoBg, borderTopColor: colors.border, paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: colors.quickReplyBg }, camFlipped && { backgroundColor: colors.white }]} onPress={() => setCamFlipped(!camFlipped)}>
          <Ionicons name="camera-reverse" size={24} color={camFlipped ? colors.textPrimary : colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: colors.quickReplyBg }, isMuted && { backgroundColor: colors.white }]} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? colors.textPrimary : colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={[s.hangupBtn, { backgroundColor: colors.badgeRed }]} onPress={handleHangup}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: colors.quickReplyBg }, showChatModal && { backgroundColor: colors.white }]} onPress={() => setShowChatModal(!showChatModal)}>
          <Ionicons name="chatbubble-ellipses" size={24} color={showChatModal ? colors.textPrimary : colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={[s.ctrlBtnDanger, { backgroundColor: colors.badgeRed }]} onPress={() => setShowCloseModal(true)}>
          <Ionicons name="close" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

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
                <Ionicons name="send" size={18} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCloseModal} transparent animationType="fade">
        <View style={[s.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Finalizar Incidente</Text>
            <Text style={[s.modalSub, { color: colors.textSecondary }]}>Por favor, indica el motivo del cierre de esta alerta:</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="Ej: Falsa alarma, ya estoy seguro..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <View style={s.modalButtons}>
              <TouchableOpacity style={[s.modalCancelBtn, { borderColor: colors.border }]} onPress={() => { setShowCloseModal(false); setCloseReason(""); }}>
                <Text style={[s.modalCancelText, { color: colors.textSecondary }]}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, { backgroundColor: colors.badgeRed }]} onPress={handleCloseWithReason}>
                <Text style={[s.modalConfirmText, { color: colors.white }]}>Confirmar Cierre</Text>
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

    videoContainer: { flex: 1, position: "relative" },
    floatingHeader: {
      position: "absolute", left: 0, right: 0,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, zIndex: 10,
    },
    liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, gap: 6 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white },
    liveText: { color: colors.white, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
    headerTitle: { fontSize: 14, fontWeight: "bold", color: colors.white, letterSpacing: 1, textShadowColor: colors.blackTranslucent, textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 },
    senaBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

    mainVideo: { flex: 1, justifyContent: "center", alignItems: "center" },
    cameraLabel: { color: colors.whiteTranslucent, fontSize: 14, marginTop: 12, fontWeight: "bold", letterSpacing: 2 },

    pipContainer: { position: "absolute", right: 20, zIndex: 10 },
    pipVideo: {
      width: 100, height: 140, borderRadius: 12, borderWidth: 2,
      justifyContent: "center", alignItems: "center", overflow: "hidden",
    },
    pipBadge: {
      position: "absolute", bottom: 6, left: 6, flexDirection: "row", alignItems: "center",
      backgroundColor: colors.blackTranslucent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4,
    },
    pipBadgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.success },
    pipBadgeText: { color: colors.white, fontSize: 8, fontWeight: "bold" },

    quickSection: { paddingVertical: 12 },
    quickList: { paddingHorizontal: 16, gap: 10 },
    quickPill: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1,
    },
    pillGif: {
      width: 20, height: 20, marginRight: 6,
    },
    pillLabel: { color: colors.white, fontSize: 13, fontWeight: "600" },

    controlDock: {
      flexDirection: "row", justifyContent: "space-evenly", alignItems: "center",
      paddingTop: 20, paddingHorizontal: 10, borderTopWidth: 1,
    },
    ctrlBtn: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
    ctrlBtnDanger: { width: 50, height: 50, borderRadius: 25, justifyContent: "center", alignItems: "center" },
    hangupBtn: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center" },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },
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

    modalContent: { borderRadius: 16, padding: 24, width: "100%" },
    modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
    modalSub: { fontSize: 14, marginBottom: 20 },
    modalInput: { borderRadius: 8, padding: 16, fontSize: 14, borderWidth: 1, minHeight: 120 },
    modalButtons: { flexDirection: "row", gap: 12, marginTop: 24 },
    modalCancelBtn: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1 },
    modalCancelText: { fontWeight: "bold" },
    modalConfirmBtn: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    modalConfirmText: { fontWeight: "bold" },
  });