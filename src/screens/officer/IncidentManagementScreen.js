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
  Linking,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { listenIncidentById, listenMessages, sendMessage, addQuickRequest, assignOfficer, closeIncident, sendSystemMessage } from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const DISPATCH_OPTIONS = [
  { id: 1, icon: "police-badge", label: "Despachar Patrulla", color: "#1976D2" },
  { id: 2, icon: "ambulance", label: "Solicitar SAMU", color: "#D32F2F" },
  { id: 3, icon: "chat-processing", label: "Chat de Texto", color: "#424242" },
];

export default function IncidentManagementScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const unsubIncident = listenIncidentById(incidentId, (data) => {
      setIncident(data);
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

    return () => { unsubIncident(); unsubMessages(); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [incidentId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try { await sendMessage(incidentId, text, auth.currentUser.uid, "OFFICER"); } catch {}
  };

  const handleDispatch = (label) => {
    if(label === "Chat de Texto") {
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
        }}
    ]);
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  const openMaps = () => {
    const { latitude, longitude } = incident;
    if (!latitude || !longitude) {
      Alert.alert("Ubicación no disponible", "No se ha registrado la ubicación del ciudadano.");
      return;
    }
    const scheme = Platform.OS === "ios" ? "maps:0,0?q=" : "geo:0,0?q=";
    const url = Platform.OS === "ios"
      ? `maps://app?daddr=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${latitude},${longitude}`);
    });
  };

  if (!incident) return null;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1319" />

      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#E0E0E0" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSub}>Procedimiento</Text>
          <Text style={styles.headerTitle}>#{incidentId.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>● EN CURSO</Text></View>
      </View>

      {/* Split Video Layout */}
      <View style={styles.videoSplitContainer}>
        {/* Citizen Feed */}
        <View style={[styles.videoBox, { backgroundColor: "#3A1A1A", borderColor: "#D32F2F" }]}>
          <View style={styles.videoTopTag}><Text style={styles.videoTopTagText}>● EN VIVO</Text></View>
          <Ionicons name="person" size={100} color="rgba(255,255,255,0.1)" />
          <View style={[styles.videoBottomTag, { backgroundColor: "#D32F2F" }]}>
            <Text style={styles.videoBottomTagText}>CIUDADANO · LENSE</Text>
          </View>
        </View>

        {/* Officer Feed */}
        <View style={[styles.videoBox, { backgroundColor: "#1A2E1A", borderColor: "#004B2B" }]}>
          <View style={[styles.videoTopTag, {backgroundColor: 'transparent'}]}><Ionicons name={isMuted ? "mic-off" : "mic"} size={16} color="#4CAF50" /></View>
          <MaterialCommunityIcons name="police-badge" size={100} color="rgba(255,255,255,0.1)" />
          <View style={[styles.videoBottomTag, { backgroundColor: "#004B2B" }]}>
            <MaterialCommunityIcons name="police-badge-outline" size={12} color="#D4AF37" style={{marginRight: 4}} />
            <Text style={styles.videoBottomTagText}>OPERADOR · LENSE</Text>
          </View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.mediaControls}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#E0E0E0" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleBtn} onPress={() => setIsCamOff(!isCamOff)}>
          <Ionicons name={isCamOff ? "videocam-off" : "videocam"} size={22} color="#E0E0E0" />
        </TouchableOpacity>
      </View>

      {/* Map Placeholder */}
      <TouchableOpacity style={styles.mapContainer} onPress={openMaps} activeOpacity={0.7}>
        <View style={styles.mapHeader}><Text style={styles.mapHeaderText}>● GPS ACTIVO</Text></View>
        <Text style={styles.mapAddress} numberOfLines={2}>
          {incident?.address || `${incident?.latitude?.toFixed(4)}, ${incident?.longitude?.toFixed(4)}`}
        </Text>
        <View style={styles.etaBadge}><Text style={styles.etaText}>🚓 ETA: 3 min</Text></View>
      </TouchableOpacity>

      {/* Dispatch Buttons */}
      <View style={styles.dispatchGrid}>
        {DISPATCH_OPTIONS.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.dispatchBox, {backgroundColor: item.color}]} onPress={() => handleDispatch(item.label)}>
            <MaterialCommunityIcons name={item.icon} size={28} color="#FFFFFF" style={{marginBottom: 8}} />
            <Text style={styles.dispatchBoxText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Finalize Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.finalizeBtn} onPress={() => navigation.replace("CloseIncident", { incidentId })}>
          <Text style={styles.finalizeText}>■ Finalizar Procedimiento</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Bottom Sheet Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View style={styles.chatSheet}>
                <View style={styles.chatSheetHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#FFFFFF" style={{marginRight: 8}}/>
                        <Text style={styles.chatSheetTitle}>Chat de Emergencia</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="close" size={24} color="#A0A0A0" /></TouchableOpacity>
                </View>
                <Text style={styles.chatSheetSub}>🤟 Canal de respaldo — texto alternativo a LENSE</Text>
                
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    style={styles.chatList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                    ListEmptyComponent={<Text style={styles.emptyChat}>Sin mensajes.</Text>}
                    renderItem={({ item }) => (
                    <View style={[styles.chatBubble, isMine(item) ? styles.chatBubbleMine : styles.chatBubbleOther]}>
                        <Text style={[styles.chatMeta, isMine(item) ? styles.chatMetaMine : styles.chatMetaOther]}>
                            {isMine(item) ? "Tú" : (incident?.citizenAlias || "Ciudadano")}
                        </Text>
                        <Text style={[styles.chatText, isMine(item) ? styles.chatTextMine : styles.chatTextOther]}>{item.text}</Text>
                    </View>
                    )}
                />
                <View style={styles.inputRow}>
                    <TextInput
                    style={styles.chatInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Escriba un mensaje..."
                    placeholderTextColor="#666"
                    onSubmitEditing={handleSend}
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
                        <Ionicons name="send" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1319" }, // Dark tech background
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  headerTitleContainer: { alignItems: "center" },
  headerSub: { color: "#A0A0A0", fontSize: 12, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  statusBadge: { backgroundColor: "#D32F2F", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  statusBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold", letterSpacing: 0.5 },

  videoSplitContainer: { flexDirection: "row", gap: 12, paddingHorizontal: 16, height: 220 },
  videoBox: { flex: 1, borderRadius: 16, borderWidth: 1, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" },
  videoTopTag: { position: "absolute", top: 12, left: 12 },
  videoTopTagText: { color: "#D32F2F", fontSize: 10, fontWeight: "bold" },
  videoBottomTag: { position: "absolute", bottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  videoBottomTagText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },

  mediaControls: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 16 },
  circleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  mapContainer: { marginHorizontal: 16, height: 120, backgroundColor: "#DDE3E9", borderRadius: 12, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" },
  mapHeader: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  mapHeaderText: { color: "#4CAF50", fontSize: 10, fontWeight: "bold" },
  mapAddress: { color: "#333", fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 40, marginTop: 4 },
  etaBadge: { position: "absolute", bottom: 8, right: 8, backgroundColor: "#1976D2", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  etaText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold" },

  dispatchGrid: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 16 },
  dispatchBox: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  dispatchBoxText: { color: "#FFFFFF", fontSize: 11, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },

  footer: { padding: 16, marginTop: "auto" },
  finalizeBtn: { backgroundColor: "#D32F2F", borderRadius: 12, height: 56, justifyContent: "center", alignItems: "center" },
  finalizeText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold", letterSpacing: 1 },

  // Chat Sheet
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  chatSheet: { backgroundColor: "#1E2A38", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: "60%" },
  chatSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chatSheetTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  chatSheetSub: { color: "#A0A0A0", fontSize: 12, marginBottom: 16 },
  chatList: { flex: 1 },
  emptyChat: { color: "#666", textAlign: "center", marginTop: 20 },
  chatBubble: { maxWidth: "85%", padding: 12, borderRadius: 12, marginBottom: 12 },
  chatBubbleMine: { backgroundColor: "#004B2B", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  chatBubbleOther: { backgroundColor: "#334155", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  chatMeta: { fontSize: 10, marginBottom: 4, fontWeight: "bold" },
  chatMetaMine: { color: "rgba(255,255,255,0.5)", textAlign: "right" },
  chatMetaOther: { color: "#A0A0A0" },
  chatText: { fontSize: 14, lineHeight: 20 },
  chatTextMine: { color: "#FFFFFF" },
  chatTextOther: { color: "#FFFFFF" },
  inputRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  chatInput: { flex: 1, backgroundColor: "#0F172A", borderRadius: 8, paddingHorizontal: 16, color: "#FFFFFF", height: 48, borderWidth: 1, borderColor: "#334155" },
  sendBtn: { width: 48, height: 48, backgroundColor: "#004B2B", borderRadius: 8, justifyContent: "center", alignItems: "center" },
});