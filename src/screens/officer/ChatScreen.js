import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { auth } from "../../firebase/firebaseConfig";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { listenMyCases } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const ACTIVE_STATUSES = ["ACTIVO", "EN_CURSO", "NO_CLASIFICADO"];
const FINALIZED_STATUSES = ["CERRADO", "ANULADO"];

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car", label: "Accidente Tránsito", color: "#F59E0B" },
  ROBO: { icon: "shield", label: "Robo / Asalto", color: "#EF4444" },
  VIOLENCIA: { icon: "home", label: "Violencia Intrafamiliar", color: "#8B5CF6" },
  MEDICA: { icon: "medical", label: "Emergencia Médica", color: "#10B981" },
  OTRO: { icon: "alert-circle", label: "Otro", color: "#6B7280" },
};

const STATUS_CONFIG = {
  NO_CLASIFICADO: { label: "Sin clasificar", color: "#F59E0B" },
  ACTIVO: { label: "Activo", color: "#10B981" },
  EN_CURSO: { label: "En curso", color: "#3B82F6" },
  CERRADO: { label: "Cerrado", color: "#6B7280" },
  ANULADO: { label: "Anulado", color: "#EF4444" },
};

const getElapsed = (createdAt) => {
  if (!createdAt) return "";
  const created = createdAt.toMillis ? createdAt.toMillis() : createdAt;
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "< 1 min";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHr < 24) return `${diffHr}h ${remMin}m`;
  return `${Math.floor(diffHr / 24)}d ${diffHr % 24}h`;
};

const getTime = (createdAt) => {
  if (!createdAt) return 0;
  return createdAt.toMillis ? createdAt.toMillis() : createdAt;
};

const sortByRecent = (a, b) => getTime(b.createdAt) - getTime(a.createdAt);

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
  const { unreadCount, enterChatList, leaveChatList } = useNotifications();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadMap, setUnreadMap] = useState({});
  const msgUnsubs = useRef({});
  const uid = auth.currentUser?.uid;

  const s = useMemo(() => makeStyles(colors), [colors]);

  // Subscribe to message changes per incident to track unread counts
  const subscribeMessages = (incidentId) => {
    if (msgUnsubs.current[incidentId]) return;
    const q = query(
      collection(db, "incidents", incidentId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const uidLocal = auth.currentUser?.uid;
      if (!uidLocal) return;
      let count = 0;
      snapshot.docs.forEach((d) => {
        const msg = d.data();
        if (msg.senderId === uidLocal) return;
        if (msg.senderRole === "SYSTEM") return;
        const readBy = msg.readBy || [];
        if (!readBy.includes(uidLocal)) count++;
      });
      setUnreadMap((prev) => {
        if (prev[incidentId] === count) return prev;
        return { ...prev, [incidentId]: count };
      });
    });
    msgUnsubs.current[incidentId] = unsub;
  };

  const unsubscribeAllMessages = () => {
    Object.values(msgUnsubs.current).forEach((u) => u());
    msgUnsubs.current = {};
  };

  // Reset unread count when tab is focused, resume counting when blurred
  useFocusEffect(
    useCallback(() => {
      console.log("[ChatScreen] Tab focused");
      enterChatList();
      return () => {
        console.log("[ChatScreen] Tab blurred");
        leaveChatList();
      };
    }, [])
  );

  useEffect(() => {
    console.log("[ChatScreen] Mounted");
    const user = auth.currentUser;
    if (!user) return;
    const unsub = listenMyCases(user.uid, (data) => {
      const active = data
        .filter((i) => ACTIVE_STATUSES.includes(i.status))
        .sort(sortByRecent);
      const finalized = data
        .filter((i) => FINALIZED_STATUSES.includes(i.status))
        .sort(sortByRecent);
      setIncidents([...active, ...finalized]);
      setLoading(false);
      console.log(`[ChatScreen] Loaded ${active.length} active, ${finalized.length} finalized`);
    });
    return () => {
      console.log("[ChatScreen] Unmounted");
      unsub();
      unsubscribeAllMessages();
    };
  }, []);

  // When incidents change, subscribe to messages for active ones
  useEffect(() => {
    const activeIds = incidents
      .filter((i) => ACTIVE_STATUSES.includes(i.status))
      .map((i) => i.id);
    const currentIds = Object.keys(msgUnsubs.current);
    // Unsubscribe removed incidents
    currentIds.forEach((id) => {
      if (!activeIds.includes(id)) {
        msgUnsubs.current[id]();
        delete msgUnsubs.current[id];
      }
    });
    // Subscribe to new active incidents
    activeIds.forEach((id) => subscribeMessages(id));
  }, [incidents]);

  const sectionCounts = useMemo(() => {
    const active = incidents.filter((i) => ACTIVE_STATUSES.includes(i.status)).length;
    const finalized = incidents.filter((i) => FINALIZED_STATUSES.includes(i.status)).length;
    return { active, finalized };
  }, [incidents]);

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const sections = [];
  const activeItems = incidents.filter((i) => ACTIVE_STATUSES.includes(i.status));
  const finalizedItems = incidents.filter((i) => FINALIZED_STATUSES.includes(i.status));

  if (activeItems.length > 0) {
    sections.push({ type: "header", title: "ACTIVOS", count: activeItems.length });
    activeItems.forEach((i) => sections.push({ type: "item", data: i }));
  }
  if (finalizedItems.length > 0) {
    sections.push({ type: "header", title: "FINALIZADOS", count: finalizedItems.length });
    finalizedItems.forEach((i) => sections.push({ type: "item", data: i }));
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <View style={[s.navbar, { backgroundColor: colors.primary }]}>
        <View style={s.navbarRow}>
          <Text style={[s.navTitle, { color: colors.surface }]}>Chats</Text>
          {unreadCount > 0 && (
            <View style={[s.navBadge, { backgroundColor: colors.badgeRed }]}>
              <Text style={[s.navBadgeText, { color: colors.white }]}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
        <Text style={[s.navSub, { color: colors.whiteTranslucent }]}>
          {sectionCounts.active} activo{sectionCounts.active !== 1 ? "s" : ""}
          {sectionCounts.finalized > 0 ? ` · ${sectionCounts.finalized} finalizado${sectionCounts.finalized !== 1 ? "s" : ""}` : ""}
        </Text>
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item, idx) => item.type === "header" ? `hdr-${item.title}` : item.data.id}
        contentContainerStyle={sections.length === 0 ? s.emptyContainer : s.list}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={10}
        initialNumToRender={6}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.iconMuted} />
            <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>Sin chats</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              Los chats con ciudadanos aparecerán aquí cuando tomes un procedimiento.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <View style={s.sectionHeader}>
                <Text style={[s.sectionHeaderText, { color: colors.textSecondary }]}>
                  {item.title}
                </Text>
                <View style={[s.sectionLine, { backgroundColor: colors.border }]} />
              </View>
            );
          }
          const inc = item.data;
          const config = TYPE_CONFIG[inc.type] || { icon: "alert-circle", label: "Sin clasificar", color: "#6B7280" };
          const statusCfg = STATUS_CONFIG[inc.status] || { label: inc.status || "Desconocido", color: "#6B7280" };
          const isFinalized = FINALIZED_STATUSES.includes(inc.status);
          const perIncUnread = unreadMap[inc.id] || 0;
          return (
            <TouchableOpacity
              style={[s.chatCard, { backgroundColor: colors.surface, borderColor: colors.border }, isFinalized && { opacity: 0.65 }]}
              activeOpacity={0.7}
              onPress={() => {
                if (isFinalized) {
                  Alert.alert("Incidente finalizado", "Este caso ya fue cerrado. Puedes revisar el historial.");
                  return;
                }
                Alert.alert("Abrir chat", "¿Deseas abrir el chat de este incidente?", [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "Abrir",
                    onPress: () =>
                      navigation.navigate("Emergencia", {
                        screen: "IncidentManagement",
                        params: { incidentId: inc.id, autoOpenChat: true },
                      }),
                  },
                ]);
              }}
            >
              <View style={[s.chatAvatar, { backgroundColor: config.color + "22" }]}>
                <MaterialCommunityIcons name={config.icon} size={24} color={isFinalized ? "#6B7280" : config.color} />
              </View>
              <View style={s.chatContent}>
                <View style={s.chatHeader}>
                  <Text style={[s.chatName, { color: isFinalized ? colors.textSecondary : colors.textPrimary }]} numberOfLines={1}>
                    {config.label}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {perIncUnread > 0 && (
                      <View style={[s.perIncBadge, { backgroundColor: colors.badgeRed }]}>
                        <Text style={[s.perIncBadgeText, { color: colors.white }]}>
                          {perIncUnread > 9 ? "9+" : perIncUnread}
                        </Text>
                      </View>
                    )}
                    <View style={[s.chatBadge, { backgroundColor: statusCfg.color + "22" }]}>
                      <Text style={[s.chatBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                  </View>
                </View>

                <Text style={[s.chatFolio, { color: colors.textSecondary }]}>
                  Folio #{inc.id.slice(0, 8).toUpperCase()}
                </Text>

                <View style={s.metaRow}>
                  <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                  <Text style={[s.metaText, { color: colors.textSecondary }]}>
                    {getElapsed(inc.createdAt)}
                  </Text>
                </View>

                {inc.address && (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text style={[s.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {inc.address}
                    </Text>
                  </View>
                )}

                {!inc.address && inc.latitude && (
                  <Text style={[s.coords, { color: colors.textSecondary }]}>
                    {inc.latitude.toFixed(6)}, {inc.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    navbar: {
      paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    },
    navbarRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    navTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    navBadge: {
      minWidth: 22, height: 22, borderRadius: 11,
      justifyContent: "center", alignItems: "center", paddingHorizontal: 6,
    },
    navBadgeText: { fontSize: 11, fontWeight: "700" },
    navSub: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    list: { padding: SPACING.md },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: "center", paddingHorizontal: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.md },
    emptySub: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, textAlign: "center" },

    sectionHeader: {
      flexDirection: "row", alignItems: "center", gap: 12,
      marginTop: SPACING.md, marginBottom: SPACING.sm,
    },
    sectionHeaderText: { fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
    sectionLine: { flex: 1, height: 1 },

    chatCard: {
      flexDirection: "row", alignItems: "center",
      borderRadius: RADIUS.md,
      padding: SPACING.md, marginBottom: SPACING.md - 2,
      borderWidth: 1,
    },
    chatAvatar: {
      width: 44, height: 44, borderRadius: 22,
      justifyContent: "center", alignItems: "center",
      marginRight: SPACING.md,
    },
    chatContent: { flex: 1 },
    chatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    chatName: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, flex: 1, marginRight: 8 },
    chatBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2, borderRadius: RADIUS.xs,
    },
    chatBadgeText: { fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.bold },
    perIncBadge: {
      minWidth: 20, height: 20, borderRadius: 10,
      justifyContent: "center", alignItems: "center", paddingHorizontal: 5,
    },
    perIncBadgeText: { fontSize: 10, fontWeight: "700" },
    chatFolio: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    metaText: { fontSize: FONT_SIZE.sm },
    coords: { fontSize: FONT_SIZE.sm, marginTop: 2 },
  });
