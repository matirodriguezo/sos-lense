import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenMyCases } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "🚗💥" },
  ROBO: { icon: "🦹" },
  VIOLENCIA: { icon: "⚔️" },
  OTRO: { icon: "⚠️" },
};

export default function ChatScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = listenMyCases(user.uid, (data) => {
      setIncidents(data.filter((i) => i.status !== "CERRADO"));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <Text style={styles.navTitle}>Chats Activos</Text>
        <Text style={styles.navSub}>Conversaciones con ciudadanos</Text>
      </View>

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={incidents.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>Sin chats activos</Text>
            <Text style={styles.emptySub}>
              Los chats con ciudadanos aparecerán aquí cuando tomes un procedimiento.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type] || { icon: "⚠️" };
          return (
            <TouchableOpacity
              style={[styles.chatCard, SHADOWS.card]}
              onPress={() =>
                navigation.navigate("Emergencia", {
                  screen: "IncidentManagement",
                  params: { incidentId: item.id },
                })
              }
            >
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{config.icon}</Text>
              </View>
              <View style={styles.chatContent}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>
                    {item.type || "Sin clasificar"}
                  </Text>
                  <View style={styles.chatBadge}>
                    <Text style={styles.chatBadgeText}>En curso</Text>
                  </View>
                </View>
                <Text style={styles.chatFolio}>Folio #{item.id.slice(0, 7)}</Text>
                <Text style={styles.chatLastMsg}>
                  📍 {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                </Text>
              </View>
              <Text style={styles.chatArrow}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  navbar: {
    backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  navTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.surface },
  navSub: { fontSize: FONT_SIZE.sm, color: "rgba(255,255,255,0.7)", marginTop: SPACING.xs },
  list: { padding: SPACING.md },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, opacity: 0.4 },
  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textSecondary, marginTop: SPACING.md },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: "center" },
  chatCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md - 2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  chatAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.greenTranslucent, justifyContent: "center", alignItems: "center",
    marginRight: SPACING.md,
  },
  chatAvatarText: { fontSize: 20 },
  chatContent: { flex: 1 },
  chatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  chatName: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  chatBadge: {
    backgroundColor: COLORS.warning + "22", paddingHorizontal: SPACING.sm,
    paddingVertical: 2, borderRadius: RADIUS.xs,
  },
  chatBadgeText: { fontSize: FONT_SIZE.xxs, color: COLORS.warning, fontWeight: FONT_WEIGHT.bold },
  chatFolio: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  chatLastMsg: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: 2 },
  chatArrow: { fontSize: FONT_SIZE.xl, color: COLORS.textSecondary, marginLeft: SPACING.sm },
});
