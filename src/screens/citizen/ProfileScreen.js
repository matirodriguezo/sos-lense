import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logout, getUser } from "../../services/authService";
import { listCitizenHistory } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function CitizenProfileScreen({ navigation }) {
  const { colors, isDark, toggleTheme } = useTheme();
  const [userData, setUserData] = useState(null);
  const [caseCount, setCaseCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const user = await getUser();
      if (!mounted) return;
      setUserData(user);
      try {
        const cases = await listCitizenHistory();
        setCaseCount(cases.length);
      } catch (e) {
        console.warn("[CitizenProfile] cases load failed:", e.message);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn("[CitizenProfile] logout error:", e.message);
    }
  };

  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <View style={[s.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.primary }]}>S.O.S. CARABINEROS</Text>
        <View style={[s.miniAvatar, { backgroundColor: colors.greenTranslucent }]}>
          <Ionicons name="person" size={16} color={colors.primary} />
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={s.avatarSection}>
          <View style={[s.avatarLarge, { backgroundColor: colors.greenTranslucent, borderColor: colors.primary }]}>
            <Ionicons name="person" size={48} color={colors.primary} />
          </View>
          <View style={[s.serviceBadge, { borderColor: colors.background }]}><Text style={s.serviceBadgeText}>● Ciudadano</Text></View>
          <Text style={[s.userName, { color: colors.textPrimary }]}>{userData?.alias || "Ciudadano"}</Text>
          {userData?.rut && <Text style={[s.userRank, { color: colors.primary }]}>RUT: {userData.rut}</Text>}
        </View>

        <View style={[s.themeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={colors.textPrimary} />
          <Text style={[s.themeLabel, { color: colors.textPrimary }]}>Modo oscuro</Text>
          <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.textSecondary, true: colors.primary }} thumbColor={colors.white} />
        </View>

        <View style={[s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.dataHeader}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.dataTitle, { color: colors.textSecondary }]}>NOMBRE / ALIAS</Text>
          </View>
          <Text style={[s.dataValueBig, { color: colors.textPrimary }]}>{userData?.alias || "—"}</Text>
        </View>

        <View style={[s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.dataHeader}>
            <MaterialCommunityIcons name="badge-account-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.dataTitle, { color: colors.textSecondary }]}>RUT REGISTRADO</Text>
          </View>
          <Text style={[s.dataValueBig, { color: colors.textPrimary }]}>{userData?.rut || "—"}</Text>
          <Text style={[s.dataSub, { color: colors.textSecondary }]}>Identidad Validada</Text>
        </View>

        <View style={[s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.dataHeader}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.dataTitle, { color: colors.textSecondary }]}>CORREO ELECTRÓNICO</Text>
          </View>
          <Text style={[s.dataValue, { color: colors.textPrimary }]}>{userData?.email || "—"}</Text>
        </View>

        <View style={[s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.dataHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.dataTitle, { color: colors.textSecondary }]}>UNIDAD ASIGNADA</Text>
          </View>
          <Text style={[s.dataValue, { color: colors.textPrimary }]}>Comunidad Sorda (CENCO)</Text>
          <Text style={[s.dataSub, { color: colors.textSecondary }]}>Región Metropolitana</Text>
        </View>

        <View style={[s.dataCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={s.dataHeader}>
            <Ionicons name="folder-open-outline" size={20} color={colors.textSecondary} />
            <Text style={[s.dataTitle, { color: colors.textSecondary }]}>CASOS HISTÓRICOS</Text>
          </View>
          <Text style={[s.dataValueBig, { color: colors.textPrimary }]}>{caseCount}</Text>
        </View>

        <TouchableOpacity style={[s.logoutBtn, { backgroundColor: colors.surface, borderColor: colors.badgeRed }]} onPress={() => {
          Alert.alert("Cerrar Sesión", "¿Estás seguro de cerrar tu sesión?", [
            { text: "Cancelar", style: "cancel" },
            { text: "Salir", style: "destructive", onPress: handleLogout },
          ]);
        }}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[s.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
    headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    miniAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

    scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },
    avatarSection: { alignItems: "center", marginBottom: 24 },
    avatarLarge: { width: 100, height: 100, borderRadius: 50, justifyContent: "center", alignItems: "center", borderWidth: 3 },
    serviceBadge: { backgroundColor: colors.success, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: -12, borderWidth: 2 },
    serviceBadgeText: { color: colors.white, fontSize: 10, fontWeight: "bold" },
    userName: { fontSize: 22, fontWeight: "bold", marginTop: 12 },
    userRank: { fontSize: 14, fontWeight: "600", marginTop: 4 },

    themeRow: {
      flexDirection: "row", alignItems: "center", borderRadius: 12,
      padding: 16, borderWidth: 1, marginBottom: 16, gap: 8,
    },
    themeLabel: { flex: 1, fontSize: 14, fontWeight: "500" },

    dataCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
    dataHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    dataTitle: { fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
    dataValueBig: { fontSize: 28, fontWeight: "900" },
    dataValue: { fontSize: 18, fontWeight: "bold" },
    dataSub: { fontSize: 12, marginTop: 4 },

    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "auto", padding: 16, borderRadius: 12, borderWidth: 1, gap: 8 },
    logoutText: { fontSize: 14, fontWeight: "bold" },
  });
