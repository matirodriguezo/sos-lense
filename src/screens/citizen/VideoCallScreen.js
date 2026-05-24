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
  Keyboard,
} from "react-native";
import { auth } from "../../firebase/firebaseConfig";
import { addQuickRequest, sendMessage, listenMessages } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";

const { width } = Dimensions.get("window");

export default function VideoCallScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showChat, setShowChat] = useState(false);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const unsub = listenMessages(incidentId, setMessages);
    return unsub;
  }, [incidentId]);

  const handleQuickRequest = async (request) => {
    try {
      await addQuickRequest(incidentId, request);
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
        text: "Colgar",
        style: "destructive",
        onPress: () => navigation.reset({ index: 0, routes: [{ name: "Home" }] }),
      },
    ]);
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.cameraFeed}>
        <Text style={styles.cameraEmoji}>📱</Text>
        <Text style={styles.cameraText}>Cámara frontal</Text>

        <View style={styles.floatingHeader}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>S.O.S. CARABINEROS</Text>
          </View>
        </View>

        <View style={styles.pipContainer}>
          <View style={styles.pipVideo}>
            <Text style={styles.pipEmoji}>👮</Text>
            <View style={styles.pipBadge}>
              <Text style={styles.pipBadgeDot}>●</Text>
              <Text style={styles.pipBadgeText}>OFICIAL</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Quick replies */}
      <View style={styles.quickSection}>
        <TouchableOpacity
          style={styles.quickPill}
          onPress={() => handleQuickRequest("Necesito Ambulancia")}
          activeOpacity={0.7}
        >
          <Text style={styles.pillIconRed}>🩺</Text>
          <Text style={styles.pillLabel}>Necesito Ambulancia</Text>
          <Text style={styles.pillChevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickPill}
          onPress={() => handleQuickRequest("Robo en progreso")}
          activeOpacity={0.7}
        >
          <Text style={styles.pillIconRed}>🛡️</Text>
          <Text style={styles.pillLabel}>Robo en progreso</Text>
          <Text style={styles.pillChevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Chat expandable */}
      {showChat && (
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            style={styles.chatList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <Text style={styles.emptyChat}>Sin mensajes aún</Text>
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
                  {isMine(item) ? "Tú" : "Carabinero"}
                </Text>
              </View>
            )}
          />
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.chatInput}
              value={input}
              onChangeText={setInput}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Text style={styles.sendBtnText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Control dock */}
      <View style={styles.controlDock}>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => Alert.alert("Cámara", "Alternar cámara no disponible sin SDK de video.")}
        >
          <Text style={styles.ctrlIcon}>🔄</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => Alert.alert("Micrófono", "Silenciar no disponible sin SDK de video.")}
        >
          <Text style={styles.ctrlIcon}>🔇</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.hangupBtn} onPress={handleHangup}>
          <Text style={styles.hangupIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.ctrlBtn, showChat && styles.ctrlBtnActive]}
          onPress={() => setShowChat(!showChat)}
        >
          <Text style={styles.ctrlIcon}>💬</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  // Camera
  cameraFeed: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cameraEmoji: { fontSize: 48, opacity: 0.3 },
  cameraText: { color: "rgba(255,255,255,0.3)", fontSize: FONT_SIZE.sm, marginTop: SPACING.sm },
  floatingHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPACING.xl + SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.whiteTranslucent,
  },
  headerLeft: { alignItems: "center" },
  headerTitle: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  // PiP
  pipContainer: { position: "absolute", top: SPACING.xl + SPACING.xl + SPACING.sm, right: SPACING.md },
  pipVideo: {
    width: width * 0.28,
    height: width * 0.38,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  pipEmoji: { fontSize: 28 },
  pipBadge: {
    position: "absolute",
    bottom: SPACING.xs, left: SPACING.xs,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.blackTranslucent,
    paddingHorizontal: SPACING.sm, paddingVertical: 2,
    borderRadius: RADIUS.xs, gap: 3,
  },
  pipBadgeDot: { color: COLORS.success, fontSize: 8 },
  pipBadgeText: { color: COLORS.surface, fontSize: 8, fontWeight: FONT_WEIGHT.bold },
  // Quick replies
  quickSection: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: "#000",
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.overlay,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pillIconRed: { fontSize: 18, marginRight: SPACING.sm + 2 },
  pillLabel: { flex: 1, color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.medium },
  pillChevron: { color: "rgba(255,255,255,0.4)", fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.bold },
  // Chat
  chatContainer: { backgroundColor: "#111", maxHeight: 250 },
  chatList: { maxHeight: 180, paddingHorizontal: SPACING.sm },
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
  inputRow: { flexDirection: "row", padding: SPACING.sm, gap: SPACING.sm },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    color: COLORS.surface,
    height: 40,
    fontSize: FONT_SIZE.sm,
  },
  sendBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    justifyContent: "center",
  },
  sendBtnText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.semiBold, fontSize: FONT_SIZE.sm },
  // Control dock
  controlDock: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: SPACING.md + SPACING.sm,
    paddingVertical: SPACING.lg,
    backgroundColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  ctrlBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center",
  },
  ctrlBtnActive: { backgroundColor: COLORS.primary, borderWidth: 2, borderColor: COLORS.surface },
  ctrlIcon: { fontSize: 20 },
  hangupBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.danger, justifyContent: "center", alignItems: "center",
  },
  hangupIcon: { fontSize: 26, color: COLORS.surface, transform: [{ rotate: "135deg" }] },
});
