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
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import {
  listenIncidentById,
  listenMessages,
  sendMessage,
  addQuickRequest,
} from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function IncidentManagementScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    const unsubIncident = listenIncidentById(incidentId, setIncident);
    const unsubMessages = listenMessages(incidentId, setMessages);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(
        `${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`
      );
    }, 1000);

    return () => {
      unsubIncident();
      unsubMessages();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [incidentId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, auth.currentUser.uid, "OFFICER");
    } catch {}
  };

  const handleQuickReply = async (request) => {
    try {
      await addQuickRequest(incidentId, request);
    } catch {}
  };

  const handleHangup = () => {
    Alert.alert("Finalizar llamada", "¿Qué deseas hacer?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Volver al panel",
        onPress: () => navigation.navigate("DispatchPanel"),
      },
      {
        text: "Cerrar incidente",
        onPress: () => navigation.navigate("CloseIncident", { incidentId }),
      },
    ]);
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  if (!incident) return null;

  const dispatchOptions = [
    { icon: "🚓", label: "Despachar Patrulla" },
    { icon: "🚑", label: "Solicitar Ambulancia" },
    { icon: "🤟", label: "Intérprete de Señas" },
    { icon: "🔍", label: "Unidad de Investigación" },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.cameraFeed}>
        <Text style={styles.cameraEmoji}>📷</Text>

        <View style={styles.floatingHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.liveBadge}>
              <Text style={styles.liveDot}>🔴</Text>
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
            <Text style={styles.timer}>{elapsed}</Text>
          </View>
          <TouchableOpacity style={styles.rotateBtn}>
            <Text style={styles.rotateIcon}>🔄</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.officerName}>
          {incident.type || "Sin clasificar"}
        </Text>
        <Text style={styles.officerUnit}>
          #{incidentId.slice(0, 8)} — {incident.quick_requests || "Sin solicitudes"}
        </Text>

        <View style={styles.pipContainer}>
          <View style={styles.pipVideo}>
            <Text style={styles.pipEmoji}>🧏</Text>
          </View>
        </View>
      </View>

      {/* Dispatch pills */}
      <View style={styles.dispatchSection}>
        <FlatList
          data={dispatchOptions}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dispatchList}
          keyExtractor={(item) => item.label}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dispatchPill}
              onPress={() => handleQuickReply(item.label)}
              activeOpacity={0.7}
            >
              <Text style={styles.dispatchIcon}>{item.icon}</Text>
              <Text style={styles.dispatchLabel}>{item.label}</Text>
              <Text style={styles.dispatchArrow}>›</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Chat */}
      <View style={styles.chatSection}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <Text style={styles.emptyChat}>Esperando mensajes del ciudadano...</Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.chatBubble,
                isMine(item) ? styles.chatBubbleMine : styles.chatBubbleOther,
              ]}
            >
              <Text
                style={[
                  styles.chatText,
                  isMine(item) ? styles.chatTextMine : styles.chatTextOther,
                ]}
              >
                {item.text}
              </Text>
              <Text
                style={[
                  styles.chatMeta,
                  isMine(item) ? styles.chatMetaMine : styles.chatMetaOther,
                ]}
              >
                {isMine(item) ? "Tú" : "Ciudadano"}
              </Text>
            </View>
          )}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={COLORS.textSecondary}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Control dock */}
      <View style={styles.controlDock}>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => Alert.alert("Micrófono", "Silenciar no disponible sin SDK de video.")}
        >
          <Text style={styles.ctrlIcon}>🔇</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => Alert.alert("Cámara", "Alternar cámara no disponible sin SDK de video.")}
        >
          <Text style={styles.ctrlIcon}>📷</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.hangupBtn} onPress={handleHangup}>
          <Text style={styles.hangupIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => Alert.alert("Chat", "El chat ya está abierto.")}
        >
          <Text style={styles.ctrlIcon}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => navigation.navigate("CloseIncident", { incidentId })}
        >
          <Text style={styles.ctrlIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  cameraFeed: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cameraEmoji: { fontSize: 56, opacity: 0.2 },
  floatingHeader: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xl + SPACING.sm, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.blackTranslucent,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  liveBadge: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.badgeRed,
    paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.xs, gap: 4,
  },
  liveDot: { fontSize: 8 },
  liveText: { color: COLORS.surface, fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },
  timer: { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },
  rotateBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)", justifyContent: "center", alignItems: "center",
  },
  rotateIcon: { fontSize: 18 },
  officerName: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.md },
  officerUnit: { color: "rgba(255,255,255,0.5)", fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, textAlign: "center", paddingHorizontal: SPACING.lg },
  pipContainer: { position: "absolute", top: SPACING.xl + SPACING.xl + SPACING.sm, right: SPACING.md },
  pipVideo: {
    width: width * 0.28, height: width * 0.38, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.surface, backgroundColor: "#222",
    justifyContent: "center", alignItems: "center", overflow: "hidden",
  },
  pipEmoji: { fontSize: 28 },
  // Dispatch
  dispatchSection: { paddingVertical: SPACING.sm, backgroundColor: "#111" },
  dispatchList: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  dispatchPill: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  dispatchIcon: { fontSize: 16, marginRight: SPACING.sm },
  dispatchLabel: { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold },
  dispatchArrow: { color: "rgba(255,255,255,0.5)", fontSize: FONT_SIZE.lg, marginLeft: SPACING.sm },
  // Chat
  chatSection: { flex: 1, backgroundColor: "#111", padding: SPACING.sm },
  chatList: { flex: 1 },
  emptyChat: { color: "rgba(255,255,255,0.3)", fontSize: FONT_SIZE.sm, textAlign: "center", padding: SPACING.md },
  chatBubble: { maxWidth: "80%", padding: SPACING.sm + 2, borderRadius: RADIUS.md, marginBottom: SPACING.xs },
  chatBubbleMine: { backgroundColor: COLORS.primary, alignSelf: "flex-end", borderBottomRightRadius: 4 },
  chatBubbleOther: { backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "flex-start", borderBottomLeftRadius: 4 },
  chatText: { fontSize: FONT_SIZE.sm },
  chatTextMine: { color: COLORS.surface },
  chatTextOther: { color: COLORS.surface },
  chatMeta: { fontSize: 10, marginTop: 4 },
  chatMetaMine: { color: "rgba(255,255,255,0.5)" },
  chatMetaOther: { color: "rgba(255,255,255,0.4)" },
  inputRow: { flexDirection: "row", padding: SPACING.xs, gap: SPACING.sm },
  chatInput: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md, color: COLORS.surface, height: 40, fontSize: FONT_SIZE.sm,
  },
  sendBtn: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill, justifyContent: "center",
  },
  sendBtnText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.semiBold, fontSize: FONT_SIZE.sm },
  // Control dock
  controlDock: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    gap: SPACING.md, paddingVertical: SPACING.lg, backgroundColor: "#000",
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)",
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center",
  },
  ctrlIcon: { fontSize: 20 },
  hangupBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.danger, justifyContent: "center", alignItems: "center",
  },
  hangupIcon: { fontSize: 26, color: COLORS.surface, transform: [{ rotate: "135deg" }] },
});
