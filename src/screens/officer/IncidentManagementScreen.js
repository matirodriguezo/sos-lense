import { useState, useEffect, useRef, useMemo } from "react";
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
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

const DISPATCH_OPTIONS = [
  { id: 1, icon: "police-badge", label: "Despachar Patrulla", color: "#1976D2" },
  { id: 2, icon: "ambulance", label: "Solicitar SAMU", color: "#D32F2F" },
  { id: 3, icon: "chat-processing", label: "Chat de Texto", color: "#424242" },
];

export default function IncidentManagementScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { incidentId } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const insets = useSafeAreaInsets();
  const VIDEO_HEIGHT = Math.min(height * 0.28, 240);
  const [incident, setIncident] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);

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

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, auth.currentUser.uid, "OFFICER");
    } catch {}
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
    <KeyboardAvoidingView style={[s.container, { backgroundColor: colors.videoCallBg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={colors.videoCallBg} />

      {/* Top Bar */}
      <View style={[s.header, { paddingTop: 12 + insets.top }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: colors.whiteTranslucent }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={s.headerTitleContainer}>
          <Text style={[s.headerSub, { color: colors.whiteTranslucent }]}>Procedimiento</Text>
          <Text style={[s.headerTitle, { color: colors.white }]}>#{incidentId.slice(0, 8).toUpperCase()}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: colors.badgeRed }]}><Text style={[s.statusBadgeText, { color: colors.white }]}>● EN CURSO</Text></View>
      </View>

      {/* Split Video Layout */}
      <View style={[s.videoSplitContainer, { height: VIDEO_HEIGHT }]}>
        {/* Citizen Feed */}
        <View style={[s.videoBox, { backgroundColor: colors.videoCallBg, borderColor: colors.badgeRed }]}>
          <View style={s.videoTopTag}><Text style={[s.videoTopTagText, { color: colors.badgeRed }]}>● EN VIVO</Text></View>
          <Ionicons name="person" size={100} color={colors.whiteTranslucent} />
          <View style={[s.videoBottomTag, { backgroundColor: colors.badgeRed }]}>
            <Text style={s.videoBottomTagText}>CIUDADANO · LENSE</Text>
          </View>
        </View>

        {/* Officer Feed */}
        <View style={[s.videoBox, { backgroundColor: colors.videoCallBg, borderColor: colors.primary }]}>
          <View style={s.videoTopTag}><Ionicons name={isMuted ? "mic-off" : "mic"} size={16} color={colors.success} /></View>
          <MaterialCommunityIcons name="police-badge" size={100} color={colors.whiteTranslucent} />
          <View style={[s.videoBottomTag, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="police-badge-outline" size={12} color={colors.gold} style={{marginRight: 4}} />
            <Text style={s.videoBottomTagText}>OPERADOR · LENSE</Text>
          </View>
        </View>
      </View>

        {/* Controls */}
      <View style={[s.mediaControls, { backgroundColor: colors.videoCallBg }]}>
        <TouchableOpacity style={[s.circleBtn, { backgroundColor: colors.whiteTranslucent }]} onPress={() => setIsMuted(!isMuted)}>
          <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={[s.circleBtn, { backgroundColor: colors.whiteTranslucent }]} onPress={() => setIsCamOff(!isCamOff)}>
          <Ionicons name={isCamOff ? "videocam-off" : "videocam"} size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Map Placeholder */}
      <TouchableOpacity style={[s.mapContainer, { backgroundColor: colors.mapPlaceholderBg }]} onPress={openMaps} activeOpacity={0.7}>
        <View style={s.mapHeader}><Text style={s.mapHeaderText}>● GPS ACTIVO</Text></View>
        <Text style={[s.mapAddress, { color: colors.textPrimary }]} numberOfLines={2}>
          {incident?.address || `${incident?.latitude?.toFixed(4)}, ${incident?.longitude?.toFixed(4)}`}
        </Text>
        <View style={s.etaBadge}><Text style={s.etaText}>🚓 ETA: 3 min</Text></View>
      </TouchableOpacity>

      {/* Dispatch Buttons */}
      <View style={s.dispatchGrid}>
        {DISPATCH_OPTIONS.map((item) => (
          <TouchableOpacity key={item.id} style={[s.dispatchBox, {backgroundColor: item.color}]} onPress={() => handleDispatch(item.label)}>
            <MaterialCommunityIcons name={item.icon} size={28} color={colors.white} style={{marginBottom: 8}} />
            <Text style={s.dispatchBoxText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Finalize Button */}
      <View style={[s.footer, { paddingBottom: 16 + insets.bottom }]}>
        <TouchableOpacity style={[s.finalizeBtn, { backgroundColor: colors.badgeRed }]} onPress={() => navigation.replace("CloseIncident", { incidentId })}>
          <Text style={[s.finalizeText, { color: colors.white }]}>■ Finalizar Procedimiento</Text>
        </TouchableOpacity>
      </View>

      {/* Chat Bottom Sheet Modal */}
      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView style={[s.modalOverlay, { backgroundColor: colors.overlay }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[s.chatSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
                <View style={s.chatSheetHeader}>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} style={{marginRight: 8}}/>
                        <Text style={[s.chatSheetTitle, { color: colors.textPrimary }]}>Chat de Emergencia</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
                </View>
                <Text style={[s.chatSheetSub, { color: colors.textSecondary }]}>🤟 Canal de respaldo — texto alternativo a LENSE</Text>
                
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    style={s.chatList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
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
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 16 },
    backBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    headerTitleContainer: { alignItems: "center" },
    headerSub: { fontSize: 12, fontWeight: "bold" },
    headerTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
    statusBadgeText: { fontSize: 10, fontWeight: "bold", letterSpacing: 0.5 },

    videoSplitContainer: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
    videoBox: { flex: 1, borderRadius: 16, borderWidth: 1, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" },
    videoTopTag: { position: "absolute", top: 12, left: 12 },
    videoTopTagText: { fontSize: 10, fontWeight: "bold" },
    videoBottomTag: { position: "absolute", bottom: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    videoBottomTagText: { color: colors.white, fontSize: 10, fontWeight: "bold" },

    mediaControls: { flexDirection: "row", justifyContent: "center", gap: 24, paddingVertical: 16 },
    circleBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },

    mapContainer: { marginHorizontal: 16, height: 120, borderRadius: 12, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" },
    mapHeader: { position: "absolute", top: 8, left: 8, backgroundColor: colors.blackTranslucent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    mapHeaderText: { color: colors.success, fontSize: 10, fontWeight: "bold" },
    mapAddress: { fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: 40, marginTop: 4 },
    etaBadge: { position: "absolute", bottom: 8, right: 8, backgroundColor: colors.blueDispatch, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    etaText: { color: colors.white, fontSize: 11, fontWeight: "bold" },

    dispatchGrid: { flexDirection: "row", gap: 12, paddingHorizontal: 16, marginTop: 16 },
    dispatchBox: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
    dispatchBoxText: { color: colors.white, fontSize: 11, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },

    footer: { padding: 16, marginTop: "auto" },
    finalizeBtn: { borderRadius: 12, height: 56, justifyContent: "center", alignItems: "center" },
    finalizeText: { fontSize: 16, fontWeight: "bold", letterSpacing: 1 },

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
  });
