import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listenAllActiveIncidents } from "../../services/incidentService";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function MapScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = listenAllActiveIncidents((data) => { setIncidents(data); setLoading(false); });
    return unsub;
  }, []);

  if (loading) return ( <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#004B2B" /></View> );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#003A20" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#FFFFFF" /></TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={styles.headerTitle}>Mapa Global</Text>
            <Text style={styles.headerSub}>Sector Sur · {incidents.length} unidades activas</Text>
        </View>
        <TouchableOpacity style={styles.layerBtn}><Ionicons name="layers-outline" size={20} color="#FFFFFF" /></TouchableOpacity>
      </View>

      <View style={styles.mapArea}>
        <View style={styles.mapPlaceholder}>
          <MaterialCommunityIcons name="radar" size={80} color="rgba(0,75,43,0.1)" />
          <View style={styles.radarTarget} />
        </View>
        
        <View style={styles.legendBox}>
            <Text style={styles.legendTitle}>UNIDADES EN TERRENO</Text>
            <Text style={styles.legendText}><Text style={{color: '#1976D2'}}>●</Text> Patrullas: 4 activas</Text>
            <Text style={styles.legendText}><Text style={{color: '#D32F2F'}}>●</Text> SAMU: 1 activa</Text>
        </View>

        <View style={styles.bottomList}>
            <Text style={styles.listTitle}>INCIDENTES ACTIVOS</Text>
            {incidents.length === 0 ? (
                <Text style={styles.emptyText}>Despejado.</Text>
            ) : (
                incidents.map(item => (
                    <TouchableOpacity key={item.id} style={styles.coordCard} onPress={() => navigation.navigate("Emergencia", { screen: "IncidentManagement", params: { incidentId: item.id } })}>
                        <View style={styles.dot} />
                        <View style={styles.coordInfo}>
                            <Text style={styles.coordType}>{item.type}</Text>
                            <Text style={styles.coordLoc}>{item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#A0A0A0" />
                    </TouchableOpacity>
                ))
            )}
            <TouchableOpacity style={styles.returnBtn} onPress={() => navigation.goBack()}>
                <Text style={styles.returnBtnText}>Volver al Panel</Text>
            </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#003A20" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  layerBtn: { width: 40, height: 40, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, justifyContent: "center", alignItems: "center" },
  headerTitle: { color: "#D4AF37", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  headerSub: { color: "#A0A0A0", fontSize: 11, marginTop: 2 },
  
  mapArea: { flex: 1, backgroundColor: "#DDE3E9", position: "relative" },
  mapPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  radarTarget: { position: "absolute", width: 20, height: 20, borderRadius: 10, backgroundColor: "#D32F2F", borderWidth: 4, borderColor: "rgba(211,47,47,0.3)" },
  
  legendBox: { position: "absolute", top: 16, left: 16, backgroundColor: "rgba(0,0,0,0.8)", padding: 12, borderRadius: 8 },
  legendTitle: { color: "#A0A0A0", fontSize: 10, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 },
  legendText: { color: "#FFFFFF", fontSize: 11, marginBottom: 4 },

  bottomList: { backgroundColor: "#1A1A1A", padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  listTitle: { color: "#A0A0A0", fontSize: 11, fontWeight: "bold", letterSpacing: 1, marginBottom: 12 },
  emptyText: { color: "#666", fontSize: 13, fontStyle: "italic", marginBottom: 20 },
  coordCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#2A2A2A", padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#333" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D32F2F", marginRight: 12 },
  coordInfo: { flex: 1 },
  coordType: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
  coordLoc: { color: "#A0A0A0", fontSize: 11, marginTop: 2 },
  returnBtn: { backgroundColor: "#004B2B", paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 12 },
  returnBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
});