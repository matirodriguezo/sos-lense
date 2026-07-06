import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  listenAllActiveIncidents,
  listenAllCancelled,
  listenMyCases,
  listenIncidentById,
  listenMessages,
  sendMessage,
  addQuickRequest,
  assignOfficer,
  sendSystemMessage,
  closeIncident,
  markMessageAsRead,
  updateParticipantStatus,
  OFFICER_STATUS,
  CITIZEN_STATUS,
  COMM_MODE,
} from "../../services/incidentService";
import { getCurrentAlias, getShiftStart } from "../../services/userStore";
import MessageBubble from "../../components/MessageBubble";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const SIDEBAR_WIDTH = 340;
const STATUS_CONFIG = {
  NO_CLASIFICADO: { label: "Sin clasificar", color: "#F57C00" },
  ACTIVO: { label: "Activo", color: "#D32F2F" },
  EN_CURSO: { label: "En curso", color: "#0B5E2E" },
  CERRADO: { label: "Finalizado", color: "#666" },
  ANULADO: { label: "Anulado", color: "#9E9E9E" },
};

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car-outline", label: "Accidente de Tránsito", color: "#F59E0B" },
  ROBO: { icon: "shield-half-outline", label: "Robo o Asalto", color: "#EF4444" },
  VIOLENCIA: { icon: "home-outline", label: "Violencia Intrafamiliar", color: "#8B5CF6" },
  MEDICA: { icon: "pulse-outline", label: "Emergencia Médica", color: "#10B981" },
  OTRO: { icon: "alert-circle-outline", label: "Otro", color: "#6B7280" },
};

const QUICK_RESPONSES = [
  "¿Está seguro?",
  "Unidad en camino",
  "Proceda con precaución",
  "Mantenga la calma",
];

const DISPATCH_OPTIONS = [
  { id: 1, icon: "police-badge", label: "Despachar Patrulla", color: "#1976D2" },
  { id: 2, icon: "ambulance", label: "Solicitar SAMU", color: "#D32F2F" },
  { id: 3, icon: "chat-processing", label: "Chat de Texto", color: "#424242" },
];

const formatElapsed = (createdAt) => {
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

const formatShiftTime = () => {
  const start = getShiftStart();
  if (!start) return "—";
  const totalSec = Math.floor((Date.now() - start) / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const ACTIVE_STATUSES = ["NO_CLASIFICADO", "ACTIVO", "EN_CURSO"];

const CITIZEN_STATUS_LABELS = {
  CITIZEN_ALERT_SENT: { label: "Alerta enviada", color: "#E040FB" },
  CITIZEN_IDLE: { label: "Inactivo", color: "#94A3B8" },
  CITIZEN_CLASSIFYING: { label: "Clasificando", color: "#F59E0B" },
  CITIZEN_IN_CALL: { label: "En videollamada", color: "#22C55E" },
  CITIZEN_CHAT_ONLY: { label: "En chat", color: "#3B82F6" },
  CITIZEN_IN_FAKE_APP: { label: "En AppCamuflaje", color: "#F97316" },
};

const COMM_MODE_LABELS = {
  NOT_SET: { label: "Sin definir", color: "#94A3B8" },
  VIDEO_CALL: { label: "Videollamada", color: "#22C55E" },
  CHAT_ONLY: { label: "Solo Chat", color: "#3B82F6" },
  ALERT_ONLY: { label: "Alerta de ubicación", color: "#F59E0B" },
};

function WebVideoCallPanel({ incidentDetail, onClose }) {
  const [vpConnecting, setVpConnecting] = useState(true);
  const [vpCallActive, setVpCallActive] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => { setVpConnecting(false); setVpCallActive(true); }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <View style={vpStyles.container}>
      <View style={vpStyles.header}>
        <Text style={vpStyles.headerTitle}>📱 Videollamada</Text>
        <TouchableOpacity onPress={onClose} style={vpStyles.closeBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={vpStyles.body}>
        {vpConnecting ? (
          <View style={vpStyles.centerContent}>
            <Animated.View style={[vpStyles.pulseCircle, { opacity: pulseOpacity }]}>
              <MaterialCommunityIcons name="cellphone-link" size={40} color="#4ADE80" />
            </Animated.View>
            <Text style={vpStyles.connectingText}>Conectando...</Text>
            <Text style={vpStyles.connectingSub}>Estableciendo enlace</Text>
            <ActivityIndicator size="small" color="#4ADE80" style={{ marginTop: 12 }} />
          </View>
        ) : (
          <View style={vpStyles.centerContent}>
            <MaterialCommunityIcons name="video" size={56} color="#4ADE80" />
            <Text style={vpStyles.connectedText}>VIDEOLLAMADA ACTIVA</Text>
            <Text style={vpStyles.connectedSub}>Conexión establecida</Text>
            <Text style={vpStyles.elapsedText}>
              {new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        )}
      </View>
      {incidentDetail?.participantStatus?.citizen && (
        <View style={vpStyles.footer}>
          <View style={[vpStyles.statusDot, { backgroundColor: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.color || "#94A3B8") }]} />
          <Text style={vpStyles.footerText}>
            {CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.label || "Desconocido"}
          </Text>
        </View>
      )}
    </View>
  );
}

const vpStyles = StyleSheet.create({
  container: {
    width: 320,
    backgroundColor: "#080A0F",
    borderLeftWidth: 1,
    borderLeftColor: "#2E3340",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#2E3340",
  },
  headerTitle: { color: "#4ADE80", fontSize: 13, fontWeight: "700" },
  closeBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", cursor: "pointer" },
  body: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  centerContent: { alignItems: "center", justifyContent: "center" },
  pulseCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(74,222,128,0.1)", justifyContent: "center", alignItems: "center" },
  connectingText: { color: "#4ADE80", marginTop: 16, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  connectingSub: { color: "rgba(255,255,255,0.5)", marginTop: 4, fontSize: 12 },
  connectedText: { color: "#4ADE80", marginTop: 16, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  connectedSub: { color: "rgba(255,255,255,0.5)", marginTop: 4, fontSize: 12 },
  elapsedText: { color: "rgba(255,255,255,0.3)", marginTop: 8, fontSize: 11 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#2E3340",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  footerText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },
});

export default function WebDashboardView() {
  const { colors, isDark, toggleTheme } = useTheme();
  const [activos, setActivos] = useState([]);
  const [myCases, setMyCases] = useState([]);
  const [cancelados, setCancelados] = useState([]);
  const [activeTab, setActiveTab] = useState("activos");
  const [search, setSearch] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidentDetail, setIncidentDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeObservations, setCloseObservations] = useState("");
  const [closing, setClosing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [userData, setUserData] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showVideoCallPanel, setShowVideoCallPanel] = useState(false);
  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);
  const markedRef = useRef(new Set());
  const uid = auth.currentUser?.uid;
  const isAssignedToMe = incidentDetail?.officerId === uid;
  const isTakenByOther = incidentDetail?.officerId && !isAssignedToMe;
  const detailActive = incidentDetail && ACTIVE_STATUSES.includes(incidentDetail.status);
  const selectedActive = selectedIncident && ACTIVE_STATUSES.includes(selectedIncident.status);
  const isSelectedActive = incidentDetail ? detailActive : selectedActive;
  const isFinal = incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO";
  const GRAY = "#9CA3AF";

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    const unsubActive = listenAllActiveIncidents(setActivos);
    const unsubMy = listenMyCases(uid, setMyCases);
    const unsubCancelled = listenAllCancelled(setCancelados);
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => { unsubActive(); unsubMy(); unsubCancelled(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!selectedIncident) {
      setIncidentDetail(null);
      setMessages([]);
      return;
    }
    const unsubInc = listenIncidentById(selectedIncident.id, setIncidentDetail);
    const unsubMsg = listenMessages(selectedIncident.id, setMessages);
    return () => { unsubInc(); unsubMsg(); };
  }, [selectedIncident?.id]);

  useEffect(() => {
    if (messages.length > 0 && chatEndRef.current) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView?.();
      }, 50);
    }
  }, [messages]);

  // Mark CITIZEN messages as read by officer
  useEffect(() => {
    if (!isAssignedToMe || !incidentDetail?.id) return;
    const msgs = messages.filter(
      (m) => m.senderRole === "CITIZEN" && !m.readBy?.includes(uid) && !markedRef.current.has(m.id)
    );
    msgs.forEach((m) => {
      markedRef.current.add(m.id);
      markMessageAsRead(incidentDetail.id, m.id, uid);
    });
  }, [messages, isAssignedToMe, incidentDetail?.id]);

  // (no auto video call — videollamada is triggered manually via button)

  // Officer status tracking
  useEffect(() => {
    if (selectedIncident?.id) {
      updateParticipantStatus(selectedIncident.id, "OFFICER", OFFICER_STATUS.DISPATCHING).catch(() => {});
    }
    return () => {
      if (selectedIncident?.id) {
        updateParticipantStatus(selectedIncident.id, "OFFICER", OFFICER_STATUS.IDLE).catch(() => {});
      }
    };
  }, [selectedIncident?.id]);

  useEffect(() => {
    if (isAssignedToMe && incidentDetail?.id) {
      updateParticipantStatus(incidentDetail.id, "OFFICER", OFFICER_STATUS.IN_CALL).catch(() => {});
    }
  }, [isAssignedToMe, incidentDetail?.id]);

  const handleSelectIncident = (incident) => {
    setSelectedIncident(incident);
    setShowCloseForm(false);
    setShowVideoCallPanel(false);
  };

  const handleTakeProcedure = async () => {
    if (!selectedIncident) return;
    setActionFeedback({ type: "loading", text: "Asignando caso..." });
    try {
      const alias = getCurrentAlias();
      await assignOfficer(selectedIncident.id, uid, alias);
      await sendSystemMessage(selectedIncident.id, `${alias || "Un oficial"} ha tomado tu caso.`);
      setActionFeedback({ type: "success", text: "Caso asignado correctamente" });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (e) {
      setActionFeedback({ type: "error", text: "Error al asignar: " + (e.message || "desconocido") });
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedIncident) return;
    const text = chatInput.trim();
    setChatInput("");
    try {
      await sendMessage(selectedIncident.id, text, uid, "OFFICER");
      updateParticipantStatus(selectedIncident.id, "OFFICER", OFFICER_STATUS.CHATTING).catch(() => {});
    } catch {}
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickDispatch = async (label) => {
    setShowDispatchModal(false);
    if (label === "Chat de Texto") return;
    setActionFeedback({ type: "loading", text: `Despachando: ${label}...` });
    try {
      await addQuickRequest(selectedIncident.id, label);
      await sendMessage(selectedIncident.id, `[SISTEMA] Central ha despachado: ${label}`, uid, "OFFICER");
      setActionFeedback({ type: "success", text: `${label} despachado correctamente` });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback({ type: "error", text: `Error al despachar ${label}` });
    }
  };

  const handleQuickResponse = async (text) => {
    if (!selectedIncident) return;
    try {
      await sendMessage(selectedIncident.id, text, uid, "OFFICER");
    } catch {}
  };

  const [closeError, setCloseError] = useState(null);

  const handleCloseCase = async () => {
    if (!closeReason.trim()) {
      setCloseError("Indique el resultado del procedimiento.");
      return;
    }
    setCloseError(null);
    const confirmed = window.confirm("¿Estás seguro de cerrar este caso? Esta acción es irreversible.");
    if (!confirmed) return;
    setClosing(true);
    try {
      await closeIncident(selectedIncident.id, closeObservations.trim(), closeReason.trim());
      await sendMessage(selectedIncident.id, `[CERRADO] INCIDENTE CERRADO. Resolución: ${closeReason.trim()}`, uid, "OFFICER");
      setShowCloseForm(false);
      setSelectedIncident(null);
      setCloseReason("");
      setCloseObservations("");
      setActionFeedback({ type: "success", text: "Caso archivado correctamente" });
      setTimeout(() => setActionFeedback(null), 3000);
    } catch {
      setActionFeedback({ type: "error", text: "No se pudo archivar el caso." });
    } finally {
      setClosing(false);
    }
  };

  const openMaps = () => {
    const lat = incidentDetail?.latitude || selectedIncident?.latitude;
    const lng = incidentDetail?.longitude || selectedIncident?.longitude;
    if (!lat || !lng) {
      setActionFeedback({ type: "error", text: "Ubicación no disponible." });
      setTimeout(() => setActionFeedback(null), 3000);
      return;
    }
    const confirmed = window.confirm("¿Deseas abrir la ubicación en Google Maps?");
    if (!confirmed) return;
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    window.open(url, "_blank");
  };

  const handleLogout = () => {
    if (window.confirm("¿Finalizar turno?")) {
      signOut(auth);
    }
  };

  const myActiveCases = myCases.filter((c) => ACTIVE_STATUSES.includes(c.status));

  const filteredData = useMemo(() => {
    let data = [];
    if (activeTab === "activos") data = activos;
    else if (activeTab === "mycases") data = myActiveCases;
    else data = cancelados;
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter(
      (i) =>
        i.citizenAlias?.toLowerCase().includes(q) ||
        i.address?.toLowerCase().includes(q) ||
        i.id?.toLowerCase().includes(q) ||
        (TYPE_CONFIG[i.type]?.label || "").toLowerCase().includes(q)
    );
  }, [activeTab, activos, myActiveCases, cancelados, search]);

  const renderSidebarItem = (incident) => {
    const config = TYPE_CONFIG[incident.type] || { icon: "alert-circle-outline", label: "Sin clasificar", color: "#6B7280" };
    const isSelected = selectedIncident?.id === incident.id;
    const statusCfg = STATUS_CONFIG[incident.status] || {};
    const isMine = incident.officerId === uid;
    const isFinal = incident.status === "CERRADO" || incident.status === "ANULADO";
    const GRAY = "#9CA3AF";
    return (
      <TouchableOpacity
        key={incident.id}
        style={[
          s.sidebarItem,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isSelected && { borderColor: colors.primary, backgroundColor: colors.greenTranslucent },
        ]}
        onPress={() => handleSelectIncident(incident)}
      >
        <View style={[s.sidebarIcon, { backgroundColor: isFinal ? GRAY + "18" : config.color + "18" }]}>
          <Ionicons name={config.icon} size={20} color={isFinal ? GRAY : config.color} />
        </View>
        <View style={s.sidebarContent}>
          <View style={s.sidebarTop}>
            <Text style={[s.sidebarTitle, { color: isFinal ? GRAY : colors.textPrimary }]} numberOfLines={1}>{config.label}</Text>
            <Text style={[s.sidebarTime, { color: isFinal ? GRAY : colors.danger }]}>{formatElapsed(incident.createdAt)}</Text>
          </View>
          <Text style={[s.sidebarCitizen, { color: isFinal ? GRAY : colors.textSecondary }]} numberOfLines={1}>
            {incident.citizenAlias || "Usuario LENSE"}
          </Text>
          {incident.citizenId && (
            <View style={s.sidebarCSRow}>
              <View style={[s.sidebarCSDot, { backgroundColor: isFinal ? GRAY : (incident.participantStatus?.citizen ? (CITIZEN_STATUS_LABELS[incident.participantStatus.citizen]?.color || "#94A3B8") : "#94A3B8") }]} />
              <Text style={[s.sidebarCSText, { color: isFinal ? GRAY : (incident.participantStatus?.citizen ? (CITIZEN_STATUS_LABELS[incident.participantStatus.citizen]?.color || "#94A3B8") : "#94A3B8") }]}>
                {incident.participantStatus?.citizen ? (CITIZEN_STATUS_LABELS[incident.participantStatus.citizen]?.label || "Desconocido") : "Sin datos"}
              </Text>
            </View>
          )}
          <View style={s.sidebarBadges}>
            {statusCfg.label && (
              <View style={[s.badge, { backgroundColor: (isFinal ? GRAY : statusCfg.color) + "18" }]}>
                <Text style={[s.badgeText, { color: isFinal ? GRAY : statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
            )}
            {isMine && (
              <View style={[s.badge, { backgroundColor: (isFinal ? GRAY : colors.primary) + "18" }]}>
                <Text style={[s.badgeText, { color: isFinal ? GRAY : colors.primary }]}>Mi caso</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* TOP BAR */}
      <View style={[s.topBar, { backgroundColor: colors.drawerHeaderBg }]}>
        <View style={s.topBarLeft}>
          <View style={[s.brandBadge, { backgroundColor: colors.whiteTranslucent }]}>
            <MaterialCommunityIcons name="police-badge" size={20} color={colors.gold} />
          </View>
          <View>
            <Text style={s.topBarTitle}>S.O.S. CARABINEROS — CENCO</Text>
            <Text style={s.topBarSub}>
              ● Turno Activo · {formatShiftTime()} · {userData?.alias || "Operador"}
            </Text>
          </View>
        </View>
        <View style={s.topBarCenter}>
          <View style={[s.statChip, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}>
            <Text style={[s.statChipLabel, { color: colors.badgeRed }]}>Críticas: {activos.length}</Text>
          </View>
          <View style={[s.statChip, { backgroundColor: colors.statusYellowBg, borderColor: colors.statusYellowBorder }]}>
            <Text style={[s.statChipLabel, { color: colors.warning }]}>Mis casos: {myActiveCases.length}</Text>
          </View>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity style={s.themeToggle} onPress={toggleTheme}>
            <Ionicons name={isDark ? "moon" : "sunny"} size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.logoutBtn, { backgroundColor: colors.whiteTranslucent }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={16} color={colors.white} />
            <Text style={s.logoutBtnText}>Finalizar Turno</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN CONTENT */}
      <View style={s.mainContent}>
        {/* SIDEBAR */}
        <View style={[s.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
          <View style={[s.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[s.searchInput, { color: colors.textPrimary }]}
              placeholder="Buscar incidentes..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={s.tabsRow}>
            {[
              { key: "activos", label: "Activos", count: activos.length },
              { key: "mycases", label: "Mis Casos", count: myActiveCases.length },
              { key: "cancelados", label: "Cancelados", count: cancelados.length },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[s.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === tab.key && { color: colors.primary, fontWeight: "700" }]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView style={s.sidebarList} showsVerticalScrollIndicator={true}>
            {filteredData.length === 0 ? (
              <View style={s.emptySidebar}>
                <Ionicons name="shield-checkmark-outline" size={40} color={colors.border} />
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>Sin incidentes</Text>
              </View>
            ) : (
              filteredData.map(renderSidebarItem)
            )}
          </ScrollView>
        </View>

        {/* MAIN PANEL */}
        <View style={s.mainPanel}>
          {!selectedIncident ? (
            <View style={s.welcomeContainer}>
              <View style={[s.welcomeIcon, { backgroundColor: colors.greenTranslucent }]}>
                <MaterialCommunityIcons name="radio-tower" size={64} color={colors.primary} />
              </View>
              <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>CENCO — Centro de Comunicaciones</Text>
              <Text style={[s.welcomeSub, { color: colors.textSecondary }]}>
                Selecciona un incidente del panel izquierdo para comenzar
              </Text>
              <View style={s.welcomeStats}>
                <View style={[s.welcomeStat, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}>
                  <Text style={[s.welcomeStatNum, { color: colors.badgeRed }]}>{activos.length}</Text>
                  <Text style={[s.welcomeStatLabel, { color: colors.badgeRed }]}>Incidentes Activos</Text>
                </View>
                <View style={[s.welcomeStat, { backgroundColor: colors.statusYellowBg, borderColor: colors.statusYellowBorder }]}>
                  <Text style={[s.welcomeStatNum, { color: colors.warning }]}>{myActiveCases.length}</Text>
                  <Text style={[s.welcomeStatLabel, { color: colors.warning }]}>Mis Casos</Text>
                </View>
                <View style={[s.welcomeStat, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}>
                  <Text style={[s.welcomeStatNum, { color: colors.success }]}>{cancelados.length}</Text>
                  <Text style={[s.welcomeStatLabel, { color: colors.success }]}>Cancelados</Text>
                </View>
              </View>
            </View>
          ) : showCloseForm ? (
            /* CLOSE INCIDENT FORM — matches mobile CloseIncidentScreen */
            <ScrollView style={s.closeFormContainer} contentContainerStyle={s.closeFormScroll}>
              <View style={[s.closeHeader, { backgroundColor: colors.drawerHeaderBg }]}>
                <View style={[s.closeHeaderIcon, { backgroundColor: colors.whiteTranslucent }]}>
                  <Ionicons name="document-text" size={24} color={colors.gold} />
                </View>
                <View style={s.closeHeaderTexts}>
                  <Text style={[s.closeHeaderSub, { color: colors.gold }]}>
                    Caso #{selectedIncident.id.slice(0, 8).toUpperCase()}
                  </Text>
                  <Text style={[s.closeHeaderTitle, { color: colors.white }]}>Clasificación Final</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCloseForm(false)} style={s.closeHeaderBack}>
                  <Ionicons name="close" size={24} color={colors.white} />
                </TouchableOpacity>
              </View>
              <View style={{ backgroundColor: colors.drawerHeaderBg, paddingHorizontal: 24, paddingBottom: 16 }}>
                <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>
                  Complete el reporte para archivar el caso
                </Text>
              </View>

              <View style={s.closeCardContainer}>
                <View style={[s.closeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.closeCardTitle, { color: colors.textSecondary }]}>RESUMEN DEL CASO</Text>
                  <View style={s.closeGrid}>
                    <View style={s.closeGridItem}>
                      <Text style={[s.closeGridLabel, { color: colors.textSecondary }]}>Tipo</Text>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 6 }} />
                        <Text style={[s.closeGridValue, { color: colors.textPrimary }]}>
                          {TYPE_CONFIG[incidentDetail?.type]?.label || incidentDetail?.type || "Sin clasificar"}
                        </Text>
                      </View>
                    </View>
                    <View style={s.closeGridItem}>
                      <Text style={[s.closeGridLabel, { color: colors.textSecondary }]}>Ciudadano</Text>
                      <Text style={[s.closeGridValue, { color: colors.textPrimary }]}>
                        {incidentDetail?.citizenAlias || "Usuario LENSE"}
                      </Text>
                    </View>
                    <View style={s.closeGridItem}>
                      <Text style={[s.closeGridLabel, { color: colors.textSecondary }]}>Ubicación</Text>
                      <Text style={[s.closeGridValue, { color: colors.textPrimary }]}>
                        {incidentDetail?.latitude?.toFixed(4)}, {incidentDetail?.longitude?.toFixed(4)}
                      </Text>
                    </View>
                  </View>
                </View>

                {closeError && (
                  <View style={{ backgroundColor: colors.danger + "20", borderColor: colors.danger, borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" }}>{closeError}</Text>
                  </View>
                )}

                <Text style={[s.closeInputLabel, { color: colors.textPrimary }]}>RESULTADO DEL PROCEDIMIENTO *</Text>
                <View style={[s.closeInputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.closeInputText, { color: colors.textPrimary }]}
                    value={closeReason}
                    onChangeText={setCloseReason}
                    placeholder="Ej: Resuelto, Derivado a unidad, Falsa alarma..."
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <Text style={[s.closeInputLabel, { color: colors.textPrimary }]}>OBSERVACIONES DEL OFICIAL</Text>
                <View style={[s.closeTextAreaBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <TextInput
                    style={[s.closeTextArea, { color: colors.textPrimary }]}
                    value={closeObservations}
                    onChangeText={setCloseObservations}
                    placeholder="Describa el desarrollo del procedimiento, medidas tomadas y resultado final..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={s.closeFooterArea}>
                  <TouchableOpacity
                    style={[s.closeSubmitBtn, { backgroundColor: colors.primary }, closing && { opacity: 0.5 }]}
                    onPress={handleCloseCase}
                    disabled={closing}
                  >
                    <Text style={[s.closeSubmitBtnText, { color: colors.white }]}>
                      {closing ? "Archivando..." : "Guardar y Cerrar Caso"}
                    </Text>
                  </TouchableOpacity>
                  <View style={[s.closeWarningBox, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                    <Ionicons name="warning" size={20} color={colors.warningAmber} />
                    <Text style={s.closeWarningText}>
                      Esta acción es irreversible. El caso será archivado y enviado al registro institucional.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : (
            /* INCIDENT DETAIL */
            <View style={s.incidentDetailContainer}>
              {/* Incident Header */}
              <View style={[s.detailHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
                <View style={s.detailHeaderLeft}>
                  <Text style={[s.detailType, { color: isFinal ? GRAY : colors.textPrimary }]}>
                    {TYPE_CONFIG[incidentDetail?.type]?.label || "Sin clasificar"}
                  </Text>
                  <Text style={[s.detailFolio, { color: isFinal ? GRAY : colors.textSecondary }]}>
                    Folio #{incidentDetail?.id?.slice(0, 8)?.toUpperCase()}
                  </Text>
                </View>
                <View style={s.detailHeaderRight}>
                  <Text style={[s.detailElapsed, { color: isFinal ? GRAY : colors.textSecondary }]}>{incidentDetail?.createdAt ? formatElapsed(incidentDetail.createdAt) : ""}</Text>
                  {incidentDetail?.participantStatus?.citizen && (
                    <View style={[s.citizenHBadge, { backgroundColor: ((incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.color || "#94A3B8")) + "18" }]}>
                      <View style={[s.citizenHDot, { backgroundColor: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.color || "#94A3B8") }]} />
                      <Text style={[s.citizenHText, { color: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.color || "#94A3B8") }]}>
                        {CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.label}
                      </Text>
                    </View>
                  )}
                  {incidentDetail?.participantStatus?.communication && (
                    <View style={[s.commBadge, { backgroundColor: ((incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8")) + "18" }]}>
                      <MaterialCommunityIcons name={incidentDetail.participantStatus.communication === "VIDEO_CALL" ? "video" : incidentDetail.participantStatus.communication === "CHAT_ONLY" ? "chat" : "map-marker"} size={12} color={(incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8")} />
                      <Text style={[s.commText, { color: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8") }]}>
                        {COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.label}
                      </Text>
                    </View>
                  )}
                  {incidentDetail?.status && (
                    <View style={[s.statusBadgeDetail, { backgroundColor: (isFinal ? GRAY : (STATUS_CONFIG[incidentDetail.status]?.color || "#666")) + "18" }]}>
                      <Text style={[s.statusBadgeDetailText, { color: isFinal ? GRAY : (STATUS_CONFIG[incidentDetail.status]?.color || "#666") }]}>
                        ● {STATUS_CONFIG[incidentDetail.status]?.label}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={s.detailBody}>
                {/* Left: Chat */}
                <View style={s.chatSection}>
                  <View style={s.chatHeader}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={isFinal ? GRAY : colors.primary} />
                    <Text style={[s.chatHeaderText, { color: isFinal ? GRAY : colors.textPrimary }]}>Chat con el ciudadano</Text>
                    {incidentDetail?.citizenAlias && (
                      <Text style={[s.chatHeaderAlias, { color: isFinal ? GRAY : colors.textSecondary }]}>— {incidentDetail.citizenAlias}</Text>
                    )}
                  </View>

                  <ScrollView style={s.chatMessages} ref={chatScrollRef}>
                    {messages.length === 0 ? (
                      <View style={s.emptyChat}>
                        <Text style={[s.emptyChatText, { color: colors.textSecondary }]}>Sin mensajes.</Text>
                      </View>
                    ) : (
                      messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isMine={msg.senderId === uid}
                          otherRole="CITIZEN"
                          otherUserId={incidentDetail?.citizenId}
                          currentUserId={uid}
                          citizenAlias={incidentDetail?.citizenAlias}
                          officerAlias={incidentDetail?.officerAlias}
                        />
                      ))
                    )}
                    <View ref={chatEndRef} />
                  </ScrollView>

                  {(isAssignedToMe || isFinal) && (
                    <View style={[s.chatInputRow, { borderTopColor: colors.border }]}>
                      <TextInput
                        style={[s.chatInputField, { backgroundColor: isFinal ? GRAY + "20" : colors.inputBg, color: isFinal ? GRAY : colors.textPrimary, borderColor: isFinal ? GRAY : colors.border }]}
                        value={chatInput}
                        onChangeText={setChatInput}
                        placeholder={isFinal ? "Chat cerrado" : "Escriba un mensaje..."}
                        placeholderTextColor={isFinal ? GRAY : colors.textSecondary}
                        onKeyPress={isFinal ? undefined : handleKeyPress}
                        multiline
                        editable={!isFinal}
                      />
                      <TouchableOpacity style={[s.sendBtn, { backgroundColor: isFinal ? GRAY : colors.primary }]} onPress={handleSendMessage} disabled={isFinal}>
                        <Ionicons name="send" size={18} color={isFinal ? "#6B7280" : colors.white} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Video Call Panel */}
                {showVideoCallPanel && <WebVideoCallPanel incidentDetail={incidentDetail} onClose={() => setShowVideoCallPanel(false)} />}

                {/* Right: Info + Call + Actions */}
                <View style={[s.infoSection, { borderLeftColor: colors.border }]}>
                  {actionFeedback && (
                    <View style={[
                      s.feedbackBar,
                      actionFeedback.type === "loading" && { backgroundColor: colors.blueDispatch + "20", borderColor: colors.blueDispatch },
                      actionFeedback.type === "success" && { backgroundColor: colors.success + "20", borderColor: colors.success },
                      actionFeedback.type === "error" && { backgroundColor: colors.danger + "20", borderColor: colors.danger },
                    ]}>
                      <Text style={{
                        fontSize: 13, fontWeight: "600",
                        color: actionFeedback.type === "loading" ? colors.blueDispatch : actionFeedback.type === "success" ? colors.success : colors.danger,
                      }}>
                        {actionFeedback.type === "loading" ? "⚡ " : actionFeedback.type === "success" ? "✓ " : "✕ "}
                        {actionFeedback.text}
                      </Text>
                    </View>
                  )}

                  {/* Citizen Status + Comm Mode */}
                  {(incidentDetail?.participantStatus?.citizen || incidentDetail?.citizenId) && (
                    <View style={[s.citizenStatusBar, { backgroundColor: ((incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail?.participantStatus?.citizen]?.color || "#94A3B8")) + "18", borderColor: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail?.participantStatus?.citizen]?.color || "#94A3B8") }]}>
                      <MaterialCommunityIcons name="account-alert-outline" size={18} color={(incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail?.participantStatus?.citizen]?.color || "#94A3B8")} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.citizenStatusLabel, { color: colors.textSecondary }]}>Estado del ciudadano</Text>
                        <Text style={[s.citizenStatusText, { color: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (CITIZEN_STATUS_LABELS[incidentDetail?.participantStatus?.citizen]?.color || "#94A3B8") }]}>
                          {incidentDetail?.participantStatus?.citizen ? (CITIZEN_STATUS_LABELS[incidentDetail.participantStatus.citizen]?.label || "Desconocido") : "Sin datos"}
                        </Text>
                      </View>
                      {incidentDetail?.participantStatus?.citizenUpdatedAt && (
                        <Text style={[s.citizenStatusTime, { color: colors.textSecondary }]}>
                          {new Date(incidentDetail.participantStatus.citizenUpdatedAt.toMillis?.() || incidentDetail.participantStatus.citizenUpdatedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                    </View>
                  )}
                  {/* Communication Mode */}
                  {incidentDetail?.participantStatus?.communication && (
                    <View style={[s.commModeBar, { backgroundColor: ((incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8")) + "18", borderColor: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8") }]}>
                      <MaterialCommunityIcons name={incidentDetail.participantStatus.communication === "VIDEO_CALL" ? "video" : incidentDetail.participantStatus.communication === "CHAT_ONLY" ? "chat" : "map-marker-radius"} size={18} color={(incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8")} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.citizenStatusLabel, { color: colors.textSecondary }]}>Modo de comunicación</Text>
                        <Text style={[s.citizenStatusText, { color: (incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO") ? "#9E9E9E" : (COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.color || "#94A3B8") }]}>
                          {COMM_MODE_LABELS[incidentDetail.participantStatus.communication]?.label}
                        </Text>
                      </View>
                      {incidentDetail?.participantStatus?.communicationUpdatedAt && (
                        <Text style={[s.citizenStatusTime, { color: colors.textSecondary }]}>
                          {new Date(incidentDetail.participantStatus.communicationUpdatedAt.toMillis?.() || incidentDetail.participantStatus.communicationUpdatedAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Tomar Procedimiento */}
                  {!incidentDetail?.officerId && isSelectedActive && !isFinal && (
                    <TouchableOpacity style={[s.actionBtnPrimary, { backgroundColor: colors.primary }]} onPress={handleTakeProcedure}>
                      <MaterialCommunityIcons name="police-badge" size={20} color={colors.white} />
                      <Text style={s.actionBtnPrimaryText}>Tomar Procedimiento</Text>
                    </TouchableOpacity>
                  )}

                  {isTakenByOther && (
                    <View style={[s.takenBanner, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                      <Ionicons name="information-circle" size={18} color={colors.warningAmber} />
                      <Text style={[s.takenBannerText, { color: colors.warningAmber }]}>
                        Tomado por {incidentDetail?.officerAlias || "otro oficial"}
                      </Text>
                    </View>
                  )}

                  {(isAssignedToMe || isFinal) && (
                    <>
                      {/* Videollamada Button */}
                      <TouchableOpacity style={[s.videoCallBtn, { backgroundColor: isFinal ? GRAY + "30" : "#080A0F", borderColor: isFinal ? GRAY : "#4ADE80" }]} onPress={() => setShowVideoCallPanel(true)} disabled={isFinal}>
                        <MaterialCommunityIcons name="video" size={22} color={isFinal ? GRAY : "#4ADE80"} />
                        <Text style={[s.videoCallBtnText, { color: isFinal ? GRAY : "#4ADE80" }]}>Videollamada</Text>
                      </TouchableOpacity>

                      {/* Dispatch Modal Trigger + Buttons */}
                      <View style={s.dispatchRow}>
                        <TouchableOpacity style={[s.dispatchBtn, { backgroundColor: isFinal ? GRAY : "#1976D2" }]} onPress={() => setShowDispatchModal(true)} disabled={isFinal}>
                          <MaterialCommunityIcons name="police-badge" size={22} color={isFinal ? "#6B7280" : colors.white} />
                          <Text style={[s.dispatchBtnText, { color: isFinal ? "#6B7280" : colors.white }]}>Patrulla</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.dispatchBtn, { backgroundColor: isFinal ? GRAY : "#D32F2F" }]} onPress={() => setShowDispatchModal(true)} disabled={isFinal}>
                          <MaterialCommunityIcons name="ambulance" size={22} color={isFinal ? "#6B7280" : colors.white} />
                          <Text style={[s.dispatchBtnText, { color: isFinal ? "#6B7280" : colors.white }]}>SAMU</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Meta actions */}
                      <View style={s.metaActionsRow}>
                        <TouchableOpacity style={[s.metaBtn, { backgroundColor: isFinal ? GRAY : "#16A34A" }]} onPress={openMaps} disabled={isFinal}>
                          <Ionicons name="location-outline" size={16} color={isFinal ? "#6B7280" : colors.white} />
                          <Text style={[s.metaBtnText, { color: isFinal ? "#6B7280" : colors.white }]}>Ver Mapa</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.metaBtn, { backgroundColor: isFinal ? GRAY : colors.danger }]} onPress={isFinal ? undefined : () => { setShowCloseForm(true); setCloseError(null); if (selectedIncident?.id) updateParticipantStatus(selectedIncident.id, "OFFICER", OFFICER_STATUS.CLOSING).catch(() => {}); }} disabled={isFinal}>
                          <Text style={[s.metaBtnText, { fontSize: 14, color: isFinal ? "#6B7280" : colors.white }]}>Finalizar</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Quick responses */}
                      <View style={s.quickRow}>
                        {QUICK_RESPONSES.map((text) => (
                          <TouchableOpacity
                            key={text}
                            style={[s.quickChip, { backgroundColor: isFinal ? GRAY + "20" : colors.primary + "15", borderColor: isFinal ? GRAY : colors.primary + "30" }]}
                            onPress={isFinal ? undefined : () => handleQuickResponse(text)}
                            disabled={isFinal}
                          >
                            <Text style={[s.quickChipText, { color: isFinal ? GRAY : colors.primary }]}>{text}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Dispatch Modal */}
      <Modal visible={showDispatchModal} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowDispatchModal(false)}>
          <View style={[s.dispatchSheet, { backgroundColor: colors.surface }]}>
            <Text style={[s.dispatchSheetTitle, { color: colors.textPrimary }]}>Opciones de Despacho</Text>
            {incidentDetail?.address && (
              <TouchableOpacity style={[s.addressCard, { backgroundColor: colors.inputBg }]} onPress={openMaps}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={[s.addressText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {incidentDetail.address}
                </Text>
              </TouchableOpacity>
            )}
            <View style={s.dispatchGrid}>
              {DISPATCH_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[s.dispatchBox, { backgroundColor: item.color }]}
                  onPress={() => handleQuickDispatch(item.label)}
                >
                  <MaterialCommunityIcons name={item.icon} size={32} color={colors.white} />
                  <Text style={s.dispatchBoxText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },

    /* TOP BAR */
    topBar: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 20, paddingVertical: 12, gap: 20,
    },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
    brandBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
    topBarTitle: { color: colors.white, fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
    topBarSub: { color: colors.whiteTranslucent, fontSize: 11, marginTop: 2 },
    topBarCenter: { flexDirection: "row", gap: 8 },
    statChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
    statChipLabel: { fontSize: 12, fontWeight: "700" },
    topBarRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    themeToggle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", cursor: "pointer" },
    logoutBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, cursor: "pointer" },
    logoutBtnText: { color: colors.white, fontSize: 13, fontWeight: "600" },

    /* MAIN */
    mainContent: { flex: 1, flexDirection: "row" },

    /* SIDEBAR */
    sidebar: { width: SIDEBAR_WIDTH, borderRightWidth: 1, display: "flex", flexDirection: "column" },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 8, margin: 12, paddingHorizontal: 12, height: 40, borderRadius: 8, borderWidth: 1 },
    searchInput: { flex: 1, fontSize: 14, outlineStyle: "none", outlineWidth: 0 },
    tabsRow: { flexDirection: "row", marginHorizontal: 12, marginBottom: 4 },
    tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent", cursor: "pointer" },
    tabText: { fontSize: 12, fontWeight: "600" },
    sidebarList: { flex: 1, paddingHorizontal: 8, paddingBottom: 8 },
    emptySidebar: { alignItems: "center", paddingTop: 60 },
    emptyText: { fontSize: 14, marginTop: 8 },
    sidebarItem: { flexDirection: "row", gap: 10, padding: 12, marginBottom: 6, borderRadius: 10, borderWidth: 1, cursor: "pointer" },
    sidebarIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    sidebarContent: { flex: 1 },
    sidebarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sidebarTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
    sidebarTime: { fontSize: 11, fontWeight: "700", marginLeft: 6 },
    sidebarCitizen: { fontSize: 12, marginTop: 2 },
    sidebarCSRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    sidebarCSDot: { width: 6, height: 6, borderRadius: 3 },
    sidebarCSText: { fontSize: 10, fontWeight: "700" },
    sidebarBadges: { flexDirection: "row", gap: 4, marginTop: 4 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: "700" },

    /* MAIN PANEL */
    mainPanel: { flex: 1 },

    /* WELCOME */
    welcomeContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
    welcomeIcon: { width: 120, height: 120, borderRadius: 60, justifyContent: "center", alignItems: "center", marginBottom: 24 },
    welcomeTitle: { fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 8 },
    welcomeSub: { fontSize: 15, textAlign: "center", marginBottom: 32, maxWidth: 400 },
    welcomeStats: { flexDirection: "row", gap: 16 },
    welcomeStat: { padding: 20, borderRadius: 12, borderWidth: 1, alignItems: "center", minWidth: 140 },
    welcomeStatNum: { fontSize: 36, fontWeight: "900" },
    welcomeStatLabel: { fontSize: 12, fontWeight: "600", marginTop: 4, textAlign: "center" },

    /* CLOSE INCIDENT FORM */
    closeFormContainer: { flex: 1 },
    closeFormScroll: { paddingBottom: 40 },
    closeHeader: { flexDirection: "row", alignItems: "center", padding: 24, paddingTop: 30 },
    closeHeaderIcon: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: 16 },
    closeHeaderSub: { fontSize: 11, fontWeight: "700" },
    closeHeaderTitle: { fontSize: 20, fontWeight: "900" },
    closeHeaderTexts: { flex: 1 },
    closeHeaderBack: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", cursor: "pointer" },
    closeCardContainer: { padding: 24 },
    closeCard: { borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1 },
    closeCardTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 16 },
    closeGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
    closeGridItem: { width: "50%" },
    closeGridLabel: { fontSize: 10, marginBottom: 4 },
    closeGridValue: { fontSize: 14, fontWeight: "700" },
    closeInputLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
    closeInputBox: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, height: 50, justifyContent: "center", marginBottom: 20 },
    closeInputText: { fontSize: 14, includeFontPadding: false, outlineStyle: "none", outlineWidth: 0 },
    closeTextAreaBox: { borderRadius: 8, borderWidth: 1, padding: 14, height: 120, marginBottom: 20 },
    closeTextArea: { flex: 1, fontSize: 14, lineHeight: 20, outlineStyle: "none", outlineWidth: 0 },
    closeFooterArea: { marginTop: 8 },
    closeSubmitBtn: { borderRadius: 10, height: 52, justifyContent: "center", alignItems: "center", marginBottom: 16, cursor: "pointer" },
    closeSubmitBtnText: { fontSize: 15, fontWeight: "700" },
    closeWarningBox: { flexDirection: "row", borderRadius: 8, padding: 14, borderWidth: 1, alignItems: "center" },
    closeWarningText: { flex: 1, fontSize: 12, color: colors.warningAmber, marginLeft: 10, lineHeight: 16 },

    /* INCIDENT DETAIL */
    incidentDetailContainer: { flex: 1, display: "flex", flexDirection: "column" },
    detailHeader: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1,
    },
    detailHeaderLeft: {},
    detailType: { fontSize: 18, fontWeight: "900" },
    detailFolio: { fontSize: 12, marginTop: 2 },
    detailHeaderRight: { flexDirection: "row", alignItems: "center", gap: 12 },
    statusBadgeDetail: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusBadgeDetailText: { fontSize: 11, fontWeight: "700" },
    detailElapsed: { fontSize: 13, fontWeight: "600" },
    citizenHBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    citizenHDot: { width: 7, height: 7, borderRadius: 4 },
    citizenHText: { fontSize: 10, fontWeight: "700" },
    commBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    commText: { fontSize: 10, fontWeight: "700" },

    detailBody: { flex: 1, flexDirection: "row" },

    /* CHAT */
    chatSection: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },

    citizenStatusBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
    commModeBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
    citizenStatusLabel: { fontSize: 10, fontWeight: "600", marginBottom: 2 },
    citizenStatusText: { fontSize: 13, fontWeight: "700" },
    citizenStatusTime: { fontSize: 10, fontWeight: "500" },
    chatHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
    chatHeaderText: { fontSize: 14, fontWeight: "700" },
    chatHeaderAlias: { fontSize: 13 },
    chatMessages: { flex: 1, paddingHorizontal: 20, paddingVertical: 8 },
    emptyChat: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
    emptyChatText: { fontSize: 14 },
    chatInputRow: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: 1, alignItems: "flex-end" },
    chatInputField: { flex: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, borderWidth: 1, maxHeight: 80, outlineStyle: "none", outlineWidth: 0 },
    sendBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center", cursor: "pointer" },

    /* INFO SECTION */
    infoSection: { width: 300, borderLeftWidth: 1, padding: 16, gap: 10, overflowY: "auto" },

    feedbackBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 8, borderWidth: 1 },

    actionBtnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, cursor: "pointer" },
    actionBtnPrimaryText: { color: colors.white, fontSize: 15, fontWeight: "700" },

    takenBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
    takenBannerText: { fontSize: 13, fontWeight: "600", flex: 1 },

    dispatchRow: { flexDirection: "row", gap: 8 },
    dispatchBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 10, cursor: "pointer" },
    dispatchBtnText: { color: colors.white, fontSize: 13, fontWeight: "700" },

    videoCallBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, cursor: "pointer" },
    videoCallBtnText: { color: "#4ADE80", fontSize: 14, fontWeight: "700" },
    metaActionsRow: { flexDirection: "row", gap: 8 },
    metaBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, cursor: "pointer" },
    metaBtnText: { color: colors.white, fontSize: 12, fontWeight: "700" },

    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    quickChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, cursor: "pointer" },
    quickChipText: { fontSize: 12, fontWeight: "600" },

    /* DISPATCH MODAL */
    modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
    dispatchSheet: { borderRadius: 16, padding: 24, width: "90%", maxWidth: 500 },
    dispatchSheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
    addressCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
    addressText: { fontSize: 13, fontWeight: "500", flex: 1 },
    dispatchGrid: { flexDirection: "row", gap: 12 },
    dispatchBox: { flex: 1, borderRadius: 14, paddingVertical: 20, alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8 },
    dispatchBoxText: { color: colors.white, fontSize: 12, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },
  });
