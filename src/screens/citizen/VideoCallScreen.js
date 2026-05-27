import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
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
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const QUICK_OPTIONS = [
  { icon: "medical-outline", label: "Necesito Ambulancia" },
  { icon: "shield-outline", label: "Robo en progreso" },
  { icon: "hand-left-outline", label: "Necesito intérprete" },
  { icon: "car-outline", label: "Accidente de tránsito" },
  { icon: "walk-outline", label: "El sospechoso huyó" },
  { icon: "checkmark-circle-outline", label: "Estoy bien" },
];

export default function VideoCallScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [camFlipped, setCamFlipped] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [incident, setIncident] = useState(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const unsubMsg = listenMessages(incidentId, setMessages);
    const unsubInc = listenIncidentById(incidentId, setIncident);
    return () => {
      unsubMsg();
      unsubInc();
    };
  }, [incidentId]);

  useEffect(() => {
    if (showChat) {
      enterChat(incidentId);
    } else {
      leaveChat();
    }
    return () => {
      if (showChat) {
        leaveChat();
      }
    };
  }, [showChat, incidentId]);

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
      await sendMessage(incidentId, `🔴 Incidente cerrado: ${closeReason.trim()}`, auth.currentUser.uid, "CITIZEN");
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Área de Video Principal (Dividida visualmente para el prototipo) */}
      <View style={styles.videoContainer}>
        {/* Cabecera Flotante */}
        <View style={[styles.floatingHeader, { top: 12 + insets.top }]}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
          <Text style={styles.headerTitle}>S.O.S. CARABINEROS</Text>
          <TouchableOpacity style={styles.senaBtn} onPress={() => Alert.alert("LENSE", "Traductor en progreso")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="hand-right" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Simulador de Cámara (Fondo negro) */}
        <View style={styles.mainVideo}>
          <Ionicons name={camFlipped ? "camera-reverse-outline" : "camera-outline"} size={64} color="rgba(255,255,255,0.1)" />
          <Text style={styles.cameraLabel}>{camFlipped ? "CÁMARA TRASERA" : "CÁMARA FRONTAL"}</Text>
        </View>

        {/* PiP (Picture in Picture) del Oficial */}
        <View style={[styles.pipContainer, { top: 60 + insets.top }]}>
          <View style={styles.pipVideo}>
            <MaterialCommunityIcons name="police-badge-outline" size={32} color="#FFFFFF" style={{opacity: 0.5}} />
            <View style={styles.pipBadge}>
              <View style={styles.pipBadgeDot} />
              <Text style={styles.pipBadgeText}>OFICIAL</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Scroll de Respuestas Rápidas */}
      <View style={styles.quickSection}>
        <FlatList
          data={QUICK_OPTIONS}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickList}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.quickPill} onPress={() => handleQuickRequest(item.label)} activeOpacity={0.7}>
              <Ionicons name={item.icon} size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.pillLabel}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Interfaz de Chat (Toggleable) */}
      {showChat && (
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            ListEmptyComponent={<Text style={styles.emptyChat}>Escribe un mensaje a la central...</Text>}
            renderItem={({ item }) => (
              <View style={[styles.chatBubble, isMine(item) ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                <Text style={[styles.chatText, isMine(item) ? styles.chatTextMine : styles.chatTextOther]}>{item.text}</Text>
                <Text style={[styles.chatMeta, isMine(item) ? styles.chatMetaMine : styles.chatMetaOther]}>
                  {isMine(item) ? "Tú" : (incident?.officerAlias || "Oficial")}
                </Text>
              </View>
            )}
          />
          <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
            <TextInput
              style={styles.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#888"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Dock Inferior de Controles */}
      <View style={[styles.controlDock, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity style={[styles.ctrlBtn, camFlipped && styles.ctrlBtnActive]} onPress={() => setCamFlipped(!camFlipped)}>
          <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.hangupBtn} onPress={handleHangup}>
          <MaterialCommunityIcons name="phone-hangup" size={32} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.ctrlBtn, showChat && styles.ctrlBtnActive]} onPress={() => setShowChat(!showChat)}>
          <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.ctrlBtnDanger} onPress={() => setShowCloseModal(true)}>
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Modal de Cierre de Incidente */}
      <Modal visible={showCloseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finalizar Incidente</Text>
            <Text style={styles.modalSub}>Por favor, indica el motivo del cierre de esta alerta:</Text>
            <TextInput
              style={styles.modalInput}
              value={closeReason}
              onChangeText={setCloseReason}
              placeholder="Ej: Falsa alarma, ya estoy seguro..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => { setShowCloseModal(false); setCloseReason(""); }}>
                <Text style={styles.modalCancelText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCloseWithReason}>
                <Text style={styles.modalConfirmText}>Confirmar Cierre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000000" },
  
  videoContainer: { flex: 1, position: "relative", backgroundColor: "#111111" },
  floatingHeader: {
    position: "absolute", top: 12, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, zIndex: 10,
  },
  liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#D32F2F", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  liveText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  headerTitle: { fontSize: 14, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 1, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: {width: -1, height: 1}, textShadowRadius: 10 },
  senaBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  
  mainVideo: { flex: 1, justifyContent: "center", alignItems: "center" },
  cameraLabel: { color: "rgba(255,255,255,0.2)", fontSize: 14, marginTop: 12, fontWeight: "bold", letterSpacing: 2 },
  
  pipContainer: { position: "absolute", top: 60, right: 20, zIndex: 10 },
  pipVideo: {
    width: 100, height: 140, borderRadius: 12, borderWidth: 2, borderColor: "#004B2B",
    backgroundColor: "#1A1A1A", justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  pipBadge: {
    position: "absolute", bottom: 6, left: 6, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4,
  },
  pipBadgeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#4CAF50" },
  pipBadgeText: { color: "#FFFFFF", fontSize: 8, fontWeight: "bold" },
  
  quickSection: { paddingVertical: 12, backgroundColor: "#111111" },
  quickList: { paddingHorizontal: 16, gap: 10 },
  quickPill: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  pillLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  
  chatContainer: { backgroundColor: "#1A1A1A", height: "35%", borderTopWidth: 1, borderTopColor: "#333" },
  chatList: { padding: 16 },
  emptyChat: { color: "#666", fontSize: 13, textAlign: "center", marginTop: 20 },
  chatBubble: { maxWidth: "80%", padding: 12, borderRadius: 12, marginBottom: 8 },
  chatBubbleMine: { backgroundColor: "#004B2B", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  chatBubbleOther: { backgroundColor: "#333333", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatTextMine: { color: "#FFFFFF" },
  chatTextOther: { color: "#E0E0E0" },
  chatMeta: { fontSize: 10, marginTop: 6, fontWeight: "bold" },
  chatMetaMine: { color: "rgba(255,255,255,0.5)", textAlign: "right" },
  chatMetaOther: { color: "rgba(255,255,255,0.4)" },
  
  inputRow: { flexDirection: "row", paddingTop: 12, paddingHorizontal: 12, gap: 10, borderTopWidth: 1, borderTopColor: "#333" },
  chatInput: { flex: 1, backgroundColor: "#2A2A2A", borderRadius: 20, paddingHorizontal: 16, color: "#FFFFFF", height: 44, fontSize: 14, textAlignVertical: "center" },
  sendBtn: { width: 44, height: 44, backgroundColor: "#004B2B", borderRadius: 22, justifyContent: "center", alignItems: "center" },
  
  controlDock: {
    flexDirection: "row", justifyContent: "space-evenly", alignItems: "center",
    paddingTop: 20, paddingHorizontal: 10, backgroundColor: "#000000", borderTopWidth: 1, borderTopColor: "#222",
  },
  ctrlBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#222222", justifyContent: "center", alignItems: "center" },
  ctrlBtnActive: { backgroundColor: "#FFFFFF", borderColor: "#004B2B", borderWidth: 2 },
  ctrlBtnDanger: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#D32F2F", justifyContent: "center", alignItems: "center" },
  hangupBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#D32F2F", justifyContent: "center", alignItems: "center" },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, width: "100%" },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A", marginBottom: 8 },
  modalSub: { fontSize: 14, color: "#666666", marginBottom: 20 },
  modalInput: { backgroundColor: "#F8F9FA", borderRadius: 8, padding: 16, fontSize: 14, borderWidth: 1, borderColor: "#E0E0E0", minHeight: 120, color: "#1A1A1A" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 24 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E0E0E0" },
  modalCancelText: { color: "#666666", fontWeight: "bold" },
  modalConfirmBtn: { flex: 1, height: 48, borderRadius: 8, backgroundColor: "#D32F2F", justifyContent: "center", alignItems: "center" },
  modalConfirmText: { color: "#FFFFFF", fontWeight: "bold" },
});