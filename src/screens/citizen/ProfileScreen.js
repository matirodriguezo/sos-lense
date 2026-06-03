import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { listenCitizenHistory } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [userData, setUserData] = useState(null);
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => {
    loadUserData();
    const user = auth.currentUser;
    if (user) {
      const unsub = listenCitizenHistory(user.uid, (data) => {
        setIncidentCount(data.length);
      });
      return unsub;
    }
  }, []);

  const loadUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      setUserData(snap.data());
    }
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <View style={[s.navbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ width: 36 }} />
        <Text style={[s.navTitle, { color: colors.textPrimary }]}>Mi Perfil</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.avatarSection}>
          <View style={[s.avatarLarge, { backgroundColor: colors.primary }]}>
            <Text style={[s.avatarLargeText, { color: colors.surface }]}>
              {auth.currentUser?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <Text style={[s.userName, { color: colors.textPrimary }]}>{userData?.alias || "Ciudadano"}</Text>
          <Text style={[s.userEmail, { color: colors.textSecondary }]}>{auth.currentUser?.email}</Text>
        </View>

        <View style={[s.themeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={colors.textPrimary} />
          <Text style={[s.themeLabel, { color: colors.textPrimary }]}>Modo oscuro</Text>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.textSecondary, true: colors.primary }} thumbColor={colors.white} />
        </View>

        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.statNumber, { color: colors.primary }]}>{incidentCount}</Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Incidentes</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[s.statNumber, { color: colors.primary }]}>
              {incidentCount > 0 ? 100 : 0}%
            </Text>
            <Text style={[s.statLabel, { color: colors.textSecondary }]}>Gestionados</Text>
          </View>
        </View>

        <View style={[s.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.infoTitle, { color: colors.textPrimary }]}>Información de la cuenta</Text>
          {[
            ["Nombre / Alias", userData?.alias || "—"],
            ["RUT", userData?.rut || "—"],
            ["Rol", "Ciudadano"],
            ["Email", auth.currentUser?.email],
          ].map(([label, value], i) => (
            <View key={label} style={[s.infoRow, { borderTopColor: colors.border }]}>
              <Text style={[s.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[s.infoValue, { color: colors.textPrimary }]}>{value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[s.historyBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => navigation.navigate("Historial")}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.primary} />
          <Text style={[s.historyBtnText, { color: colors.textPrimary }]}>Ver historial de incidentes</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.danger }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={[s.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    navbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SPACING.md, paddingVertical: SPACING.md - 4, borderBottomWidth: 1,
    },
    navTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.xl },
    avatarSection: { alignItems: "center", marginBottom: SPACING.xl },
    avatarLarge: {
      width: 80, height: 80, borderRadius: 40,
      justifyContent: "center", alignItems: "center", marginBottom: SPACING.md,
    },
    avatarLargeText: { fontSize: 32, fontWeight: FONT_WEIGHT.bold },
    userName: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold },
    userEmail: { fontSize: FONT_SIZE.sm, marginTop: SPACING.xs },
    themeRow: {
      flexDirection: "row", alignItems: "center", borderRadius: RADIUS.md,
      padding: SPACING.md, borderWidth: 1, marginBottom: SPACING.md, gap: SPACING.sm,
    },
    themeLabel: { flex: 1, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.medium },
    statsRow: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.lg },
    statCard: {
      flex: 1, borderRadius: RADIUS.md,
      padding: SPACING.md, alignItems: "center", borderWidth: 1,
    },
    statNumber: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold },
    statLabel: { fontSize: FONT_SIZE.xxs, marginTop: SPACING.xs },
    infoCard: {
      borderRadius: RADIUS.md, padding: SPACING.lg,
      borderWidth: 1, marginBottom: SPACING.md,
    },
    infoTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, marginBottom: SPACING.md },
    infoRow: {
      flexDirection: "row", justifyContent: "space-between",
      paddingVertical: SPACING.sm, borderTopWidth: 1,
    },
    infoLabel: { fontSize: FONT_SIZE.base },
    infoValue: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semiBold },
    historyBtn: {
      flexDirection: "row", alignItems: "center",
      borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, marginBottom: SPACING.md, gap: SPACING.sm,
    },
    historyBtnText: { flex: 1, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.medium },
    logoutBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: RADIUS.md, padding: SPACING.md, borderWidth: 1, gap: SPACING.sm,
    },
    logoutText: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.semiBold },
  });
