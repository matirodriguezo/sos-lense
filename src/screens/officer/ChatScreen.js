import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenMyCases } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car" },
  ROBO: { icon: "shield" },
  VIOLENCIA: { icon: "home" },
  OTRO: { icon: "alert-circle" },
};

export default function ChatScreen({ navigation }) {
  const { colors } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const s = useMemo(() => makeStyles(colors), [colors]);

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
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <View style={[s.navbar, { backgroundColor: colors.primary }]}>
        <Text style={[s.navTitle, { color: colors.surface }]}>Chats Activos</Text>
        <Text style={[s.navSub, { color: colors.whiteTranslucent }]}>Conversaciones con ciudadanos</Text>
      </View>

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        contentContainerStyle={incidents.length === 0 ? s.emptyContainer : s.list}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={10}
        initialNumToRender={6}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.iconMuted} />
            <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>Sin chats activos</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              Los chats con ciudadanos aparecerán aquí cuando tomes un procedimiento.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = TYPE_CONFIG[item.type] || { icon: "alert-circle" };
          return (
            <TouchableOpacity
              style={[s.chatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() =>
                navigation.navigate("Emergencia", {
                  screen: "IncidentManagement",
                  params: { incidentId: item.id },
                })
              }
            >
              <View style={[s.chatAvatar, { backgroundColor: colors.greenTranslucent }]}>
                <Ionicons name={config.icon} size={24} color={colors.primary} />
              </View>
              <View style={s.chatContent}>
                <View style={s.chatHeader}>
                  <Text style={[s.chatName, { color: colors.textPrimary }]}>
                    {item.type || "Sin clasificar"}
                  </Text>
                  <View style={[s.chatBadge, { backgroundColor: colors.warning + "22" }]}>
                    <Text style={[s.chatBadgeText, { color: colors.warning }]}>En curso</Text>
                  </View>
                </View>
                <Text style={[s.chatFolio, { color: colors.textSecondary }]}>Folio #{item.id.slice(0, 7)}</Text>
                <Text style={[s.chatLastMsg, { color: colors.textSecondary }]}>
                  {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
                </Text>
              </View>
              <Text style={[s.chatArrow, { color: colors.textSecondary }]}>›</Text>
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
    navTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    navSub: { fontSize: FONT_SIZE.sm, color: colors.whiteTranslucent, marginTop: SPACING.xs },
    list: { padding: SPACING.md },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: "center", paddingHorizontal: SPACING.xl },
    emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.md },
    emptySub: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs, textAlign: "center" },
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
    chatName: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
    chatBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2, borderRadius: RADIUS.xs,
    },
    chatBadgeText: { fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.bold },
    chatFolio: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    chatLastMsg: { fontSize: FONT_SIZE.sm, marginTop: 2 },
    chatArrow: { fontSize: FONT_SIZE.xl, marginLeft: SPACING.sm },
  });
