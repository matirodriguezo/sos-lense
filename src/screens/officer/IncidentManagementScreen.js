import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Linking,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { WebView } from "react-native-webview";
import { auth, db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  listenIncidentById,
  listenMessages,
  sendMessage,
  addQuickRequest,
  assignOfficer,
  sendSystemMessage,
  markMessageAsRead,
  updateParticipantStatus,
  OFFICER_STATUS,
  CITIZEN_STATUS,
  COMM_MODE,
} from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import MessageBubble from "../../components/MessageBubble";
import { useTheme } from "../../context/ThemeContext";
import WebRTCView from "../../components/WebRTCView";
import {
  listenSignaling,
  sendOffer,
  sendIceCandidate,
  clearSignaling,
} from "../../services/signalingService";
import { useNotifications } from "../../context/NotificationContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

console.log("%c[INCIDENT-MGMT] v2 - WEBRTC ENABLED", "color:#4ADE80;font-size:16px;font-weight:bold");

const DISPATCH_OPTIONS = [
  { id: 1, icon: "police-badge", label: "Despachar Patrulla", color: "#1976D2" },
  { id: 2, icon: "ambulance", label: "Solicitar SAMU", color: "#D32F2F" },
  { id: 3, icon: "chat-processing", label: "Chat de Texto", color: "#424242" },
];

const CITIZEN_STATUS_MAP = {
  [CITIZEN_STATUS.ALERT_SENT]: { label: "Alerta enviada", color: "#E040FB" },
  [CITIZEN_STATUS.IDLE]: { label: "Ciudadano inactivo", color: "#9E9E9E" },
  [CITIZEN_STATUS.CLASSIFYING]: { label: "Ciudadano clasificando", color: "#FBC02D" },
  [CITIZEN_STATUS.IN_CALL]: { label: "Ciudadano en videollamada", color: "#4ADE80" },
  [CITIZEN_STATUS.CHAT_ONLY]: { label: "Ciudadano en chat", color: "#42A5F5" },
  [CITIZEN_STATUS.IN_FAKE_APP]: { label: "En AppCamuflaje", color: "#F97316" },
};

const COMM_MODE_MAP = {
  [COMM_MODE.NOT_SET]: { label: "Sin definir", color: "#9E9E9E" },
  [COMM_MODE.VIDEO_CALL]: { label: "Videollamada", color: "#4ADE80" },
  [COMM_MODE.CHAT_ONLY]: { label: "Solo Chat", color: "#42A5F5" },
  [COMM_MODE.ALERT_ONLY]: { label: "Alerta de ubicación", color: "#FBC02D" },
};

export default function IncidentManagementScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { incidentId, autoOpenChat } = route.params;
  const { enterChat, leaveChat } = useNotifications();
  const insets = useSafeAreaInsets();
  const [incident, setIncident] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [elapsed, setElapsed] = useState("00:00");
  const [showChatModal, setShowChatModal] = useState(autoOpenChat || false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showMapTraceModal, setShowMapTraceModal] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [emergencyContact, setEmergencyContact] = useState(null);
  const [callError, setCallError] = useState(null);
  const flatListRef = useRef(null);
  const intervalRef = useRef(null);
  const markedRef = useRef(new Set());
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const webRTCRef = useRef(null);
  const connectionTimeoutRef = useRef(null);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    console.log("[IncidentMgmt] Mounted, incident:", incidentId, "autoOpenChat:", autoOpenChat);
    connectionTimeoutRef.current = setTimeout(() => {
      setCallError("No se pudo establecer la videollamada. Verifica que el ciudadano esté conectado.");
    }, 25000);
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      console.log("[IncidentMgmt] Unmounted");
    };
  }, []);

  // Track officer status on mount/unmount
  useEffect(() => {
    updateParticipantStatus(incidentId, "OFFICER", OFFICER_STATUS.IN_CALL).catch(() => {});
    return () => {
      updateParticipantStatus(incidentId, "OFFICER", OFFICER_STATUS.IDLE).catch(() => {});
    };
  }, [incidentId]);

  // Track chat modal open/close
  useEffect(() => {
    if (showChatModal) {
      updateParticipantStatus(incidentId, "OFFICER", OFFICER_STATUS.CHATTING).catch(() => {});
    } else {
      updateParticipantStatus(incidentId, "OFFICER", OFFICER_STATUS.IN_CALL).catch(() => {});
    }
  }, [showChatModal, incidentId]);

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

  const loadEmergencyContact = useCallback(async (citizenId) => {
    if (!citizenId) return;
    try {
      // Force server read to avoid stale IndexedDB cache on web
      let snap;
      try {
        snap = await getDoc(doc(db, "users", citizenId), { source: "server" });
      } catch {
        snap = await getDoc(doc(db, "users", citizenId));
      }
      if (snap.exists()) {
        const ec = snap.data().emergencyContact;
        if (ec?.phone) {
          console.log("[IncidentMgmt] emergencyContact loaded from user doc:", ec.name);
          setEmergencyContact(ec);
        } else {
          console.log("[IncidentMgmt] No emergencyContact in user doc");
        }
      }
    } catch (e) {
      console.warn("[IncidentMgmt] Error loading emergency contact:", e);
    }
  }, []);

  useEffect(() => {
    const unsubIncident = listenIncidentById(incidentId, async (data) => {
      setIncident(data);
      if (data.officerId && data.officerId !== auth.currentUser.uid) {
        Alert.alert("Caso ya asignado", `Este caso ya fue tomado por ${data.officerAlias || "otro oficial"}.`);
        navigation.goBack();
        return;
      }
      if (data.citizenId) {
        if (data.emergencyContact) {
          console.log("[IncidentMgmt] emergencyContact from incident doc:", data.emergencyContact.name);
          setEmergencyContact(data.emergencyContact);
        } else {
          loadEmergencyContact(data.citizenId);
        }
      }
      if (!data.officerId) {
        const officerAlias = getCurrentAlias();
        assignOfficer(incidentId, auth.currentUser.uid, officerAlias).catch(() => {});
        sendSystemMessage(incidentId, `${officerAlias || "Un oficial"} ha tomado tu caso.`).catch(() => {});
      }
    });
    const unsubMessages = listenMessages(incidentId, (data) => {
      setMessages(data);
    });

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      setElapsed(`${String(Math.floor(diff / 60)).padStart(2, "0")}:${String(diff % 60).padStart(2, "0")}`);
    }, 1000);

    return () => { leaveChat(); unsubIncident(); unsubMessages(); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [incidentId]);



  useEffect(() => {
    if (route.params?.autoOpenChat) {
      setShowChatModal(true);
    }
  }, [route.params]);

  useEffect(() => {
    if (!showChatModal || !incident?.citizenId) return;
    const uid = auth.currentUser?.uid;
    const unreadMsgs = messages.filter(
      (m) => m.senderRole === "CITIZEN" && !m.readBy?.includes(uid) && !markedRef.current.has(m.id)
    );
    unreadMsgs.forEach((m) => {
      markedRef.current.add(m.id);
      markMessageAsRead(incidentId, m.id, uid);
    });
  }, [messages, showChatModal, incident?.citizenId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (messages.length > 0 && showChatModal) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, showChatModal]);

  // Real WebRTC signaling — listen for citizen's answer and ICE
  useEffect(() => {
    if (!incident?.citizenId) return;
    const citizenId = incident.citizenId;
    const myUid = auth.currentUser?.uid;
    if (!myUid) return;

    console.log("[IncidentMgmt] Setting up signaling listener for citizen:", citizenId);

    const unsubSignaling = listenSignaling(incidentId, citizenId, {
      onAnswer: (sdp) => {
        console.log("[IncidentMgmt] Received answer from citizen");
        webRTCRef.current?.forwardSignaling("answer", sdp);
      },
      onIce: (candidate) => {
        webRTCRef.current?.forwardSignaling("ice", candidate);
      },
    });

    return () => {
      console.log("[IncidentMgmt] Cleaning up signaling");
      unsubSignaling();
      clearSignaling(incidentId, myUid);
      webRTCRef.current?.hangUp();
    };
  }, [incidentId, incident?.citizenId]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    try {
      await sendMessage(incidentId, text, auth.currentUser.uid, "OFFICER");
      console.log("[IncidentMgmt] Message sent (OFFICER):", text.slice(0, 40));
    } catch (e) { console.warn("[IncidentMgmt] Send error:", e); }
  };

  const handleDispatchAction = (label) => {
    setShowDispatchModal(false);
    if (label === "Chat de Texto") {
      setShowChatModal(true);
      return;
    }
    Alert.alert("Despacho", `¿Confirmas el despacho de: ${label}?`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Confirmar", onPress: async () => {
        try {
          await addQuickRequest(incidentId, label);
          await sendMessage(incidentId, `[SISTEMA] Central ha despachado: ${label}`, auth.currentUser.uid, "OFFICER");
          console.log("[IncidentMgmt] Dispatched:", label);
          Alert.alert("Despachado", "La unidad ha sido notificada.");
        } catch (e) { console.warn("[IncidentMgmt] Dispatch error:", e); }
      }},
    ]);
  };

  const handleFinalize = () => {
    Alert.alert("Finalizar procedimiento", "¿Estás seguro de que deseas cerrar este caso?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Continuar", onPress: () => {
        console.log("[IncidentMgmt] Navigating to CloseIncident");
        navigation.replace("CloseIncident", { incidentId });
      }},
    ]);
  };

  const handleBack = () => {
    Alert.alert("Salir", "¿Estás seguro de salir de este procedimiento?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => {
        console.log("[IncidentMgmt] Officer exited");
        navigation.goBack();
      }},
    ]);
  };

  const isMine = (msg) => msg.senderId === auth.currentUser?.uid;

  const handleWebRTCMessage = (type, data) => {
    switch (type) {
      case "ready":
        console.log("[IncidentMgmt] WebRTC ready, creating offer");
        webRTCRef.current?.forwardSignaling("makeOffer");
        break;
      case "offer":
        sendOffer(incidentId, auth.currentUser?.uid, data).catch(() => {});
        break;
      case "ice":
        sendIceCandidate(incidentId, auth.currentUser?.uid, data).catch(() => {});
        break;
      case "remote_on":
        console.log("[IncidentMgmt] Remote video received");
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        setConnecting(false);
        setCallActive(true);
        break;
      case "disconnected":
        console.warn("[IncidentMgmt] WebRTC disconnected");
        break;
      case "error":
        console.error("[IncidentMgmt] WebRTC error:", data);
        setCallError(data);
        break;
    }
  };

  const openMaps = () => {
    if (!incident?.latitude || !incident?.longitude) {
      Alert.alert("Ubicación no disponible", "No se ha registrado la ubicación del ciudadano.");
      return;
    }
    Alert.alert("Abrir mapa", "¿Deseas abrir la ubicación en tu aplicación de mapas?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Abrir", onPress: () => {
        const url = Platform.OS === "ios"
          ? `maps://app?daddr=${incident.latitude},${incident.longitude}`
          : `geo:${incident.latitude},${incident.longitude}?q=${incident.latitude},${incident.longitude}`;
        Linking.openURL(url).catch(() => {
          Linking.openURL(`https://maps.google.com/maps?daddr=${incident.latitude},${incident.longitude}`);
        });
      }},
    ]);
  };

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const isFinal = incident?.status === "CERRADO" || incident?.status === "ANULADO";
  const GRAY = "#6B7280";

  const traceMapHtml = useMemo(() => {
    const pts = [];
    const labels = [];
    const times = [];
    if (incident?.locationHistory?.length > 0) {
      incident.locationHistory.forEach((p) => { if (p.lat && p.lng) { pts.push([p.lat, p.lng]); labels.push(p.label || ""); times.push(p._t || null); } });
    } else if (incident?.latitude && incident?.longitude) {
      pts.push([incident.latitude, incident.longitude]);
      labels.push("Actual");
    }
    const count = pts.length;
    const center = count > 0 ? `[${pts[0][0]}, ${pts[0][1]}]` : "[-33.4489, -70.6693]";
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: system-ui, sans-serif; background: #0f1117; }
          #map { width: 100vw; height: 100vh; }
          .leaflet-popup-content-wrapper { border-radius: 8px; }
          .leaflet-popup-content { margin: 8px 12px; font-size: 13px; line-height: 1.4; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19
          }).addTo(map);
          var pts = ${JSON.stringify(pts)};
          var lbls = ${JSON.stringify(labels)};
          var tms = ${JSON.stringify(times)};
          var count = pts.length;
          pts.forEach(function(pt, i) {
            var isNewest = i === count - 1;
            var isOldest = i === 0;
            var num = i + 1;
            var bg = isNewest ? '#D32F2F' : isOldest ? '#6B7280' : '#3B82F6';
            var size = isNewest ? 32 : 26;
            var icon = L.divIcon({
              className: '',
              html: '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+bg+';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;font-family:sans-serif;">'+num+'</div>',
              iconSize: [size, size], iconAnchor: [size/2, size/2],
            });
            var marker = L.marker(pt, { icon }).addTo(map);
            var label = lbls[i] || 'Punto ' + num;
            var tm = tms[i];
            var timeStr = tm ? new Date(tm).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
            marker.bindPopup('<b>#'+num+'</b> &mdash; '+label + (timeStr ? '<br/><span style="color:#9CA3AF;font-size:11px;">' + timeStr + '</span>' : '') + (isNewest ? '<br/><i style="color:#D32F2F">Última ubicación</i>' : '') + (isOldest && count > 1 ? '<br/><i style="color:#6B7280">Inicio</i>' : ''));
          });
          if (count > 1) {
            L.polyline(pts, { color: '#3B82F6', weight: 2, opacity: 0.5, dashArray: '5,5' }).addTo(map);
          }
          if (count > 0) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
          else map.setView(${center}, 12);

          var legend = L.control({ position: 'bottomleft' });
          legend.onAdd = function() {
            var div = L.DomUtil.create('div');
            div.style.cssText = 'background:rgba(15,17,23,0.85);color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-family:sans-serif;font-weight:600;';
            div.innerHTML = count + (count === 1 ? ' ubicación' : ' ubicaciones');
            return div;
          };
          legend.addTo(map);
        </script>
      </body>
      </html>
    `;
  }, [incident?.latitude, incident?.longitude, incident?.locationHistory]);

  const renderMessage = useCallback(({ item }) => (
    <MessageBubble
      message={item}
      isMine={item.senderId === auth.currentUser?.uid}
      otherRole="CITIZEN"
      otherUserId={incident?.citizenId}
      currentUserId={auth.currentUser?.uid}
      citizenAlias={incident?.citizenAlias}
      officerAlias={incident?.officerAlias}
    />
  ), [incident?.citizenId, incident?.citizenAlias, incident?.officerAlias]);

  return (
    <KeyboardAvoidingView style={[s.container, { backgroundColor: "#000" }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={{ flex: 1, position: "relative" }}>
        {/* WebRTC video background */}
        {!isFinal && !callError && (
          <WebRTCView ref={webRTCRef} onWebRTCMessage={handleWebRTCMessage} style={s.webRTCBg} />
        )}

        {/* Overlay content */}
        {isFinal ? (
          <View style={s.connectingContainer}>
            <MaterialCommunityIcons name="check-circle-outline" size={80} color={GRAY} />
            <Text style={[s.connectedText, { color: GRAY }]}>PROCEDIMIENTO FINALIZADO</Text>
            <Text style={[s.connectedSub, { color: GRAY }]}>Este caso ha sido cerrado.</Text>
          </View>
        ) : callError ? (
          <View style={s.connectingContainer}>
            <MaterialCommunityIcons name="close-circle-outline" size={80} color="#EF4444" />
            <Text style={[s.connectedText, { color: "#EF4444" }]}>ERROR DE CONEXIÓN</Text>
            <Text style={[s.connectingSub, { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13, textAlign: "center", paddingHorizontal: 32 }]}>{callError}</Text>
            <TouchableOpacity
              style={{ marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: "#4ADE80", borderRadius: 8 }}
              onPress={() => { setCallError(null); setConnecting(true); webRTCRef.current?.hangUp(); }}
            >
              <Text style={{ color: "#000", fontWeight: "bold", fontSize: 14 }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : connecting ? (
          <View style={s.connectingContainer}>
            <Animated.View style={[s.pulseCircle, { opacity: pulseOpacity }]}>
              <MaterialCommunityIcons name="cellphone-link" size={64} color="#4ADE80" />
            </Animated.View>
            <Text style={s.connectingText}>Conectando...</Text>
            <Text style={s.connectingSub}>Estableciendo enlace con ciudadano</Text>
            <ActivityIndicator size="small" color="#4ADE80" style={{ marginTop: 20 }} />
          </View>
        ) : null}

        <View style={[s.header, { top: insets.top }]}>
          <TouchableOpacity style={[s.backBtn, { backgroundColor: isFinal ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.15)" }]} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={isFinal ? GRAY : colors.white} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={[s.headerSub, { color: isFinal ? GRAY : colors.whiteTranslucent }]}>Procedimiento</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[s.headerTitle, { color: isFinal ? GRAY : colors.white }]}>#{incidentId?.slice(0, 8)?.toUpperCase()}</Text>
              <Text style={[s.elapsedText, { color: isFinal ? GRAY : colors.whiteTranslucent }]}>{elapsed}</Text>
            </View>
              {(incident?.citizenId) && (
                <View style={[s.citizenBadge, { backgroundColor: isFinal ? GRAY : (CITIZEN_STATUS_MAP[incident?.participantStatus?.citizen]?.color || "#9E9E9E") }]}>
                  <Text style={s.citizenBadgeText}>{incident?.participantStatus?.citizen ? (CITIZEN_STATUS_MAP[incident.participantStatus.citizen]?.label || "Desconocido") : "Sin datos"}</Text>
                </View>
              )}
              {incident?.participantStatus?.communication && (
                <View style={[s.commBadge, { backgroundColor: isFinal ? GRAY : (COMM_MODE_MAP[incident.participantStatus.communication]?.color || "#9E9E9E") }]}>
                  <Text style={s.citizenBadgeText}>{COMM_MODE_MAP[incident.participantStatus.communication]?.label || "Desconocido"}</Text>
                </View>
              )}
            </View>
            <View style={[s.statusBadge, { backgroundColor: isFinal ? GRAY : colors.badgeRed }]}>
              <Text style={[s.statusBadgeText, { color: colors.white }]}>● {isFinal ? incident?.status === "ANULADO" ? "ANULADO" : "FINALIZADO" : "EN CURSO"}</Text>
            </View>
          </View>

        {/* Emergency contact card — below header, visible in flow */}
        {emergencyContact && (
          <View style={s.emergencyCardInFlow}>
            <View style={{ flex: 1 }}>
              <Text style={s.emergencyCardLabel}>Contacto de Emergencia</Text>
              <Text style={s.emergencyCardName}>{emergencyContact.name || "Sin nombre"}</Text>
              <Text style={s.emergencyCardPhone}>{emergencyContact.phone}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={s.emergencyActionBtn} onPress={() => Linking.openURL(`tel:${emergencyContact.phone}`)}>
                <Ionicons name="call" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.emergencyActionBtn} onPress={() => Linking.openURL(`sms:${emergencyContact.phone}`)}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Bottom bar — in the flow */}
        {(callActive || isFinal) && (
          <View style={[s.bottomBarInFlow, { paddingBottom: insets.bottom + 8 }]}>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: isFinal ? GRAY : colors.blueDispatch }]} onPress={() => setShowDispatchModal(true)} disabled={isFinal}>
              <MaterialCommunityIcons name="radio-handheld" size={22} color={isFinal ? "#4B5563" : colors.white} />
              <Text style={[s.ctrlLabel, { color: isFinal ? "#4B5563" : colors.white }]}>Despacho</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: isFinal ? GRAY : "#16A34A" }]} onPress={() => setShowMapTraceModal(true)} disabled={isFinal}>
              <Ionicons name="location-outline" size={22} color={isFinal ? "#4B5563" : colors.white} />
              <Text style={[s.ctrlLabel, { color: isFinal ? "#4B5563" : colors.white }]}>Ubicación</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtnLarge, { backgroundColor: isFinal ? GRAY : colors.badgeRed }]} onPress={handleFinalize} disabled={isFinal}>
              <Text style={[s.finalizeLabel, { color: isFinal ? "#4B5563" : colors.white }]}>Finalizar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ctrlBtn, { backgroundColor: isFinal ? GRAY : "rgba(255,255,255,0.2)" }]} onPress={() => setShowChatModal(true)} disabled={isFinal}>
              <Ionicons name="chatbubble-ellipses" size={22} color={isFinal ? "#4B5563" : colors.white} />
              <Text style={[s.ctrlLabel, { color: isFinal ? "#4B5563" : colors.white }]}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={showDispatchModal} transparent animationType="slide">
        <TouchableOpacity style={[s.modalOverlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setShowDispatchModal(false)}>
          <View style={[s.dispatchSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <Text style={[s.dispatchSheetTitle, { color: colors.textPrimary }]}>Opciones de Despacho</Text>
            {incident?.address && (
              <TouchableOpacity style={[s.addressCard, { backgroundColor: colors.inputBg }]} onPress={openMaps}>
                <Ionicons name="location" size={18} color={colors.primary} />
                <Text style={[s.addressText, { color: colors.textPrimary }]} numberOfLines={2}>{incident.address}</Text>
              </TouchableOpacity>
            )}
            {emergencyContact && (
              <View style={[s.emergencyCard, { backgroundColor: colors.inputBg }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={[s.emergencyTitle, { color: colors.danger }]}>Contacto de Emergencia</Text>
                </View>
                <Text style={[s.emergencyName, { color: colors.textPrimary }]}>{emergencyContact.name}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${emergencyContact.phone}`)}>
                  <Text style={[s.emergencyPhone, { color: colors.primary }]}>{emergencyContact.phone}</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={s.dispatchGrid}>
              {DISPATCH_OPTIONS.map((item) => (
                <TouchableOpacity key={item.id} style={[s.dispatchBox, { backgroundColor: item.color }]} onPress={() => handleDispatchAction(item.label)}>
                  <MaterialCommunityIcons name={item.icon} size={32} color={colors.white} style={{ marginBottom: 8 }} />
                  <Text style={s.dispatchBoxText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showMapTraceModal} transparent animationType="slide">
        <View style={[s.mapTraceContainer, { backgroundColor: colors.drawerHeaderBg }]}>
          <View style={s.mapTraceHeader}>
            <View>
              <Text style={s.mapTraceTitle}>Trazabilidad de Ubicación</Text>
              <Text style={s.mapTraceSub}>
                {(incident?.locationHistory?.length || 1)} {(incident?.locationHistory?.length || 0) === 1 ? "ubicación" : "ubicaciones"} — Folio #{incidentId?.slice(0, 8)?.toUpperCase()}
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity style={s.mapTraceExtBtn} onPress={openMaps}>
                <Ionicons name="open-outline" size={18} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity style={s.mapTraceCloseBtn} onPress={() => setShowMapTraceModal(false)}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
          <WebView source={{ html: traceMapHtml }} style={{ flex: 1, backgroundColor: "#0f1117" }} scrollEnabled={false} bounces={false} />
        </View>
      </Modal>

      <Modal visible={showChatModal} transparent animationType="slide">
        <KeyboardAvoidingView style={[s.modalOverlay, { backgroundColor: colors.overlay }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.chatSheet, { backgroundColor: colors.surface, paddingBottom: 20 + insets.bottom }]}>
            <View style={s.chatSheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[s.chatSheetTitle, { color: colors.textPrimary }]}>Chat de Emergencia</Text>
              </View>
              <TouchableOpacity onPress={() => setShowChatModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <Text style={[s.chatSheetSub, { color: colors.textSecondary }]}>Canal de respaldo — texto alternativo a LENSE</Text>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              style={s.chatList}
              initialNumToRender={15}
              maxToRenderPerBatch={10}
              windowSize={5}
              removeClippedSubviews={Platform.OS !== "web"}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={<Text style={[s.emptyChat, { color: colors.textSecondary }]}>Sin mensajes.</Text>}
              renderItem={renderMessage}
            />
            <View style={s.inputRow}>
              <TextInput
                style={[s.chatInput, { backgroundColor: isFinal ? GRAY : colors.inputBg, color: isFinal ? GRAY : colors.textPrimary, borderColor: isFinal ? GRAY : colors.border }]}
                value={input}
                onChangeText={setInput}
                placeholder={isFinal ? "Chat cerrado" : "Escriba un mensaje..."}
                placeholderTextColor={isFinal ? GRAY : colors.textSecondary}
                onSubmitEditing={isFinal ? undefined : handleSend}
                editable={!isFinal}
              />
              <TouchableOpacity style={[s.sendBtn, { backgroundColor: isFinal ? GRAY : colors.primary }]} onPress={handleSend} disabled={isFinal}>
                <Ionicons name="send" size={18} color={isFinal ? "#4B5563" : colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1 },

    connectingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#000" },
    pulseCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(74,222,128,0.1)", justifyContent: "center", alignItems: "center" },
    connectingText: { color: "#4ADE80", marginTop: 24, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
    connectingSub: { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13 },
    connectedText: { color: "#4ADE80", marginTop: 24, fontSize: 22, fontWeight: "900", letterSpacing: 1 },
    connectedSub: { color: "rgba(255,255,255,0.5)", marginTop: 8, fontSize: 13 },

    header: {
      position: "absolute", left: 0, right: 0, zIndex: 10,
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 12, paddingVertical: 8,
    },
    backBtn: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)" },
    headerCenter: { alignItems: "center" },
    headerSub: { fontSize: 11, fontWeight: "bold" },
    headerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 1 },
    elapsedText: { fontSize: 11, fontWeight: "600" },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
    statusBadgeText: { fontSize: 9, fontWeight: "bold", letterSpacing: 0.5 },

    bottomBar: {
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
      flexDirection: "row", justifyContent: "center", gap: 14,
      paddingTop: 10, paddingHorizontal: 16,
    },
    bottomBarInFlow: {
      flexDirection: "row", justifyContent: "center", gap: 14,
      paddingTop: 10, paddingHorizontal: 16, paddingBottom: 8,
    },
    ctrlBtn: {
      width: 80, height: 64, borderRadius: 32,
      justifyContent: "center", alignItems: "center",
    },
    ctrlBtnLarge: {
      width: 110, height: 64, borderRadius: 32,
      justifyContent: "center", alignItems: "center",
    },
    ctrlLabel: { color: colors.white, fontSize: 10, fontWeight: "bold", marginTop: 2 },
    finalizeLabel: { color: colors.white, fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 },

    modalOverlay: { flex: 1, justifyContent: "flex-end" },

    dispatchSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
    dispatchSheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
    addressCard: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 12, marginBottom: 16 },
    addressText: { fontSize: 13, fontWeight: "500", flex: 1 },
    emergencyCard: { borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: colors.danger },
    emergencyTitle: { fontSize: 12, fontWeight: "700" },
    emergencyName: { fontSize: 14, fontWeight: "600", marginLeft: 26, marginBottom: 2 },
    emergencyPhone: { fontSize: 14, fontWeight: "500", marginLeft: 26, textDecorationLine: "underline" },

    emergencyCardInFlow: {
      flexDirection: "row", alignItems: "center",
      padding: 14, marginHorizontal: 16, marginBottom: 10,
      borderRadius: 12, gap: 12,
      backgroundColor: "rgba(220,38,38,0.85)",
    },
    emergencyCardLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
    emergencyCardName: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 2 },
    emergencyCardPhone: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "500", marginTop: 1 },
    emergencyActionBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: "rgba(255,255,255,0.25)",
      justifyContent: "center", alignItems: "center",
    },
    dispatchGrid: { flexDirection: "row", gap: 12 },
    dispatchBox: { flex: 1, borderRadius: 14, paddingVertical: 20, alignItems: "center", justifyContent: "center" },
    dispatchBoxText: { color: colors.white, fontSize: 12, fontWeight: "bold", textAlign: "center", paddingHorizontal: 4 },

    chatSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: "60%" },
    chatSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    chatSheetTitle: { fontSize: 18, fontWeight: "bold" },
    chatSheetSub: { fontSize: 12, marginBottom: 16 },
    chatList: { flex: 1 },
    emptyChat: { textAlign: "center", marginTop: 20 },
    inputRow: { flexDirection: "row", gap: 12, marginTop: 16 },
    chatInput: { flex: 1, borderRadius: 8, paddingHorizontal: 16, height: 48, borderWidth: 1, textAlignVertical: "center" },
    sendBtn: { width: 48, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    citizenBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: "center" },
    commBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2, alignSelf: "center" },
    citizenBadgeText: { color: "#fff", fontSize: 9, fontWeight: "bold", letterSpacing: 0.3 },

    /* MAP TRACE MODAL */
    mapTraceContainer: { flex: 1, marginTop: 40, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: "hidden" },
    mapTraceHeader: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12,
      backgroundColor: colors.drawerHeaderBg,
    },
    mapTraceTitle: { color: colors.white, fontSize: 15, fontWeight: "700" },
    mapTraceSub: { color: colors.whiteTranslucent, fontSize: 11, marginTop: 2 },
    mapTraceCloseBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: colors.whiteTranslucent },
    mapTraceExtBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center", backgroundColor: colors.primary },
    webRTCBg: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  });
