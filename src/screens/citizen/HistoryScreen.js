import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenCitizenHistory } from "../../services/incidentService";
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
    case "ACTIVO": return "#FFC107"; // Amarillo/Warning
    case "EN_CURSO": return "#004B2B"; // Verde Institucional
    case "CERRADO": return "#666666"; // Gris
    default: return "#666666";
  }
};

const getStatusText = (status) => {
  switch (status) {
    case "NO_CLASIFICADO": return "Sin clasificar";
    case "ACTIVO": return "Activo - Esperando";
    case "EN_CURSO": return "En curso";
    case "CERRADO": return "Cerrado";
    default: return status;
  }
};

export default function HistoryScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = listenCitizenHistory(user.uid, (data) => {
      setIncidents(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const renderItem = ({ item }) => {
    const config = TYPE_CONFIG[item.type] || { icon: "alert-circle-outline", label: item.type || "Sin clasificar" };
    const statusColor = getStatusColor(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name={config.icon} size={28} color="#004B2B" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{config.label}</Text>
            <Text style={styles.cardFolio}>Folio #{item.id.slice(0, 7).toUpperCase()}</Text>
            
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#666666" />
              <Text style={styles.locationText}>
                {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "15" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
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
        <Text style={styles.navTitle}>Historial de Incidentes</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={incidents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={incidents.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>Sin incidentes</Text>
            <Text style={styles.emptySub}>No has reportado ningún incidente en la plataforma.</Text>
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
  cardTitle: { fontSize: 15, fontWeight: "bold", color: "#1A1A1A", marginBottom: 4 },
  cardFolio: { fontSize: 12, color: "#666666", marginBottom: 6, fontWeight: "600" },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  locationText: { fontSize: 12, color: "#A0A0A0", marginLeft: 4 },
  
  statusBadge: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, alignSelf: "flex-start",
  },
  statusText: { fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },
});