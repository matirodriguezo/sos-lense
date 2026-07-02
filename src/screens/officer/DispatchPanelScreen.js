import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { listenAllActiveIncidents, listenAllCancelled, listenMyCases } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { getShiftStart } from "../../services/userStore";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
const STATUS_CONFIG = {
  NO_CLASIFICADO: { label: "Sin clasificar", color: "#F57C00", bg: "#FFF3E0" },
  ACTIVO: { label: "Activo", color: "#D32F2F", bg: "#FFEBEE" },
  EN_CURSO: { label: "En curso", color: "#0B5E2E", bg: "#E8F5E9" },
  CERRADO: { label: "Finalizado", color: "#666666", bg: "#F5F5F5" },
  ANULADO: { label: "Anulado por usuario", color: "#9E9E9E", bg: "#EEEEEE" },
};

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car-outline", label: "Accidente de Tránsito", gifPath: require("../../../assets/gifs/Accidente de transito.gif") },
  ROBO: { icon: "shield-half-outline", label: "Robo o Asalto", gifPath: require("../../../assets/gifs/Robo o Asalto.gif") },
  VIOLENCIA: { icon: "home-outline", label: "Violencia Intrafamiliar", gifPath: require("../../../assets/gifs/Violencia.gif") },
  MEDICA: { icon: "pulse-outline", label: "Emergencia Médica", gifPath: require("../../../assets/gifs/Emergencia Medica.gif") },
  OTRO: { icon: "alert-circle-outline", label: "Otro Incidente", gifPath: null },
};

const sortByTime = (a, b) => {
  const tA = a.createdAt?.toMillis?.() || 0;
  const tB = b.createdAt?.toMillis?.() || 0;
  return tB - tA;
};

  const formatElapsed = (ms) => {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getShiftTime = () => {
    const start = getShiftStart();
    if (!start) return "—";
    return formatElapsed(Date.now() - start);
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
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState("activos");
  const insets = useSafeAreaInsets();
  const [activos, setActivos] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [cancelados, setCancelados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [userData, setUserData] = useState(null);

  const s = useMemo(() => makeStyles(colors), [colors]);

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
    Alert.alert("Finalizar Turno", "¿Estás seguro de finalizar tu turno? Los casos no cerrados se perderán.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Finalizar Turno", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const renderCard = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || { icon: "alert-circle-outline", label: item.type || "Sin clasificar" };
    const isAssignedToMe = item.officerId === auth.currentUser?.uid;
    const isTakenByOther = !!item.officerId && !isAssignedToMe;
    const isActive = item.status === "ACTIVO" || item.status === "NO_CLASIFICADO";
    const isEnCurso = item.status === "EN_CURSO";
    const statusKey = item.status || "NO_CLASIFICADO";
    const statusCfg = STATUS_CONFIG[statusKey] || { label: statusKey, color: "#666", bg: "#F5F5F5" };
    const isFinal = statusKey === "CERRADO" || statusKey === "ANULADO";

    const handleCardPress = () => {
      if (isFinal || isTakenByOther) {
        showStatusInfo(item, config);
      } else if (isAssignedToMe || isEnCurso) {
        navigation.navigate("IncidentManagement", { incidentId: item.id });
      } else {
        handleTakeProcedure(item.id);
      }
    };

    const showStatusInfo = (incident, cfg) => {
      const sCfg = STATUS_CONFIG[incident.status] || { label: incident.status, color: "#666" };
      let message = "";
      if (incident.status === "ANULADO") {
        message = "Este caso fue cancelado por el ciudadano y no requiere gestión adicional.";
      } else if (incident.status === "CERRADO") {
        message = "Este caso ya fue finalizado por un oficial y no requiere gestión adicional.";
      } else if (isTakenByOther) {
        message = `Este caso está siendo gestionado por ${incident.officerAlias || "otro oficial"}.`;
      } else {
        message = "Este caso está activo y requiere atención.";
      }

      Alert.alert(
        "Estado del Incidente",
        `Folio: #${incident.id.slice(0, 8).toUpperCase()}\nTipo: ${cfg.label}\nEstado: ${sCfg.label}\n\n${message}`,
        [{ text: "Entendido" }]
      );
    };

    const cardTitleColor = isActive ? colors.badgeRed : isEnCurso ? colors.primary : colors.textSecondary;

    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.95}
        onPress={handleCardPress}
      >
        <View style={[s.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={s.cardHeaderLeft}>
            <View style={[s.statusDot, { backgroundColor: isActive ? colors.badgeRed : isEnCurso ? colors.primary : colors.emptyText }]} />
            <Text style={[s.cardTitle, { color: cardTitleColor }]}>{config.label}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[s.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        <View style={s.cardBody}>
          <View style={[s.iconBox, { backgroundColor: colors.officerBg }]}>
            {config.gifPath ? (
              <Image source={config.gifPath} style={s.cardGif} resizeMode="contain" />
            ) : (
              <Ionicons name={config.icon} size={24} color={colors.textPrimary} />
            )}
          </View>
          <View style={s.cardInfo}>
            <Text style={[s.citizenName, { color: colors.textPrimary }]}>{item.citizenAlias || "Usuario LENSE"}</Text>
            <Text style={[s.locationText, { color: colors.textSecondary }]}>{item.address || (item.latitude ? `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}` : "Ubicación no disponible")}</Text>
            <Text style={[s.folioText, { color: colors.emptyText }]}>Folio #{item.id.slice(0, 8).toUpperCase()}</Text>
            <Text style={[s.timeLabel, { color: colors.badgeRed }]}>{getElapsedTime(item.createdAt)}</Text>
          </View>
        </View>

        {isFinal && (
          <TouchableOpacity style={[s.viewStatusBtn, { backgroundColor: colors.officerBg, borderTopColor: colors.border }]} onPress={() => showStatusInfo(item, config)}>
            <Text style={[s.viewStatusBtnText, { color: colors.textSecondary }]}>Ver Estado →</Text>
          </TouchableOpacity>
        )}
        {!isFinal && isTakenByOther && (
          <TouchableOpacity style={[s.viewStatusBtn, { backgroundColor: colors.officerBg, borderTopColor: colors.border }]} onPress={() => showStatusInfo(item, config)}>
            <Text style={[s.viewStatusBtnText, { color: colors.textSecondary }]}>Tomado por {item.officerAlias || "otro oficial"} →</Text>
          </TouchableOpacity>
        )}
        {!isFinal && !isTakenByOther && !isAssignedToMe && (
          <TouchableOpacity style={[s.assignBtn, { backgroundColor: colors.primary }]} onPress={() => handleTakeProcedure(item.id)}>
            <Text style={[s.assignBtnText, { color: colors.white }]}>Tomar Procedimiento →</Text>
          </TouchableOpacity>
        )}
        {!isFinal && isAssignedToMe && (
          <TouchableOpacity style={[s.enterBtn, { backgroundColor: colors.officerBg, borderTopColor: colors.border }]} onPress={() => {
            Alert.alert("Gestionar incidente", "¿Confirmas que deseas gestionar este caso?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Gestionar", onPress: () => navigation.navigate("IncidentManagement", { incidentId: item.id }) },
            ]);
          }}>
            <Text style={[s.enterBtnText, { color: colors.primary }]}>Gestionar Incidente →</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const misCasosActivos = myCases.filter((c) => c.status !== "ANULADO" && c.status !== "CERRADO");
  const data = activeTab === "activos" ? activos : activeTab === "cancelados" ? cancelados : misCasosActivos;

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.officerBg }]}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.officerBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.drawerHeaderBg} />

      {/* Menu Overlay */}
      {menuVisible && (
        <TouchableOpacity style={[s.overlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[s.drawerContainer, { backgroundColor: colors.surface }]}>
            <View style={[s.drawerHeader, { backgroundColor: colors.drawerHeaderBg, paddingTop: 24 + insets.top }]}>
              <TouchableOpacity onPress={() => setMenuVisible(false)} style={{ alignSelf: 'flex-end' }}>
                <Ionicons name="close" size={28} color={colors.white} />
              </TouchableOpacity>
              <View style={s.drawerProfileRow}>
                <View style={[s.drawerAvatar, { backgroundColor: colors.primary, borderColor: colors.gold }]}>
                  <MaterialCommunityIcons name="police-badge" size={32} color={colors.gold} />
                </View>
                <View>
                  <Text style={s.drawerRole}>OPERADOR ACTIVO</Text>
                  <Text style={s.drawerName}>{userData?.alias || "Oficial"}</Text>
                  {userData?.rut && <Text style={s.drawerUnit}>Placa: {userData.rut}</Text>}
                  <Text style={[s.drawerEmail, { color: colors.whiteTranslucent }]}>{auth.currentUser?.email}</Text>
                </View>
              </View>
              <View style={s.statusPillsRow}>
                <View style={[s.statusPillGreen, { backgroundColor: colors.primary, borderColor: colors.success }]}><Text style={[s.pillTextW, { color: colors.white }]}>● Turno Activo</Text></View>
                <View style={[s.statusPillDark, { backgroundColor: colors.blackTranslucent }]}><Text style={[s.pillTextG, { color: colors.whiteTranslucent }]}>Sector Sur</Text></View>
              </View>
            </View>

            <View style={[s.drawerStatsRow, { borderBottomColor: colors.border }]}>
              <View style={[s.drawerStat, { borderRightColor: colors.border }]}><Text style={[s.drawerStatN, { color: colors.textPrimary }]}>7</Text><Text style={[s.drawerStatL, { color: colors.emptyText }]}>Casos Hoy</Text></View>
              <View style={[s.drawerStat, { borderRightColor: colors.border }]}><Text style={[s.drawerStatN, { color: colors.textPrimary }]}>5</Text><Text style={[s.drawerStatL, { color: colors.emptyText }]}>Resueltos</Text></View>
              <View style={s.drawerStat}><Text style={[s.drawerStatN, { color: colors.textPrimary }]}>{getShiftTime()}</Text><Text style={[s.drawerStatL, { color: colors.emptyText }]}>En Turno</Text></View>
            </View>

            <View style={s.drawerBody}>
              <Text style={[s.drawerNavTitle, { color: colors.emptyText }]}>NAVEGACIÓN</Text>
              <TouchableOpacity style={s.drawerItem} onPress={() => { setMenuVisible(false); Alert.alert("Mi Perfil", "¿Deseas ver tu perfil?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Ver Perfil", onPress: () => navigation.navigate("Perfil") },
              ]); }}>
                <Ionicons name="person-outline" size={24} color={colors.primary} />
                <View style={s.drawerItemTexts}>
                  <Text style={[s.drawerItemTitle, { color: colors.textPrimary }]}>Mi Perfil</Text>
                  <Text style={[s.drawerItemSub, { color: colors.textSecondary }]}>Datos del Oficial</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.emptyText} />
              </TouchableOpacity>
              <TouchableOpacity style={s.drawerItem} onPress={() => { setMenuVisible(false); Alert.alert("Mapa Global", "¿Deseas abrir el mapa de unidades?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Abrir Mapa", onPress: () => navigation.navigate("Mapa") },
              ]); }}>
                <Ionicons name="map-outline" size={24} color={colors.primary} />
                <View style={s.drawerItemTexts}>
                  <Text style={[s.drawerItemTitle, { color: colors.textPrimary }]}>Mapa Global</Text>
                  <Text style={[s.drawerItemSub, { color: colors.textSecondary }]}>Unidades en terreno</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.emptyText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.logoutBtn, { borderTopColor: colors.border }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.badgeRed} />
              <Text style={[s.logoutText, { color: colors.badgeRed }]}>Finalizar Turno</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Main App */}
      <View style={[s.navbar, { backgroundColor: colors.drawerHeaderBg, paddingTop: 12 + insets.top }]}>
        <TouchableOpacity style={[s.menuBtn, { backgroundColor: colors.whiteTranslucent }]} onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={28} color={colors.white} />
        </TouchableOpacity>
        <View style={s.navCenter}>
          <Text style={s.navTitle}>● Turno Activo — Sector Sur</Text>
          <Text style={s.navSub}>Central de Comunicaciones (CENCO)</Text>
        </View>
        <TouchableOpacity style={[s.avatarBtn, { backgroundColor: colors.primary, borderColor: colors.gold }]} onPress={() => navigation.navigate("Perfil")}>
          <MaterialCommunityIcons name="police-badge" size={20} color={colors.gold} />
        </TouchableOpacity>
      </View>

      <View style={[s.dashboardStats, { backgroundColor: colors.surface }]}>
        <View style={[s.statBoxRed, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}>
          <View style={s.statHeaderRow}><Text style={[s.statBoxTitleRed, { color: colors.badgeRed }]}>CRÍTICAS</Text><View style={[s.dotRed, { backgroundColor: colors.badgeRed }]}/></View>
          <Text style={[s.statBoxNumRed, { color: colors.badgeRed }]}>{activos.length}</Text>
          <Text style={[s.statBoxSubRed, { color: colors.badgeRed }]}>activas ahora</Text>
        </View>
        <View style={[s.statBoxYellow, { backgroundColor: colors.statusYellowBg, borderColor: colors.statusYellowBorder }]}>
          <View style={s.statHeaderRow}><Text style={[s.statBoxTitleYellow, { color: colors.warning }]}>EN CURSO</Text><Ionicons name="notifications-outline" size={14} color={colors.gold}/></View>
          <Text style={[s.statBoxNumYellow, { color: colors.warning }]}>{myCases.length}</Text>
          <Text style={[s.statBoxSubYellow, { color: colors.warning }]}>mis casos</Text>
        </View>
      </View>

      <View style={s.feedHeader}>
        <Text style={[s.feedTitle, { color: colors.textPrimary }]}>Feed de Emergencias</Text>
        <View style={[s.liveBadge, { backgroundColor: colors.primary }]}><Text style={s.liveBadgeText}>● LIVE</Text></View>
      </View>
      <Text style={[s.feedSub, { color: colors.textSecondary }]}>Actualización en tiempo real</Text>

      <View style={[s.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={[s.tab, activeTab === "activos" && { borderBottomColor: colors.primary }]} onPress={() => { if (activeTab !== "activos") Alert.alert("Cambiar vista", "¿Ver todos los incidentes activos?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver", onPress: () => setActiveTab("activos") },
        ]); }}>
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === "activos" && { color: colors.primary, fontWeight: "bold" }]}>Activos ({activos.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "mycases" && { borderBottomColor: colors.primary }]} onPress={() => { if (activeTab !== "mycases") Alert.alert("Cambiar vista", "¿Ver tus casos asignados?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver", onPress: () => setActiveTab("mycases") },
        ]); }}>
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === "mycases" && { color: colors.primary, fontWeight: "bold" }]}>Mis Casos ({misCasosActivos.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === "cancelados" && { borderBottomColor: colors.primary }]} onPress={() => { if (activeTab !== "cancelados") Alert.alert("Cambiar vista", "¿Ver incidentes cancelados?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Ver", onPress: () => setActiveTab("cancelados") },
        ]); }}>
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === "cancelados" && { color: colors.primary, fontWeight: "bold" }]}>Cancelados ({cancelados.length})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={data.length === 0 ? [s.emptyContainer, { paddingBottom: insets.bottom }] : [s.list, { paddingBottom: insets.bottom }]}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={10}
        initialNumToRender={6}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={60} color={colors.border} />
            <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>
              {activeTab === "activos" ? "Sin incidentes activos" : activeTab === "cancelados" ? "Sin cancelaciones" : "Sin casos asignados"}
            </Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>
              {activeTab === "activos" ? "Los nuevos requerimientos aparecerán aquí." : activeTab === "cancelados" ? "No hay incidentes cancelados por usuarios." : "Los casos que tomes aparecerán aquí."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, justifyContent: "flex-start" },
    drawerContainer: { width: "80%", height: "100%" },
    drawerHeader: { padding: 24, paddingTop: 50 },
    drawerProfileRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
    drawerAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", borderWidth: 2 },
    drawerRole: { color: colors.emptyText, fontSize: 10, fontWeight: "bold", letterSpacing: 1 },
    drawerName: { color: colors.white, fontSize: 18, fontWeight: "bold" },
    drawerUnit: { color: colors.textSecondary, fontSize: 12 },
    drawerEmail: { color: colors.emptyText, fontSize: 11, marginTop: 2 },
    statusPillsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
    statusPillGreen: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
    statusPillDark: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    pillTextW: { fontSize: 12, fontWeight: "bold" },
    pillTextG: { fontSize: 12, fontWeight: "bold" },
    drawerStatsRow: { flexDirection: "row", borderBottomWidth: 1 },
    drawerStat: { flex: 1, alignItems: "center", paddingVertical: 16, borderRightWidth: 1 },
    drawerStatN: { fontSize: 18, fontWeight: "bold" },
    drawerStatL: { fontSize: 10, marginTop: 4 },
    drawerBody: { padding: 24 },
    drawerNavTitle: { fontSize: 12, fontWeight: "bold", letterSpacing: 1, marginBottom: 16 },
    drawerItem: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
    drawerItemTexts: { flex: 1, marginLeft: 16 },
    drawerItemTitle: { fontSize: 16, fontWeight: "bold" },
    drawerItemSub: { fontSize: 12 },
    logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "auto", padding: 24, borderTopWidth: 1 },
    logoutText: { fontSize: 16, fontWeight: "bold", marginLeft: 12 },

    navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
    menuBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    navCenter: { alignItems: "center" },
    navTitle: { fontSize: 14, fontWeight: "bold", color: colors.white },
    navSub: { fontSize: 11, color: colors.whiteTranslucent, marginTop: 2 },
    avatarBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", borderWidth: 1 },

    dashboardStats: { flexDirection: "row", padding: 16, gap: 16 },
    statBoxRed: { flex: 1, borderRadius: 12, padding: 16, borderWidth: 1 },
    statBoxYellow: { flex: 1, borderRadius: 12, padding: 16, borderWidth: 1 },
    statHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    statBoxTitleRed: { fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
    statBoxTitleYellow: { fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
    dotRed: { width: 8, height: 8, borderRadius: 4 },
    statBoxNumRed: { fontSize: 32, fontWeight: "900", marginVertical: 4 },
    statBoxNumYellow: { fontSize: 32, fontWeight: "900", marginVertical: 4 },
    statBoxSubRed: { fontSize: 11 },
    statBoxSubYellow: { fontSize: 11 },

    feedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
    feedTitle: { fontSize: 16, fontWeight: "bold" },
    liveBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    liveBadgeText: { color: colors.white, fontSize: 10, fontWeight: "bold" },
    feedSub: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 12 },

    tabRow: { flexDirection: "row", borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
    tabText: { fontSize: 14, fontWeight: "600" },

    list: { padding: 16 },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: "center", paddingHorizontal: 32 },
    emptyTitle: { fontSize: 16, fontWeight: "bold", marginTop: 12 },
    emptySub: { fontSize: 13, marginTop: 8, textAlign: "center" },

    card: { borderRadius: 12, marginBottom: 16, borderWidth: 1, elevation: 2, shadowColor: colors.textPrimary, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 4 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
    cardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    cardTitle: { fontSize: 14, fontWeight: "bold" },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginLeft: 8 },
    statusBadgeText: { fontSize: 11, fontWeight: "bold" },
    timeLabel: { fontSize: 12, fontWeight: "bold" },
    cardBody: { flexDirection: "row", padding: 16, alignItems: "center" },
    iconBox: { width: 48, height: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 16 },
    cardGif: { width: 32, height: 32 },
    cardInfo: { flex: 1 },
    citizenName: { fontSize: 16, fontWeight: "bold" },
    locationText: { fontSize: 13, marginTop: 4 },
    folioText: { fontSize: 11, marginTop: 4 },
    assignBtn: { paddingVertical: 14, alignItems: "center" },
    assignBtnText: { fontSize: 14, fontWeight: "bold" },
    enterBtn: { paddingVertical: 14, alignItems: "center", borderTopWidth: 1 },
    enterBtnText: { fontSize: 14, fontWeight: "bold" },
    viewStatusBtn: { paddingVertical: 14, alignItems: "center", borderTopWidth: 1 },
    viewStatusBtnText: { fontSize: 14, fontWeight: "bold" },
  });
