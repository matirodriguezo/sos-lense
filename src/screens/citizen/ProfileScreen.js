import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { listenCitizenHistory } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

export default function ProfileScreen({ navigation }) {
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navbar}>
        <View style={{ width: 36 }} />
        <Text style={styles.navTitle}>Mi Perfil</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {auth.currentUser?.email?.charAt(0).toUpperCase() || "U"}
            </Text>
          </View>
          <Text style={styles.userName}>{userData?.alias || "Ciudadano"}</Text>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{incidentCount}</Text>
            <Text style={styles.statLabel}>Incidentes</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {incidentCount > 0
                ? Math.round((incidentCount / incidentCount) * 100)
                : 0}%
            </Text>
            <Text style={styles.statLabel}>Gestionados</Text>
          </View>
        </View>

        <View style={[styles.infoCard, SHADOWS.card]}>
          <Text style={styles.infoTitle}>Información de la cuenta</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nombre / Alias</Text>
            <Text style={styles.infoValue}>{userData?.alias || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RUT</Text>
            <Text style={styles.infoValue}>{userData?.rut || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rol</Text>
            <Text style={styles.infoValue}>Ciudadano</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{auth.currentUser?.email}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate("Historial")}
        >
          <Text style={styles.historyBtnIcon}>📋</Text>
          <Text style={styles.historyBtnText}>Ver historial de incidentes</Text>
          <Text style={styles.historyBtnArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  navTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  content: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  avatarSection: { alignItems: "center", marginBottom: SPACING.xl },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center",
    marginBottom: SPACING.md,
  },
  avatarLargeText: { color: COLORS.surface, fontSize: 32, fontWeight: FONT_WEIGHT.bold },
  userName: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  userEmail: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  statsRow: { flexDirection: "row", gap: SPACING.md, marginBottom: SPACING.lg },
  statCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  statNumber: { fontSize: FONT_SIZE.xxl, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  statLabel: { fontSize: FONT_SIZE.xxs, color: COLORS.textSecondary, marginTop: SPACING.xs },
  infoCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  infoTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, marginBottom: SPACING.md },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  infoLabel: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  infoValue: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.semiBold },
  historyBtn: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
  },
  historyBtnIcon: { fontSize: 20, marginRight: SPACING.md },
  historyBtnText: { flex: 1, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.medium },
  historyBtnArrow: { fontSize: FONT_SIZE.lg, color: COLORS.textSecondary },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.danger, gap: SPACING.sm,
  },
  logoutIcon: { fontSize: 18 },
  logoutText: { fontSize: FONT_SIZE.base, color: COLORS.danger, fontWeight: FONT_WEIGHT.semiBold },
});
