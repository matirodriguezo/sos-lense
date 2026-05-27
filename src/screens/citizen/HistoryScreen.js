import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenCitizenHistory, cancelIncident, sendMessage } from "../../services/incidentService";
import { INCIDENT_STATUS } from "../../constants/roles";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

const TYPE_CONFIG = {
  ACCIDENTE: { icon: "car-outline", label: "Accidente de Tránsito", gifPath: require("../../assets/gifs/Accidente de transito.gif") },
  ROBO: { icon: "shield-half-outline", label: "Robo o Asalto", gifPath: require("../../assets/gifs/Robo o Asalto.gif") },
  VIOLENCIA: { icon: "home-outline", label: "Violencia Intrafamiliar", gifPath: require("../../assets/gifs/Violencia.gif") },
  MEDICA: { icon: "pulse-outline", label: "Emergencia Médica", gifPath: require("../../assets/gifs/Emergencia Medica.gif") },
  OTRO: { icon: "alert-circle-outline", label: "Otro Incidente", gifPath: null },
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
  const { colors } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("activas");

  const s = useMemo(() => makeStyles(colors), [colors]);

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
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.cardRow}>
          <View style={[s.cardIconWrap, { backgroundColor: colors.greenTranslucent }, isActive && { backgroundColor: statusColor + "20" }]}>
            {config.gifPath ? (
              <Image source={config.gifPath} style={s.cardGif} resizeMode="contain" />
            ) : (
              <Ionicons name={config.icon} size={28} color={isActive ? statusColor : colors.primary} />
            )}
          </View>
          <View style={s.cardContent}>
            <View style={s.cardHeaderRow}>
              <Text style={[s.cardTitle, { color: colors.textPrimary }]}>{config.label}</Text>
              <View style={[s.statusBadge, { backgroundColor: statusColor + "18" }]}>
                <Text style={[s.statusText, { color: statusColor }]}>
                  {getStatusText(item.status)}
                </Text>
              </View>
            </View>
            <Text style={[s.cardFolio, { color: colors.textSecondary }]}>Folio #{item.id.slice(0, 7).toUpperCase()}</Text>

            <View style={s.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={[s.locationText, { color: colors.emptyText }]} numberOfLines={1}>
                {item.address || (item.latitude ? `${item.latitude?.toFixed(4)}, ${item.longitude?.toFixed(4)}` : "Sin ubicación")}
              </Text>
            </View>

            {item.officerAlias && (
              <View style={s.officerRow}>
                <Ionicons name="police-badge-outline" size={14} color={colors.primary} />
                <Text style={[s.officerText, { color: colors.primary }]}>{item.officerAlias}</Text>
              </View>
            )}
          </View>
        </View>

        {isActive && (
          <View style={[s.actionsRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[s.rejoinBtn, { backgroundColor: colors.primary }]}
              onPress={() => handleRejoin(item)}
            >
              <Ionicons name="videocam-outline" size={16} color={colors.white} />
              <Text style={[s.rejoinBtnText, { color: colors.white }]}>Reingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.cancelBtn, { backgroundColor: colors.statusRedBg, borderColor: colors.statusRedBorder }]}
              onPress={() => handleCancel(item)}
            >
              <Ionicons name="close-outline" size={16} color={colors.badgeRed} />
              <Text style={[s.cancelBtnText, { color: colors.badgeRed }]}>Anular</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isActive && item.closedReason && (
          <View style={[s.reasonRow, { borderTopColor: colors.border }]}>
            <Text style={[s.reasonLabel, { color: colors.emptyText }]}>Motivo:</Text>
            <Text style={[s.reasonText, { color: colors.textSecondary }]}>{item.closedReason}</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <View style={[s.navbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={{ width: 36 }} />
        <Text style={[s.navTitle, { color: colors.textPrimary }]}>Mis Incidentes</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[s.tabRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[s.tab, activeTab === "activas" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("activas")}
        >
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === "activas" && { color: colors.primary, fontWeight: "bold" }]}>
            Activas ({activeIncidents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === "historial" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("historial")}
        >
          <Text style={[s.tabText, { color: colors.textSecondary }, activeTab === "historial" && { color: colors.primary, fontWeight: "bold" }]}>
            Historial ({closedIncidents.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={data.length === 0 ? s.emptyContainer : s.list}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Ionicons
              name={activeTab === "activas" ? "checkmark-circle-outline" : "document-text-outline"}
              size={64}
              color={colors.border}
            />
            <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>
              {activeTab === "activas" ? "Sin incidentes activos" : "Sin historial"}
            </Text>
            <Text style={[s.emptySub, { color: colors.emptyText }]}>
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

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

    navbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
    },
    navTitle: { fontSize: 16, fontWeight: "bold" },

    tabRow: { flexDirection: "row", borderBottomWidth: 1 },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 3, borderBottomColor: "transparent" },
    tabText: { fontSize: 14, fontWeight: "600" },

    list: { padding: 20 },
    emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    emptyState: { alignItems: "center", paddingHorizontal: 32 },
    emptyTitle: { fontSize: 18, fontWeight: "bold", marginTop: 16 },
    emptySub: { fontSize: 14, marginTop: 8, textAlign: "center" },

    card: {
      borderRadius: 12, padding: 16,
      marginBottom: 12, borderWidth: 1,
      shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    cardIconWrap: {
      width: 50, height: 50, borderRadius: 10,
      justifyContent: "center", alignItems: "center",
    },
    cardGif: { width: 32, height: 32 },
    cardContent: { flex: 1 },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
    cardTitle: { fontSize: 15, fontWeight: "bold", flex: 1 },
    cardFolio: { fontSize: 12, marginBottom: 6, fontWeight: "600" },
    locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    locationText: { fontSize: 12, marginLeft: 4, flex: 1 },
    officerRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
    officerText: { fontSize: 12, fontWeight: "600" },

    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },

    actionsRow: { flexDirection: "row", gap: 12, marginTop: 16, borderTopWidth: 1, paddingTop: 12 },
    rejoinBtn: {
      flex: 1, flexDirection: "row", borderRadius: 8,
      paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 6,
    },
    rejoinBtnText: { fontSize: 14, fontWeight: "bold" },
    cancelBtn: {
      flex: 1, flexDirection: "row", borderRadius: 8,
      paddingVertical: 12, justifyContent: "center", alignItems: "center", gap: 6,
      borderWidth: 1,
    },
    cancelBtnText: { fontSize: 14, fontWeight: "bold" },

    reasonRow: { marginTop: 12, borderTopWidth: 1, paddingTop: 12 },
    reasonLabel: { fontSize: 11, fontWeight: "bold", marginBottom: 4 },
    reasonText: { fontSize: 13, fontStyle: "italic" },
  });
