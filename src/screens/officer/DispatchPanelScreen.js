import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/firebaseConfig";
import {
  listenActiveIncidents,
  listenMyCases,
  assignOfficer,
} from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "🚗💥", label: "Accidente de Tránsito" },
  ROBO: { icon: "🦹", label: "Robo o Asalto" },
  VIOLENCIA: { icon: "⚔️", label: "Violencia Intrafamiliar" },
  OTRO: { icon: "⚠️", label: "Otro Incidente" },
};

export default function DispatchPanelScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("activos");
  const [activos, setActivos] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);

  useEffect(() => {
    const unsubActive = listenActiveIncidents((data) => {
      setActivos(data.filter((i) => !i.officerId));
      setLoading(false);
    });
    const unsubMyCases = listenMyCases(auth.currentUser.uid, (data) => {
      setMyCases(data);
      setLoading(false);
    });
    return () => {
      unsubActive();
      unsubMyCases();
    };
  }, []);

  const handleTakeProcedure = async (incidentId) => {
    setAssigning(incidentId);
    try {
      await assignOfficer(incidentId, auth.currentUser.uid);
      navigation.navigate("IncidentManagement", { incidentId });
    } catch {
      setAssigning(null);
    }
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro de que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const renderCard = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || { icon: "⚠️", label: item.type || "Sin clasificar" };
    const isActive = item.status === "ACTIVO";
    const isMine = item.status === "EN_CURSO";

    return (
      <TouchableOpacity
        style={[styles.card, SHADOWS.card]}
        activeOpacity={0.95}
        onPress={() => {
          if (isMine)
            navigation.navigate("IncidentManagement", { incidentId: item.id });
        }}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardIconWrap}>
            <Text style={styles.cardIcon}>{config.icon}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{config.label}</Text>
            <Text style={styles.cardFolio}>Folio #{item.id.slice(0, 7)}</Text>
            <View style={styles.locationRow}>
              <Text style={styles.locationPin}>📍</Text>
              <Text style={styles.locationText}>
                {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
              </Text>
            </View>
            {item.quick_requests ? (
              <Text style={styles.requestText}>Solicitud: {item.quick_requests}</Text>
            ) : null}
          </View>
        </View>

        {isActive && (
          <TouchableOpacity
            style={[styles.assignBtn, assigning === item.id && { opacity: 0.6 }]}
            onPress={() => handleTakeProcedure(item.id)}
            disabled={assigning === item.id}
          >
            {assigning === item.id ? (
              <ActivityIndicator size="small" color={COLORS.surface} />
            ) : (
              <Text style={styles.assignBtnText}>Tomar Procedimiento</Text>
            )}
          </TouchableOpacity>
        )}
        {isMine && (
          <TouchableOpacity
            style={styles.enterBtn}
            onPress={() =>
              navigation.navigate("IncidentManagement", { incidentId: item.id })
            }
          >
            <Text style={styles.enterBtnText}>Gestionar Incidente →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const data = activeTab === "activos" ? activos : myCases;

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.menuBtn} onPress={handleLogout}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>S.O.S. CARABINEROS</Text>
        <TouchableOpacity style={styles.avatarBtn} onPress={handleLogout}>
          <Text style={styles.avatarText}>
            {auth.currentUser?.email?.charAt(0).toUpperCase() || "O"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Panel de Recepción</Text>
        <Text style={styles.bannerSub}>Incidentes en tiempo real</Text>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activos" && styles.tabActive]}
          onPress={() => setActiveTab("activos")}
        >
          <Text
            style={[styles.tabText, activeTab === "activos" && styles.tabTextActive]}
          >
            Activos ({activos.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "mycases" && styles.tabActive]}
          onPress={() => setActiveTab("mycases")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "mycases" && styles.tabTextActive,
            ]}
          >
            Mis Casos ({myCases.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>
              {activeTab === "activos"
                ? "No hay incidentes activos"
                : "No tienes casos asignados"}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === "activos"
                ? "Los nuevos incidentes aparecerán aquí"
                : "Toma un procedimiento para verlo aquí"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  menuIcon: { fontSize: 22, color: COLORS.textPrimary },
  navTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary, letterSpacing: 0.5 },
  avatarBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
  banner: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  bannerTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.surface },
  bannerSub: { fontSize: FONT_SIZE.sm, color: "rgba(255,255,255,0.7)", marginTop: SPACING.xs },
  tabRow: {
    flexDirection: "row", backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, paddingVertical: SPACING.md - 4, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary, fontWeight: FONT_WEIGHT.medium },
  tabTextActive: { color: COLORS.primary, fontWeight: FONT_WEIGHT.bold },
  list: { padding: SPACING.md },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: SPACING.xl },
  emptyEmoji: { fontSize: 48, opacity: 0.4 },
  emptyTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.textSecondary, marginTop: SPACING.md },
  emptySub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs, textAlign: "center" },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.md - 2, borderWidth: 1, borderColor: COLORS.border,
  },
  cardRow: { flexDirection: "row", gap: SPACING.md - 4 },
  cardIconWrap: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    backgroundColor: COLORS.greenTranslucent, justifyContent: "center", alignItems: "center",
  },
  cardIcon: { fontSize: 24 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  cardFolio: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, marginTop: SPACING.xs },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: SPACING.xs },
  locationPin: { fontSize: 14, marginRight: SPACING.xs },
  locationText: { fontSize: FONT_SIZE.sm, color: COLORS.textPrimary, flex: 1 },
  requestText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontStyle: "italic", marginTop: SPACING.xs },
  assignBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, height: 40,
    justifyContent: "center", alignItems: "center", marginTop: SPACING.md - 4,
  },
  assignBtnText: { color: COLORS.surface, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold },
  enterBtn: {
    backgroundColor: COLORS.background, borderRadius: RADIUS.sm, height: 40,
    justifyContent: "center", alignItems: "center", marginTop: SPACING.md - 4,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  enterBtnText: { color: COLORS.primary, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold },
});
