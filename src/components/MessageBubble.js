import { memo, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";

const formatTime = (createdAt) => {
  if (!createdAt) return "";
  const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  const now = new Date();
  const hours = date.getHours().toString().padStart(2, "0");
  const mins = date.getMinutes().toString().padStart(2, "0");
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return `${hours}:${mins}`;
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month} ${hours}:${mins}`;
};

function MessageBubble({ message, isMine, otherRole, otherUserId, currentUserId, citizenAlias, officerAlias, colors: themeColors }) {
  const { colors } = useTheme();

  const s = useMemo(() => makeStyles(colors), [colors]);

  const readBy = message.readBy || [];
  const isRead = readBy.includes(otherUserId);

  const senderName = useMemo(() => {
    if (isMine) return "Tú";
    if (otherRole === "OFFICER") return officerAlias || "Oficial";
    if (otherRole === "CITIZEN") return citizenAlias || "Ciudadano";
    return otherRole;
  }, [isMine, otherRole, citizenAlias, officerAlias]);

  const time = useMemo(() => formatTime(message.createdAt), [message.createdAt]);

  return (
    <View style={[s.bubble, isMine ? [s.bubbleMine, { backgroundColor: colors.chatMineBg }] : [s.bubbleOther, { backgroundColor: colors.border }]]}>
      <Text style={[s.meta, isMine ? { color: colors.whiteTranslucent, textAlign: "right" } : { color: colors.textSecondary }]}>
        {senderName}
      </Text>
      <Text style={[s.text, isMine ? { color: colors.white } : { color: colors.textPrimary }]}>{message.text}</Text>
      <View style={s.footer}>
        <Text style={[s.time, isMine ? { color: colors.whiteTranslucent } : { color: colors.textSecondary }]}>
          {time}
        </Text>
        {isMine && (
          <View style={s.tickContainer}>
            {isRead ? (
              <Ionicons name="checkmark-done" size={14} color="#53BDEB" />
            ) : (
              <Ionicons name="checkmark" size={14} color={colors.whiteTranslucent} />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

export default memo(MessageBubble);

const makeStyles = (colors) =>
  StyleSheet.create({
    bubble: { maxWidth: "85%", padding: 12, borderRadius: 12, marginBottom: 12 },
    bubbleMine: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
    bubbleOther: { alignSelf: "flex-start", borderBottomLeftRadius: 4 },
    meta: { fontSize: 10, marginBottom: 4, fontWeight: "bold" },
    text: { fontSize: 14, lineHeight: 20 },
    footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4, gap: 4 },
    time: { fontSize: 10 },
    tickContainer: { flexDirection: "row" },
  });
