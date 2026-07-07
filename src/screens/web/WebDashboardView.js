import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
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
  listenAllFinalized,
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
import WebRTCView from "../../components/WebRTCView";
import {
  listenSignaling,
  sendOffer,
  sendIceCandidate,
  clearSignaling,
} from "../../services/signalingService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const SIDEBAR_WIDTH = 400;
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

const sortByTime = (a, b) => {
  const tA = a.createdAt?.toMillis?.() || 0;
  const tB = b.createdAt?.toMillis?.() || 0;
  return tB - tA;
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

function WebVideoCallPanel({ incidentDetail, onClose, myUid }) {
  const incidentId = incidentDetail?.id;
  const citizenId = incidentDetail?.citizenId;
  const webrtcRef = useRef(null);
  const [vpConnecting, setVpConnecting] = useState(true);
  const [vpCallActive, setVpCallActive] = useState(false);
  const [vpError, setVpError] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const callActiveRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef(null);

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

  useEffect(() => {
    if (!incidentId || !citizenId || !myUid) return;
    console.log("[WebVC] listening for citizen signaling", citizenId);
    const unsub = listenSignaling(incidentId, citizenId, {
      onAnswer: (sdp) => {
        console.log("[WebVC] citizen answer");
        webrtcRef.current?.forwardSignaling("answer", sdp);
      },
      onIce: (candidate) => {
        webrtcRef.current?.forwardSignaling("ice", candidate);
      },
    });
    return () => {
      unsub();
      clearSignaling(incidentId, myUid).catch(() => {});
    };
  }, [incidentId, citizenId, myUid]);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!callActiveRef.current && !vpError) {
        console.warn("[WebVC] connection timeout");
        setVpError("Tiempo de conexión agotado");
      }
    }, 25000);
    return () => clearTimeout(timeoutRef.current);
  }, [retryKey]);

  const handleWebRTCMessage = useCallback((type, data) => {
    console.log("[WebVC] WebRTC msg:", type);
    switch (type) {
      case "ready":
        webrtcRef.current?.forwardSignaling("makeOffer");
        break;
      case "offer":
        sendOffer(incidentId, myUid, data).catch(console.warn);
        break;
      case "ice":
        sendIceCandidate(incidentId, myUid, data).catch(console.warn);
        break;
      case "remote_on":
        console.log("[WebVC] remote connected!");
        callActiveRef.current = true;
        setVpConnecting(false);
        setVpCallActive(true);
        clearTimeout(timeoutRef.current);
        break;
      case "disconnected":
        console.warn("[WebVC] disconnected");
        setVpError("Conexión perdida");
        break;
      case "error":
        console.warn("[WebVC] error:", data);
        setVpError(data);
        break;
    }
  }, [incidentId, myUid]);

  const handleRetry = useCallback(() => {
    webrtcRef.current?.hangUp();
    clearSignaling(incidentId, myUid).catch(() => {});
    callActiveRef.current = false;
    setVpConnecting(true);
    setVpCallActive(false);
    setVpError(null);
    setRetryKey((k) => k + 1);
  }, [incidentId, myUid]);

  const handleClose = useCallback(() => {
    webrtcRef.current?.hangUp();
    clearSignaling(incidentId, myUid).catch(() => {});
    onClose();
  }, [incidentId, myUid, onClose]);

  return (
    <View style={vpStyles.container}>
      <View style={vpStyles.header}>
        <Text style={vpStyles.headerTitle}>Videollamada</Text>
        <TouchableOpacity onPress={handleClose} style={vpStyles.closeBtn}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={vpStyles.body}>
        {vpError ? (
          <View style={vpStyles.centerContent}>
            <MaterialCommunityIcons name="video-off" size={40} color="#EF4444" />
            <Text style={[vpStyles.connectingText, { color: "#EF4444" }]}>Error</Text>
            <Text style={vpStyles.connectingSub}>{vpError}</Text>
            <TouchableOpacity style={vpStyles.retryBtn} onPress={handleRetry}>
              <Text style={vpStyles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <WebRTCView
              key={retryKey}
              ref={webrtcRef}
              style={{ flex: 1 }}
              onWebRTCMessage={handleWebRTCMessage}
            />
            {vpConnecting && !vpCallActive && (
              <View style={vpStyles.overlay}>
                <Animated.View style={[vpStyles.pulseCircle, { opacity: pulseOpacity }]}>
                  <MaterialCommunityIcons name="cellphone-link" size={40} color="#4ADE80" />
                </Animated.View>
                <Text style={vpStyles.connectingText}>Conectando...</Text>
                <Text style={vpStyles.connectingSub}>Estableciendo enlace</Text>
                <ActivityIndicator size="small" color="#4ADE80" style={{ marginTop: 12 }} />
              </View>
            )}
            {vpCallActive && (
              <View style={vpStyles.overlayTop}>
                <Text style={vpStyles.connectedText}>VIDEOLLAMADA ACTIVA</Text>
              </View>
            )}
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
  body: { flex: 1, justifyContent: "center", alignItems: "center" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    zIndex: 2,
  },
  overlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    alignItems: "center",
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  retryBtn: {
    marginTop: 16,
    backgroundColor: "#4ADE80",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    cursor: "pointer",
  },
  retryBtnText: { color: "#000", fontSize: 14, fontWeight: "700" },
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
  const [finalizados, setFinalizados] = useState([]);
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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showDetailMapModal, setShowDetailMapModal] = useState(false);
  const chatScrollRef = useRef(null);
  const chatEndRef = useRef(null);
  const markedRef = useRef(new Set());
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const detailMapRef = useRef(null);
  const detailMapInstanceRef = useRef(null);
  const detailMapModalRef = useRef(null);
  const detailMapModalInstanceRef = useRef(null);
  const uid = auth.currentUser?.uid;
  const isAssignedToMe = incidentDetail?.officerId === uid;
  const isTakenByOther = incidentDetail?.officerId && !isAssignedToMe;
  const detailActive = incidentDetail && ACTIVE_STATUSES.includes(incidentDetail.status);
  const selectedActive = selectedIncident && ACTIVE_STATUSES.includes(selectedIncident.status);
  const isSelectedActive = incidentDetail ? detailActive : selectedActive;
  const isFinal = incidentDetail?.status === "CERRADO" || incidentDetail?.status === "ANULADO";
  const GRAY = "#9CA3AF";
  const myActiveCases = useMemo(() => myCases.filter((c) => ACTIVE_STATUSES.includes(c.status)), [myCases]);

  const allMapIncidents = useMemo(() => {
    const all = [...activos, ...myCases, ...finalizados, ...cancelados];
    const seen = new Set();
    return all.filter((i) => {
      if (!i.latitude || !i.longitude) return false;
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return true;
    });
  }, [activos, myCases, finalizados, cancelados]);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    getDoc(doc(db, "users", uid)).then((snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    const unsubActive = listenAllActiveIncidents((data) => setActivos(data.sort(sortByTime)));
    const unsubMy = listenMyCases(uid, (data) => setMyCases(data.sort(sortByTime)));
    const unsubCancelled = listenAllCancelled((data) => setCancelados(data.sort(sortByTime)));
    const unsubFinalized = listenAllFinalized((data) => setFinalizados(data.sort(sortByTime)));
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => { unsubActive(); unsubMy(); unsubCancelled(); unsubFinalized(); clearInterval(timer); };
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

  useEffect(() => {
    if (!showMapModal) return;
    let cancelled = false;
    const initMap = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const L = await new Promise((resolve) => {
        if (window.L) { resolve(window.L); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled || !mapContainerRef.current) return;
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
      const map = L.map(mapContainerRef.current, { zoomControl: true });
      mapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);
      const markers = allMapIncidents.map((i) => {
        let ownerLabel = "Sin tomar", ownerColor = "#F59E0B";
        if (i.officerId === uid) { ownerLabel = "Tomado por mí"; ownerColor = "#3B82F6"; }
        else if (i.officerId) { ownerLabel = `Tomado por ${i.officerAlias || "otro oficial"}`; ownerColor = "#8B5CF6"; }
        return { lat: i.latitude, lng: i.longitude, label: i.citizenAlias || "Usuario", type: i.type || "", status: i.status || "", folio: i.id.slice(0, 8).toUpperCase(), ownerLabel, ownerColor };
      });
      const bounds = [];
      markers.forEach((m) => {
        if (!m.lat || !m.lng) return;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:26px;height:26px;border-radius:50%;background:${m.ownerColor};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:bold;">●</div>`,
          iconSize: [26, 26], iconAnchor: [13, 13], popupAnchor: [0, -18],
        });
        const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<b>${m.label}</b><br/>${m.type ? m.type + " · " : ""}Folio: ${m.folio}<br/>Estado: ${m.status}<br/><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${m.ownerColor};margin-top:4px;">${m.ownerLabel}</span>`
        );
        bounds.push([m.lat, m.lng]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [50, 50] });
      else map.setView([-33.4489, -70.6693], 12);
    };
    initMap();
    return () => { cancelled = true; if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [showMapModal, allMapIncidents, uid]);

  // Incident detail map - traceability
  useEffect(() => {
    if (!incidentDetail?.id || !detailMapRef.current) {
      if (detailMapInstanceRef.current) { detailMapInstanceRef.current.remove(); detailMapInstanceRef.current = null; }
      return;
    }
    let cancelled = false;
    const initDetailMap = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const L = await new Promise((resolve) => {
        if (window.L) { resolve(window.L); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled || !detailMapRef.current) return;
      if (detailMapInstanceRef.current) { detailMapInstanceRef.current.remove(); detailMapInstanceRef.current = null; }
      const map = L.map(detailMapRef.current, { zoomControl: false, dragging: true });
      detailMapInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);

      // Build ordered points from locationHistory array
      const pts = [];
      const labels = [];
      const times = [];
      if (incidentDetail.locationHistory?.length > 0) {
        incidentDetail.locationHistory.forEach((p) => {
          if (p.lat && p.lng) { pts.push([p.lat, p.lng]); labels.push(p.label || ""); times.push(p._t || null); }
        });
      } else if (incidentDetail.latitude && incidentDetail.longitude) {
        pts.push([incidentDetail.latitude, incidentDetail.longitude]);
        labels.push("Actual");
      }

      if (pts.length === 0) { map.setView([-33.4489, -70.6693], 12); return; }

      const count = pts.length;
      pts.forEach((pt, i) => {
        const isNewest = i === count - 1;
        const isOldest = i === 0;
        const num = i + 1;
        const bg = isNewest ? "#D32F2F" : isOldest ? "#6B7280" : "#3B82F6";
        const size = isNewest ? 28 : 22;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;">${num}</div>`,
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker(pt, { icon }).addTo(map);
        const label = labels[i] || `Punto ${num}`;
        const t = times[i];
        const timeStr = t ? new Date(t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";
        marker.bindPopup(`<b>#${num}</b> — ${label}${timeStr ? '<br/><span style="color:#9CA3AF;font-size:11px;">' + timeStr + "</span>" : ""}${isNewest ? '<br/><i style="color:#D32F2F">Última ubicación</i>' : ""}${isOldest && count > 1 ? '<br/><i style="color:#6B7280">Inicio</i>' : ""}`);
      });

      if (count > 1) {
        L.polyline(pts, { color: "#3B82F6", weight: 2, opacity: 0.5, dashArray: "5, 5" }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(pts), { padding: [30, 30] });

      // Legend badge
      const legend = L.control({ position: "bottomleft" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div");
        div.style.cssText = "background:rgba(15,17,23,0.85);color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-family:sans-serif;font-weight:600;";
        div.innerHTML = `${count} ${count === 1 ? "ubicación" : "ubicaciones"}`;
        return div;
      };
      legend.addTo(map);
    };
    initDetailMap();
    return () => { cancelled = true; };
  }, [incidentDetail?.id, incidentDetail?.latitude, incidentDetail?.longitude, incidentDetail?.locationHistory]);

  // Expanded detail map modal
  useEffect(() => {
    if (!showDetailMapModal || !detailMapModalRef.current) {
      if (detailMapModalInstanceRef.current) { detailMapModalInstanceRef.current.remove(); detailMapModalInstanceRef.current = null; }
      return;
    }
    let cancelled = false;
    const initDetailMapModal = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      const L = await new Promise((resolve) => {
        if (window.L) { resolve(window.L); return; }
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });
      await new Promise((r) => setTimeout(r, 100));
      if (cancelled || !detailMapModalRef.current) return;
      if (detailMapModalInstanceRef.current) { detailMapModalInstanceRef.current.remove(); detailMapModalInstanceRef.current = null; }
      const map = L.map(detailMapModalRef.current, { zoomControl: true });
      detailMapModalInstanceRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 19,
      }).addTo(map);

      const pts = [];
      const labels = [];
      const times = [];
      if (incidentDetail?.locationHistory?.length > 0) {
        incidentDetail.locationHistory.forEach((p) => {
          if (p.lat && p.lng) { pts.push([p.lat, p.lng]); labels.push(p.label || ""); times.push(p._t || null); }
        });
      } else if (incidentDetail?.latitude && incidentDetail?.longitude) {
        pts.push([incidentDetail.latitude, incidentDetail.longitude]);
        labels.push("Actual");
      }
      if (pts.length === 0) { map.setView([-33.4489, -70.6693], 12); return; }

      const count = pts.length;
      pts.forEach((pt, i) => {
        const isNewest = i === count - 1;
        const isOldest = i === 0;
        const num = i + 1;
        const bg = isNewest ? "#D32F2F" : isOldest ? "#6B7280" : "#3B82F6";
        const size = isNewest ? 32 : 26;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;font-family:sans-serif;">${num}</div>`,
          iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker(pt, { icon }).addTo(map);
        const label = labels[i] || `Punto ${num}`;
        const t = times[i];
        const timeStr = t ? new Date(t).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "";
        marker.bindPopup(`<b>#${num}</b> — ${label}${timeStr ? '<br/><span style="color:#9CA3AF;font-size:11px;">' + timeStr + "</span>" : ""}${isNewest ? '<br/><i style="color:#D32F2F">Última ubicación</i>' : ""}${isOldest && count > 1 ? '<br/><i style="color:#6B7280">Inicio</i>' : ""}`);
      });

      if (count > 1) {
        L.polyline(pts, { color: "#3B82F6", weight: 2, opacity: 0.5, dashArray: "5, 5" }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });

      const legend = L.control({ position: "bottomleft" });
      legend.onAdd = () => {
        const div = L.DomUtil.create("div");
        div.style.cssText = "background:rgba(15,17,23,0.85);color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-family:sans-serif;font-weight:600;";
        div.innerHTML = `${count} ${count === 1 ? "ubicación" : "ubicaciones"}`;
        return div;
      };
      legend.addTo(map);
    };
    initDetailMapModal();
    return () => { cancelled = true; };
  }, [showDetailMapModal, incidentDetail?.id, incidentDetail?.latitude, incidentDetail?.longitude, incidentDetail?.locationHistory]);

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

  const filteredData = useMemo(() => {
    let data = [];
    if (activeTab === "activos") data = activos;
    else if (activeTab === "mycases") data = myActiveCases;
    else if (activeTab === "finalizados") data = finalizados;
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
          <TouchableOpacity style={[s.mapBtn, { backgroundColor: colors.blueDispatch }]} onPress={() => setShowMapModal(true)}>
            <Ionicons name="map-outline" size={16} color={colors.white} />
            <Text style={s.mapBtnText}>Mapa Global</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.avatarButton, { backgroundColor: colors.primary, borderColor: colors.gold }]} onPress={() => setShowProfileModal(true)}>
            <MaterialCommunityIcons name="police-badge" size={20} color={colors.gold} />
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
              { key: "finalizados", label: "Finalizados", count: finalizados.length },
              { key: "anulados", label: "Anulados", count: cancelados.length },
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
                  <Text style={[s.welcomeStatNum, { color: colors.success }]}>{finalizados.length}</Text>
                  <Text style={[s.welcomeStatLabel, { color: colors.success }]}>Finalizados</Text>
                </View>
                <View style={[s.welcomeStat, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}>
                  <Text style={[s.welcomeStatNum, { color: colors.success }]}>{cancelados.length}</Text>
                  <Text style={[s.welcomeStatLabel, { color: colors.success }]}>Anulados</Text>
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
                {showVideoCallPanel && <WebVideoCallPanel incidentDetail={incidentDetail} onClose={() => setShowVideoCallPanel(false)} myUid={uid} />}

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

                  {/* Detail Map */}
                  {incidentDetail?.id && (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setShowDetailMapModal(true)} style={s.detailMapWrap}>
                      <View style={s.detailMapHeader}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", flex: 1 }}>UBICACIÓN DEL CIUDADANO</Text>
                        <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "600" }}>Expandir</Text>
                      </View>
                      <View ref={detailMapRef} style={s.detailMap} />
                      {incidentDetail.latitude && (
                        <Text style={{ color: colors.textSecondary, fontSize: 10, paddingHorizontal: 8, paddingBottom: 4 }}>
                          {incidentDetail.locationHistory?.length || 1} {incidentDetail.locationHistory?.length === 1 ? "ubicación" : "ubicaciones"}
                        </Text>
                      )}
                    </TouchableOpacity>
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

      {/* Profile Modal */}
      <Modal visible={showProfileModal} transparent animationType="fade">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
          <View style={[s.profileModal, { backgroundColor: colors.surface }]}>
            <View style={[s.profileHeader, { backgroundColor: colors.drawerHeaderBg }]}>
              <TouchableOpacity onPress={() => setShowProfileModal(false)} style={{ alignSelf: "flex-end" }}>
                <Ionicons name="close" size={24} color={colors.white} />
              </TouchableOpacity>
              <View style={s.profileAvatarSection}>
                <View style={[s.profileAvatarLarge, { backgroundColor: colors.primary, borderColor: colors.gold }]}>
                  <MaterialCommunityIcons name="police-badge" size={48} color={colors.gold} />
                </View>
                <View style={[s.serviceBadge, { backgroundColor: colors.success }]}>
                  <Text style={s.serviceBadgeText}>● En Servicio</Text>
                </View>
                <Text style={[s.profileName, { color: colors.white }]}>{userData?.alias || "Operador"}</Text>
                {userData?.rut && <Text style={[s.profileRank, { color: colors.gold }]}>Placa: {userData.rut}</Text>}
              </View>
            </View>

            <ScrollView style={s.profileBody} contentContainerStyle={s.profileBodyContent}>
              <View style={[s.themeRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={colors.textPrimary} />
                <Text style={[s.themeLabel, { color: colors.textPrimary }]}>Modo oscuro</Text>
                <TouchableOpacity style={[s.themeToggleBtn, { backgroundColor: isDark ? colors.primary : colors.textSecondary }]} onPress={toggleTheme}>
                  <View style={[s.themeToggleThumb, { alignSelf: isDark ? "flex-end" : "flex-start", backgroundColor: colors.white }]} />
                </TouchableOpacity>
              </View>

              <View style={[s.dataCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={s.dataHeader}>
                  <MaterialCommunityIcons name="badge-account-outline" size={20} color={colors.textSecondary} />
                  <Text style={[s.dataTitle, { color: colors.textSecondary }]}>NÚMERO DE PLACA / RUT</Text>
                </View>
                <Text style={[s.dataValueBig, { color: colors.textPrimary }]}>{userData?.rut || "—"}</Text>
                <Text style={[s.dataSub, { color: colors.textSecondary }]}>Credencial Validada</Text>
              </View>

              <View style={[s.dataCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={s.dataHeader}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
                  <Text style={[s.dataTitle, { color: colors.textSecondary }]}>EMAIL INSTITUCIONAL</Text>
                </View>
                <Text style={[s.dataValue, { color: colors.textPrimary }]}>{auth.currentUser?.email || "—"}</Text>
              </View>

              <View style={[s.dataCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <View style={s.dataHeader}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
                  <Text style={[s.dataTitle, { color: colors.textSecondary }]}>UNIDAD ASIGNADA</Text>
                </View>
                <Text style={[s.dataValue, { color: colors.textPrimary }]}>Central de Comunicaciones (CENCO)</Text>
                <Text style={[s.dataSub, { color: colors.textSecondary }]}>Sector Sur, Región Metropolitana</Text>
              </View>

              <TouchableOpacity style={[s.profileLogoutBtn, { borderColor: colors.danger }]} onPress={() => { setShowProfileModal(false); handleLogout(); }}>
                <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                <Text style={[s.profileLogoutText, { color: colors.danger }]}>Finalizar Turno</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Map Modal */}
      <Modal visible={showMapModal} transparent animationType="fade">
        <View style={[s.mapModalContainer, { backgroundColor: colors.drawerHeaderBg }]}>
          <View style={s.mapModalHeader}>
            <Text style={s.mapModalTitle}>
              <MaterialCommunityIcons name="map" size={18} color={colors.gold} />  Mapa Global — {allMapIncidents.length} incidentes
            </Text>
            <TouchableOpacity style={s.mapModalClose} onPress={() => setShowMapModal(false)}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={s.mapModalBody}>
            <View ref={mapContainerRef} style={{ flex: 1 }} />
            {allMapIncidents.length === 0 && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
                <Ionicons name="map-outline" size={64} color={colors.border} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 12 }}>Sin incidentes con ubicación</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showDetailMapModal} transparent animationType="fade">
        <View style={[s.mapModalContainer, { backgroundColor: colors.drawerHeaderBg }]}>
          <View style={s.mapModalHeader}>
            <Text style={s.mapModalTitle}>
              <Ionicons name="location-outline" size={18} color={colors.gold} />  Trazabilidad — Folio #{incidentDetail?.id?.slice(0, 8)?.toUpperCase()}
            </Text>
            <TouchableOpacity style={s.mapModalClose} onPress={() => setShowDetailMapModal(false)}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
          <View style={s.mapModalBody}>
            <View ref={detailMapModalRef} style={{ flex: 1 }} />
            {!incidentDetail?.latitude && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
                <Ionicons name="map-outline" size={64} color={colors.border} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, marginTop: 12 }}>Sin ubicación disponible</Text>
              </View>
            )}
          </View>
        </View>
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
    tabText: { fontSize: 13, fontWeight: "600" },
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
    infoSection: { width: 340, borderLeftWidth: 1, padding: 16, gap: 10, overflowY: "auto" },

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
    modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", cursor: "pointer" },
    dispatchSheet: { borderRadius: 16, padding: 24, width: "90%", maxWidth: 500 },
    dispatchSheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
    addressCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
    addressText: { fontSize: 13, fontWeight: "500", flex: 1 },
    dispatchGrid: { flexDirection: "row", gap: 12 },
    dispatchBox: { flex: 1, borderRadius: 14, paddingVertical: 20, alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8 },
    dispatchBoxText: { color: colors.white, fontSize: 12, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },

    /* USER MENU */
    avatarButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", borderWidth: 2, cursor: "pointer" },
    mapBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, cursor: "pointer" },
    mapBtnText: { color: colors.white, fontSize: 13, fontWeight: "600" },

    /* PROFILE MODAL */
    profileModal: {
      width: "90%", maxWidth: 420, maxHeight: "90%",
      borderRadius: 16, overflow: "hidden",
    },
    profileHeader: { padding: 24, paddingTop: 16 },
    profileAvatarSection: { alignItems: "center", marginTop: 8 },
    profileAvatarLarge: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", borderWidth: 3 },
    serviceBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: -10, borderWidth: 2, borderColor: colors.surface },
    serviceBadgeText: { color: colors.white, fontSize: 10, fontWeight: "bold" },
    profileName: { fontSize: 20, fontWeight: "bold", marginTop: 10 },
    profileRank: { fontSize: 14, fontWeight: "600", marginTop: 4 },
    profileBody: { flex: 1 },
    profileBodyContent: { padding: 20, paddingBottom: 32 },
    themeRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, padding: 14, borderWidth: 1, marginBottom: 16, gap: 8 },
    themeLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
    themeToggleBtn: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: "center" },
    themeToggleThumb: { width: 20, height: 20, borderRadius: 10 },
    dataCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    dataHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    dataTitle: { fontSize: 11, fontWeight: "bold", letterSpacing: 1 },
    dataValueBig: { fontSize: 26, fontWeight: "900" },
    dataValue: { fontSize: 16, fontWeight: "bold" },
    dataSub: { fontSize: 12, marginTop: 4 },
    profileLogoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 8, cursor: "pointer" },
    profileLogoutText: { fontSize: 14, fontWeight: "bold" },

    /* MAP MODAL */
    mapModalContainer: { flex: 1, margin: 20, borderRadius: 16, overflow: "hidden" },
    mapModalHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 14,
      backgroundColor: colors.drawerHeaderBg,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    mapModalTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
    mapModalClose: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", cursor: "pointer", backgroundColor: colors.whiteTranslucent },
    mapModalBody: { flex: 1, position: "relative", overflow: "hidden" },

    /* DETAIL MAP */
    detailMapWrap: { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
    detailMapHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
    updateLocBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, cursor: "pointer" },
    updateLocBtnText: { color: colors.white, fontSize: 11, fontWeight: "700" },
    detailMap: { height: 160, backgroundColor: "#0f1117" },
  });
