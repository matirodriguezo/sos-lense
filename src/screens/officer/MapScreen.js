import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Linking, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebaseConfig";
import { listenMyCases } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const ACTIVE_STATUSES = ["ACTIVO", "EN_CURSO", "NO_CLASIFICADO"];

const sortByTimeAsc = (a, b) => {
  const tA = a.createdAt?.toMillis?.() || 0;
  const tB = b.createdAt?.toMillis?.() || 0;
  return tA - tB;
};

const getElapsed = (createdAt) => {
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

const TYPE_LABELS = {
  ACCIDENTE: "Accidente Tránsito",
  ROBO: "Robo / Asalto",
  VIOLENCIA: "Violencia Intrafamiliar",
  MEDICA: "Emergencia Médica",
  OTRO: "Otro",
};

export default function MapScreen({ navigation }) {
  const { colors } = useTheme();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const unsub = listenMyCases(uid, (data) => {
      const active = data
        .filter((i) => ACTIVE_STATUSES.includes(i.status))
        .sort(sortByTimeAsc);
      setIncidents(active);
      setLoading(false);
    });
    return unsub;
  }, []);

  const openMaps = (lat, lng) => {
    if (!lat || !lng) {
      Alert.alert("Ubicación no disponible", "No hay coordenadas registradas.");
      return;
    }
    const url = Platform.OS === "ios"
      ? `maps://app?daddr=${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/maps?daddr=${lat},${lng}`)
    );
  };

  if (loading) {
    return (
      <View style={[s.loadingContainer, { backgroundColor: colors.drawerHeaderBg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.drawerHeaderBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.drawerHeaderBg} />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => Alert.alert("Volver", "¿Deseas regresar al panel?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Volver", onPress: () => navigation.goBack() },
        ])}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[s.headerTitle, { color: colors.gold }]}>Mapa Global</Text>
          <Text style={[s.headerSub, { color: colors.emptyText }]}>
            {incidents.length} caso{incidents.length !== 1 ? "s" : ""} activo{incidents.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={[s.mapArea, { backgroundColor: colors.mapPlaceholderBg }]}>
        <View style={s.mapPlaceholder}>
          <MaterialCommunityIcons name="radar" size={80} color={colors.primary + "20"} />
          <View style={[s.radarTarget, { backgroundColor: colors.badgeRed, borderColor: colors.badgeRed + "50" }]} />
          <Text style={[s.mapHint, { color: colors.textSecondary }]}>Vista satelital simulada</Text>
        </View>

        <View style={[s.legendBox, { backgroundColor: colors.blackTranslucent }]}>
          <Text style={s.legendTitle}>MIS INCIDENTES</Text>
          <Text style={s.legendText}>
            <Text style={{ color: colors.badgeRed }}>●</Text> Activos: {incidents.length}
          </Text>
        </View>

        <View style={[s.bottomList, { backgroundColor: colors.surface }]}>
          <Text style={[s.listTitle, { color: colors.emptyText }]}>MIS INCIDENTES ACTIVOS</Text>
          {incidents.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color={colors.border} />
              <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>Sin incidentes activos</Text>
              <Text style={[s.emptySub, { color: colors.emptyText }]}>Los casos que tomes aparecerán aquí.</Text>
            </View>
          ) : (
            incidents.map((item) => (
              <View
                key={item.id}
                style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={s.cardHeader}>
                  <View style={[s.dot, { backgroundColor: colors.badgeRed }]} />
                  <Text style={[s.cardType, { color: colors.textPrimary }]}>
                    {TYPE_LABELS[item.type] || item.type || "Sin clasificar"}
                  </Text>
                  <View style={[s.elapsedBadge, { backgroundColor: colors.badgeRed + "15" }]}>
                    <Text style={[s.elapsedText, { color: colors.badgeRed }]}>
                      {getElapsed(item.createdAt)}
                    </Text>
                  </View>
                </View>

                <Text style={[s.cardFolio, { color: colors.textSecondary }]}>
                  Folio #{item.id.slice(0, 8).toUpperCase()}
                </Text>

                {item.address && (
                  <Text style={[s.cardAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.address}
                  </Text>
                )}

                <View style={s.cardCoords}>
                  <MaterialCommunityIcons name="crosshairs-gps" size={14} color={colors.primary} />
                  <Text style={[s.coordText, { color: colors.textSecondary }]}>
                    {item.latitude?.toFixed(6)}, {item.longitude?.toFixed(6)}
                  </Text>
                </View>

                <View style={s.cardActions}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={() => openMaps(item.latitude, item.longitude)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="location-outline" size={16} color={colors.white} />
                    <Text style={s.actionBtnText}>Ver en Mapas</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: colors.blueDispatch }]}
                    onPress={() => {
                      Alert.alert("Acceder", "¿Deseas acceder a este incidente?", [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Acceder",
                          onPress: () =>
                            navigation.navigate("Emergencia", {
                              screen: "IncidentManagement",
                              params: { incidentId: item.id },
                            }),
                        },
                      ]);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="video" size={16} color={colors.white} />
                    <Text style={s.actionBtnText}>Acceder al Incidente</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}


        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 16,
    },
    backBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    headerSub: { fontSize: 11, marginTop: 2 },

    mapArea: { flex: 1, position: "relative" },
    mapPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center" },
    radarTarget: { position: "absolute", width: 20, height: 20, borderRadius: 10, borderWidth: 4 },
    mapHint: { position: "absolute", bottom: 20, fontSize: 11, fontStyle: "italic" },

    legendBox: {
      position: "absolute", top: 16, left: 16,
      padding: 12, borderRadius: 8,
    },
    legendTitle: { color: colors.emptyText, fontSize: 10, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 },
    legendText: { color: colors.white, fontSize: 11, marginBottom: 4 },

    bottomList: {
      padding: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: 320,
    },
    listTitle: { fontSize: 11, fontWeight: "bold", letterSpacing: 1, marginBottom: 12 },
    emptyState: { alignItems: "center", paddingVertical: 24 },
    emptyTitle: { fontSize: 16, fontWeight: "bold", marginTop: 12 },
    emptySub: { fontSize: 13, marginTop: 4, textAlign: "center" },
    card: {
      borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1,
      shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cardType: { fontSize: 14, fontWeight: "bold", flex: 1 },
    elapsedBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    elapsedText: { fontSize: 10, fontWeight: "bold" },
    cardFolio: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
    cardAddress: { fontSize: 12, marginBottom: 4, lineHeight: 16 },
    cardCoords: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
    coordText: { fontSize: 11 },

    cardActions: { flexDirection: "row", gap: 8 },
    actionBtn: {
      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 10, borderRadius: 8,
    },
    actionBtnText: { color: colors.white, fontSize: 12, fontWeight: "bold" },
  });
