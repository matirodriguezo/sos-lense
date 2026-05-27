import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listenAllActiveIncidents } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const unsub = listenAllActiveIncidents((data) => { setIncidents(data); setLoading(false); });
    return unsub;
  }, []);

  if (loading) return ( <View style={[s.loadingContainer, { backgroundColor: colors.drawerHeaderBg }]}><ActivityIndicator size="large" color={colors.primary} /></View> );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.drawerHeaderBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.drawerHeaderBg} />
      
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color={colors.white} /></TouchableOpacity>
        <View style={{alignItems: 'center'}}>
            <Text style={[s.headerTitle, { color: colors.gold }]}>Mapa Global</Text>
            <Text style={[s.headerSub, { color: colors.emptyText }]}>Sector Sur · {incidents.length} unidades activas</Text>
        </View>
        <TouchableOpacity style={[s.layerBtn, { backgroundColor: colors.whiteTranslucent }]}><Ionicons name="layers-outline" size={20} color={colors.white} /></TouchableOpacity>
      </View>

      <View style={[s.mapArea, { backgroundColor: colors.mapPlaceholderBg }]}>
        <View style={s.mapPlaceholder}>
          <MaterialCommunityIcons name="radar" size={80} color={colors.primary + "20"} />
          <View style={[s.radarTarget, { backgroundColor: colors.badgeRed, borderColor: colors.badgeRed + "50" }]} />
        </View>
        
        <View style={[s.legendBox, { backgroundColor: colors.blackTranslucent }]}>
            <Text style={s.legendTitle}>UNIDADES EN TERRENO</Text>
            <Text style={s.legendText}><Text style={{color: colors.blueDispatch}}>●</Text> Patrullas: 4 activas</Text>
            <Text style={s.legendText}><Text style={{color: colors.badgeRed}}>●</Text> SAMU: 1 activa</Text>
        </View>

        <View style={[s.bottomList, { backgroundColor: colors.surface }]}>
            <Text style={[s.listTitle, { color: colors.emptyText }]}>INCIDENTES ACTIVOS</Text>
            {incidents.length === 0 ? (
                <Text style={[s.emptyText, { color: colors.textSecondary }]}>Despejado.</Text>
            ) : (
                incidents.map(item => (
                    <TouchableOpacity key={item.id} style={[s.coordCard, { backgroundColor: colors.officerBg, borderColor: colors.border }]} onPress={() => navigation.navigate("Emergencia", { screen: "IncidentManagement", params: { incidentId: item.id } })}>
                        <View style={[s.dot, { backgroundColor: colors.badgeRed }]} />
                        <View style={s.coordInfo}>
                            <Text style={[s.coordType, { color: colors.textPrimary }]}>{item.type}</Text>
                            <Text style={[s.coordLoc, { color: colors.emptyText }]}>{item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.emptyText} />
                    </TouchableOpacity>
                ))
            )}
            <TouchableOpacity style={[s.returnBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
                <Text style={[s.returnBtnText, { color: colors.white }]}>Volver al Panel</Text>
            </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
    backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    layerBtn: { width: 44, height: 44, borderRadius: 8, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    headerSub: { fontSize: 11, marginTop: 2 },
    
    mapArea: { flex: 1, position: "relative" },
    mapPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
    radarTarget: { position: "absolute", width: 20, height: 20, borderRadius: 10, borderWidth: 4 },
    
    legendBox: { position: "absolute", top: 16, left: 16, padding: 12, borderRadius: 8 },
    legendTitle: { color: colors.emptyText, fontSize: 10, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 },
    legendText: { color: colors.white, fontSize: 11, marginBottom: 4 },

    bottomList: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    listTitle: { fontSize: 11, fontWeight: "bold", letterSpacing: 1, marginBottom: 12 },
    emptyText: { fontSize: 13, fontStyle: "italic", marginBottom: 20 },
    coordCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    coordInfo: { flex: 1 },
    coordType: { fontSize: 13, fontWeight: "bold" },
    coordLoc: { fontSize: 11, marginTop: 2 },
    returnBtn: { paddingVertical: 14, borderRadius: 8, alignItems: "center", marginTop: 12 },
    returnBtnText: { fontSize: 14, fontWeight: "bold" },
  });
