import { useState, useEffect, useRef } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { listenAllActiveIncidents, listenAllCancelled, listenMyCases } from "../../services/incidentService";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const STATUS_CONFIG = {
  NO_CLASIFICADO: { label: "Sin clasificar", color: "#F57C00", bg: "#FFF3E0" },
  ACTIVO: { label: "Activo", color: "#D32F2F", bg: "#FFEBEE" },
  EN_CURSO: { label: "En curso", color: "#004B2B", bg: "#E8F5E9" },
  CERRADO: { label: "Finalizado", color: "#666666", bg: "#F5F5F5" },
  ANULADO: { label: "Anulado por usuario", color: "#9E9E9E", bg: "#EEEEEE" },
};

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car-outline", label: "Accidente de Tránsito" },
  ROBO: { icon: "shield-half-outline", label: "Robo o Asalto" },
  VIOLENCIA: { icon: "home-outline", label: "Violencia Intrafamiliar" },
  MEDICA: { icon: "pulse-outline", label: "Emergencia Médica" },
  OTRO: { icon: "alert-circle-outline", label: "Otro Incidente" },
};

const sortByTime = (a, b) => {
  const tA = a.createdAt?.toMillis?.() || 0;
  const tB = b.createdAt?.toMillis?.() || 0;
  return tB - tA;
};

const getElapsedTime = (createdAt) => {
  if (!createdAt) return "";
  const created = createdAt.toMillis ? createdAt.toMillis() : createdAt;
  const diffMs = Date.now() - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "< 1 min";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  if (diffHr < 24) return `${diffHr}h ${remainingMin}m`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ${diffHr % 24}h`;
};

export default function DispatchPanelScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("activos");
  const insets = useSafeAreaInsets();
  const [activos, setActivos] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [cancelados, setCancelados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "users", auth.currentUser?.uid)).then((snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    const unsubActive = listenAllActiveIncidents((data) => {
      setActivos(data.sort(sortByTime));
      setLoading(false);
    });
    const unsubMyCases = listenMyCases(auth.currentUser.uid, (data) => {
      setMyCases(data.sort(sortByTime));
      setLoading(false);
    });
    const unsubCancelled = listenAllCancelled((data) => {
      setCancelados(data.sort(sortByTime));
      setLoading(false);
    });
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      unsubActive();
      unsubMyCases();
      unsubCancelled();
      clearInterval(interval);
    };
  }, []);

  const handleTakeProcedure = (incidentId) => {
    Alert.alert("Tomar Procedimiento", "¿Confirmas asignación de este caso?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar Asignación",
        onPress: () => navigation.navigate("IncidentManagement", { incidentId }),
      },
    ]);
  };

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert("Finalizar Turno", "¿Deseas cerrar tu sesión actual?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Cerrar Sesión", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const renderCard = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || { icon: "alert-circle-outline", label: item.type || "Sin clasificar" };
    const isAssigned = item.officerId === auth.currentUser?.uid;
    const isActive = item.status === "ACTIVO";
    const isEnCurso = item.status === "EN_CURSO";
    const statusKey = item.status || "NO_CLASIFICADO";
    const statusCfg = STATUS_CONFIG[statusKey] || { label: statusKey, color: "#666", bg: "#F5F5F5" };
    const isFinal = statusKey === "CERRADO" || statusKey === "ANULADO";

    const handleCardPress = () => {
      if (isFinal) {
        showStatusInfo(item, config);
      } else if (isAssigned || isEnCurso) {
        navigation.navigate("IncidentManagement", { incidentId: item.id });
      } else {
        handleTakeProcedure(item.id);
      }
    };

    const showStatusInfo = (incident, cfg) => {
      const sCfg = STATUS_CONFIG[incident.status] || { label: incident.status, color: "#666" };
      Alert.alert(
        "Estado del Incidente",
        `Folio: #${incident.id.slice(0, 8).toUpperCase()}\nTipo: ${cfg.label}\nEstado: ${sCfg.label}\n\nEste caso ${incident.status === "ANULADO" ? "fue cancelado por el ciudadano" : "ya fue finalizado por un oficial"} y no requiere gestión adicional.`,
        [{ text: "Entendido" }]
      );
    };

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.95}
        onPress={handleCardPress}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? "#D32F2F" : isEnCurso ? "#004B2B" : "#9E9E9E" }]} />
            <Text style={[styles.cardTitle, { color: isActive ? "#D32F2F" : isEnCurso ? "#004B2B" : "#666666" }]}>{config.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.iconBox}>
            <Ionicons name={config.icon} size={24} color="#1A1A1A" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.citizenName}>{item.citizenAlias || "Usuario LENSE"}</Text>
            <Text style={styles.locationText}>📍 {item.address || (item.latitude ? `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}` : "Ubicación no disponible")}</Text>
            <Text style={styles.folioText}>Folio #{item.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.timeLabel}>⏱ {getElapsedTime(item.createdAt)}</Text>
          </View>
        </View>

        {isFinal && (
          <TouchableOpacity style={styles.viewStatusBtn} onPress={() => showStatusInfo(item, config)}>
            <Text style={styles.viewStatusBtnText}>Ver Estado →</Text>
          </TouchableOpacity>
        )}
        {!isFinal && isActive && !isAssigned && (
          <TouchableOpacity style={styles.assignBtn} onPress={() => handleTakeProcedure(item.id)}>
            <Text style={styles.assignBtnText}>Tomar Procedimiento →</Text>
          </TouchableOpacity>
        )}
        {!isFinal && (isAssigned || isEnCurso) && (
          <TouchableOpacity style={styles.enterBtn} onPress={() => navigation.navigate("IncidentManagement", { incidentId: item.id })}>
            <Text style={styles.enterBtnText}>Gestionar Incidente →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const misCasosActivos = myCases.filter((c) => c.status !== "ANULADO" && c.status !== "CERRADO");
  const data = activeTab === "activos" ? activos : activeTab === "cancelados" ? cancelados : misCasosActivos;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#004B2B" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#003A20" />

      {/* Menu Overlay */}
      {menuVisible && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.drawerContainer}>
            <View style={[styles.drawerHeader, { paddingTop: 24 + insets.top }]}>
              <TouchableOpacity onPress={() => setMenuVisible(false)} style={{ alignSelf: 'flex-end' }}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.drawerProfileRow}>
                <View style={styles.drawerAvatar}>
                  <MaterialCommunityIcons name="police-badge" size={32} color="#D4AF37" />
                </View>
                <View>
                  <Text style={styles.drawerRole}>OPERADOR ACTIVO</Text>
                  <Text style={styles.drawerName}>{userData?.alias || "Oficial"}</Text>
                  {userData?.rut && <Text style={styles.drawerUnit}>Placa: {userData.rut}</Text>}
                  <Text style={styles.drawerEmail}>{auth.currentUser?.email}</Text>
                </View>
              </View>
              <View style={styles.statusPillsRow}>
                <View style={styles.statusPillGreen}><Text style={styles.pillTextW}>● Turno Activo</Text></View>
                <View style={styles.statusPillDark}><Text style={styles.pillTextG}>Sector Sur</Text></View>
              </View>
            </View>

            <View style={styles.drawerStatsRow}>
              <View style={styles.drawerStat}><Text style={styles.drawerStatN}>7</Text><Text style={styles.drawerStatL}>Casos Hoy</Text></View>
              <View style={styles.drawerStat}><Text style={styles.drawerStatN}>5</Text><Text style={styles.drawerStatL}>Resueltos</Text></View>
              <View style={styles.drawerStat}><Text style={styles.drawerStatN}>6h 24m</Text><Text style={styles.drawerStatL}>En Turno</Text></View>
            </View>

            <View style={styles.drawerBody}>
              <Text style={styles.drawerNavTitle}>NAVEGACIÓN</Text>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMenuVisible(false); navigation.navigate("Perfil"); }}>
                <Ionicons name="person-outline" size={24} color="#004B2B" />
                <View style={styles.drawerItemTexts}>
                  <Text style={styles.drawerItemTitle}>Mi Perfil</Text>
                  <Text style={styles.drawerItemSub}>Datos del Oficial</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMenuVisible(false); navigation.navigate("Mapa"); }}>
                <Ionicons name="map-outline" size={24} color="#004B2B" />
                <View style={styles.drawerItemTexts}>
                  <Text style={styles.drawerItemTitle}>Mapa Global</Text>
                  <Text style={styles.drawerItemSub}>Unidades en terreno</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
              <Text style={styles.logoutText}>Finalizar Turno</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Main App */}
      <View style={[styles.navbar, { paddingTop: 12 + insets.top }]}>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navTitle}>● Turno Activo — Sector Sur</Text>
          <Text style={styles.navSub}>Central de Comunicaciones (CENCO)</Text>
        </View>
        <TouchableOpacity style={styles.avatarBtn} onPress={() => navigation.navigate("Perfil")}>
          <MaterialCommunityIcons name="police-badge" size={20} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      <View style={styles.dashboardStats}>
        <View style={styles.statBoxRed}>
          <View style={styles.statHeaderRow}><Text style={styles.statBoxTitleRed}>CRÍTICAS</Text><View style={styles.dotRed}/></View>
          <Text style={styles.statBoxNumRed}>{activos.length}</Text>
          <Text style={styles.statBoxSubRed}>activas ahora</Text>
        </View>
        <View style={styles.statBoxYellow}>
          <View style={styles.statHeaderRow}><Text style={styles.statBoxTitleYellow}>EN CURSO</Text><Ionicons name="notifications-outline" size={14} color="#D4AF37"/></View>
          <Text style={styles.statBoxNumYellow}>{myCases.length}</Text>
          <Text style={styles.statBoxSubYellow}>mis casos</Text>
        </View>
      </View>

      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Feed de Emergencias</Text>
        <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>● LIVE</Text></View>
      </View>
      <Text style={styles.feedSub}>Actualización en tiempo real</Text>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, activeTab === "activos" && styles.tabActive]} onPress={() => setActiveTab("activos")}>
          <Text style={[styles.tabText, activeTab === "activos" && styles.tabTextActive]}>Activos ({activos.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "mycases" && styles.tabActive]} onPress={() => setActiveTab("mycases")}>
          <Text style={[styles.tabText, activeTab === "mycases" && styles.tabTextActive]}>Mis Casos ({misCasosActivos.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "cancelados" && styles.tabActive]} onPress={() => setActiveTab("cancelados")}>
          <Text style={[styles.tabText, activeTab === "cancelados" && styles.tabTextActive]}>Cancelados ({cancelados.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={data.length === 0 ? [styles.emptyContainer, { paddingBottom: insets.bottom }] : [styles.list, { paddingBottom: insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={60} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>
              {activeTab === "activos" ? "Sin incidentes activos" : activeTab === "cancelados" ? "Sin cancelaciones" : "Sin casos asignados"}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === "activos" ? "Los nuevos requerimientos aparecerán aquí." : activeTab === "cancelados" ? "No hay incidentes cancelados por usuarios." : "Los casos que tomes aparecerán aquí."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F8" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.7)", zIndex: 100, justifyContent: "flex-start" },
  drawerContainer: { width: "80%", height: "100%", backgroundColor: "#FFFFFF" },
  drawerHeader: { backgroundColor: "#003A20", padding: 24, paddingTop: 50 },
  drawerProfileRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  drawerAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#004B2B", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#D4AF37" },
  drawerRole: { color: "#A0A0A0", fontSize: 10, fontWeight: "bold", letterSpacing: 1 },
  drawerName: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  drawerUnit: { color: "#E0E0E0", fontSize: 12 },
  drawerEmail: { color: "#A0A0A0", fontSize: 11, marginTop: 2 },
  statusPillsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  statusPillGreen: { backgroundColor: "#004B2B", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: "#4CAF50" },
  statusPillDark: { backgroundColor: "rgba(0,0,0,0.3)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  pillTextW: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  pillTextG: { color: "#A0A0A0", fontSize: 12, fontWeight: "bold" },
  drawerStatsRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  drawerStat: { flex: 1, alignItems: "center", paddingVertical: 16, borderRightWidth: 1, borderRightColor: "#E0E0E0" },
  drawerStatN: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  drawerStatL: { fontSize: 10, color: "#A0A0A0", marginTop: 4 },
  drawerBody: { padding: 24 },
  drawerNavTitle: { fontSize: 12, color: "#A0A0A0", fontWeight: "bold", letterSpacing: 1, marginBottom: 16 },
  drawerItem: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  drawerItemTexts: { flex: 1, marginLeft: 16 },
  drawerItemTitle: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  drawerItemSub: { fontSize: 12, color: "#666666" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "auto", padding: 24, borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  logoutText: { fontSize: 16, color: "#D32F2F", fontWeight: "bold", marginLeft: 12 },

  navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#003A20", paddingHorizontal: 16, paddingVertical: 12 },
  menuBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  navCenter: { alignItems: "center" },
  navTitle: { fontSize: 14, fontWeight: "bold", color: "#FFFFFF" },
  navSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#004B2B", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#D4AF37" },

  dashboardStats: { flexDirection: "row", padding: 16, gap: 16, backgroundColor: "#FFFFFF" },
  statBoxRed: { flex: 1, backgroundColor: "#FFF5F5", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#FFD6D6" },
  statBoxYellow: { flex: 1, backgroundColor: "#FFFAF0", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#FEF08A" },
  statHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statBoxTitleRed: { fontSize: 11, fontWeight: "bold", color: "#D32F2F", letterSpacing: 1 },
  statBoxTitleYellow: { fontSize: 11, fontWeight: "bold", color: "#B45309", letterSpacing: 1 },
  dotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D32F2F" },
  statBoxNumRed: { fontSize: 32, fontWeight: "900", color: "#D32F2F", marginVertical: 4 },
  statBoxNumYellow: { fontSize: 32, fontWeight: "900", color: "#B45309", marginVertical: 4 },
  statBoxSubRed: { fontSize: 11, color: "#F87171" },
  statBoxSubYellow: { fontSize: 11, color: "#D97706" },

  feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  feedTitle: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  liveBadge: { backgroundColor: "#004B2B", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  liveBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "bold" },
  feedSub: { fontSize: 12, color: "#666666", paddingHorizontal: 16, paddingBottom: 12 },

  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0", backgroundColor: "#FFFFFF" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#004B2B" },
  tabText: { fontSize: 14, color: "#666666", fontWeight: "600" },
  tabTextActive: { color: "#004B2B", fontWeight: "bold" },

  list: { padding: 16 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "bold", color: "#666666", marginTop: 12 },
  emptySub: { fontSize: 13, color: "#A0A0A0", marginTop: 8, textAlign: "center" },

  card: { backgroundColor: "#FFFFFF", borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#E0E0E0", elevation: 2, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cardTitle: { fontSize: 14, fontWeight: "bold" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: "bold" },
  timeLabel: { fontSize: 12, color: "#D32F2F", fontWeight: "bold" },
  cardBody: { flexDirection: "row", padding: 16, alignItems: "center" },
  iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#F4F6F8", justifyContent: "center", alignItems: "center", marginRight: 16 },
  cardInfo: { flex: 1 },
  citizenName: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  locationText: { fontSize: 13, color: "#666666", marginTop: 4 },
  folioText: { fontSize: 11, color: "#A0A0A0", marginTop: 4 },
  assignBtn: { backgroundColor: "#004B2B", paddingVertical: 14, alignItems: "center" },
  assignBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  enterBtn: { backgroundColor: "#F4F6F8", paddingVertical: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  enterBtnText: { color: "#004B2B", fontSize: 14, fontWeight: "bold" },
  viewStatusBtn: { backgroundColor: "#EEEEEE", paddingVertical: 14, alignItems: "center", borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  viewStatusBtnText: { color: "#666666", fontSize: 14, fontWeight: "bold" },
});