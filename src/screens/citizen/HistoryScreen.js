import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenCitizenHistory, cancelIncident, sendMessage } from "../../services/incidentService";
import { INCIDENT_STATUS } from "../../constants/roles";
import { Ionicons } from "@expo/vector-icons";

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car-outline", label: "Accidente de Tránsito" },
  ROBO: { icon: "shield-half-outline", label: "Robo o Asalto" },
  VIOLENCIA: { icon: "home-outline", label: "Violencia Intrafamiliar" },
  MEDICA: { icon: "pulse-outline", label: "Emergencia Médica" },
  OTRO: { icon: "alert-circle-outline", label: "Otro Incidente" },
};

const getStatusColor = (status) => {
  switch (status) {
    case "NO_CLASIFICADO": return "#F57C00";
    case "ACTIVO": return "#FFC107";
    case "EN_CURSO": return "#004B2B";
    case "CERRADO": return "#666666";
    case "ANULADO": return "#9E9E9E";
    default: return "#666666";
  }
};

const getStatusText = (status) => {
  switch (status) {
    case "NO_CLASIFICADO": return "Sin clasificar";
    case "ACTIVO": return "Activo";
    case "EN_CURSO": return "En curso";
    case "CERRADO": return "Cerrado";
    case "ANULADO": return "Anulado";
    default: return status;
  }
};

export default function HistoryScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("activas");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = listenCitizenHistory(user.uid, (data) => {
      setIncidents(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const activeIncidents = incidents.filter(
    (i) =>
      i.status === INCIDENT_STATUS.NO_CLASIFICADO ||
      i.status === INCIDENT_STATUS.ACTIVO ||
      i.status === INCIDENT_STATUS.EN_CURSO
  );
  const closedIncidents = incidents.filter(
    (i) => i.status === INCIDENT_STATUS.CERRADO || i.status === INCIDENT_STATUS.ANULADO
  );

  const data = activeTab === "activas" ? activeIncidents : closedIncidents;

  const handleCancel = (incident) => {
    Alert.alert(
      "Anular incidente",
      `¿Estás seguro de anular el caso #${incident.id.slice(0, 7).toUpperCase()}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, anular",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelIncident(incident.id, "Anulado por el ciudadano desde historial");
              await sendMessage(
                incident.id,
                "🔴 Incidente anulado por el ciudadano.",
                auth.currentUser.uid,
                "CITIZEN"
              );
              Alert.alert("Anulado", "El incidente ha sido cancelado.");
            } catch {
              Alert.alert("Error", "No se pudo anular el incidente.");
            }
          },
        },
      ]
    );
  };

  const handleRejoin = (incident) => {
    navigation.navigate("VideoCall", { incidentId: incident.id });
  };

  const renderItem = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || { icon: "alert-circle-outline", label: item.type || "Sin clasificar" };
    const statusColor = getStatusColor(item.status);
    const isActive =
      item.status === INCIDENT_STATUS.NO_CLASIFICADO ||
      item.status === INCIDENT_STATUS.ACTIVO ||
      item.status === INCIDENT_STATUS.EN_CURSO;

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={[styles.cardIconWrap, isActive && { backgroundColor: statusColor + "20" }]}>
            <Ionicons name={config.icon} size={28} color={isActive ? statusColor : "#004B2B"} />
          </View>
          <View style={styles.cardContent}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{config.label}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {getStatusText(item.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardFolio}>Folio #{item.id.slice(0, 7).toUpperCase()}</Text>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#666666" />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.address || (item.latitude ? `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}` : "Sin ubicación")}
              </Text>
            </View>

            {item.officerAlias && (
              <View style={styles.officerRow}>
                <Ionicons name="police-badge-outline" size={14} color="#004B2B" />
                <Text style={styles.officerText}>{item.officerAlias}</Text>
              </View>
            )}
          </View>
        </View>

        {isActive && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.rejoinBtn}
              onPress={() => handleRejoin(item)}
            >
              <Ionicons name="videocam-outline" size={16} color="#FFFFFF" />
              <Text style={styles.rejoinBtnText}>Reingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => handleCancel(item)}
            >
              <Ionicons name="close-outline" size={16} color="#D32F2F" />
              <Text style={styles.cancelBtnText}>Anular</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isActive && item.closedReason && (
          <View style={styles.reasonRow}>
            <Text style={styles.reasonLabel}>Motivo:</Text>
            <Text style={styles.reasonText}>{item.closedReason}</Text>
          </View>
        )}
      </View>
    );
  };

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
      <View style={styles.navbar}>
        <View style={{ width: 36 }} />
        <Text style={styles.navTitle}>Mis Incidentes</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "activas" && styles.tabActive]}
          onPress={() => setActiveTab("activas")}
        >
          <Text style={[styles.tabText, activeTab === "activas" && styles.tabTextActive]}>
            Activas ({activeIncidents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "historial" && styles.tabActive]}
          onPress={() => setActiveTab("historial")}
        >
          <Text style={[styles.tabText, activeTab === "historial" && styles.tabTextActive]}>
            Historial ({closedIncidents.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={data.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons
              name={activeTab === "activas" ? "checkmark-circle-outline" : "document-text-outline"}
              size={64}
              color="#E0E0E0"
            />
            <Text style={styles.emptyTitle}>
              {activeTab === "activas" ? "Sin incidentes activos" : "Sin historial"}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === "activas"
                ? "No tienes llamadas SOS activas en este momento."
                : "Los incidentes cerrados aparecerán aquí."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E0E0E0",
  },
  navTitle: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },

  tabRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E0E0E0", backgroundColor: "#FFFFFF" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#004B2B" },
  tabText: { fontSize: 14, color: "#666666", fontWeight: "600" },
  tabTextActive: { color: "#004B2B", fontWeight: "bold" },

  list: { padding: 20 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "bold", color: "#666666", marginTop: 16 },
  emptySub: { fontSize: 14, color: "#A0A0A0", marginTop: 8, textAlign: "center" },

  card: {
    backgroundColor: "#FFFFFF", borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: "#E0E0E0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardIconWrap: {
    width: 50, height: 50, borderRadius: 10,
    backgroundColor: "#F2F7F5", justifyContent: "center", alignItems: "center",
  },
  cardContent: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#1A1A1A", flex: 1 },
  cardFolio: { fontSize: 12, color: "#666666", marginBottom: 6, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  locationText: { fontSize: 12, color: "#A0A0A0", marginLeft: 4, flex: 1 },
  officerRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  officerText: { fontSize: 12, color: "#004B2B", fontWeight: "600" },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12 },
  rejoinBtn: {
    flex: 1, flexDirection: "row", backgroundColor: "#004B2B", borderRadius: 8,
    paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 6,
  },
  rejoinBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  cancelBtn: {
    flex: 1, flexDirection: "row", backgroundColor: "#FFF0F0", borderRadius: 8,
    paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "#FFD6D6",
  },
  cancelBtnText: { color: "#D32F2F", fontSize: 14, fontWeight: "bold" },

  reasonRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 12 },
  reasonLabel: { fontSize: 11, color: "#A0A0A0", fontWeight: "bold", marginBottom: 4 },
  reasonText: { fontSize: 13, color: "#666666", fontStyle: "italic" },
});
