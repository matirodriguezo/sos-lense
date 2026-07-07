import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, Linking, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { auth } from "../../firebase/firebaseConfig";
import { listenAllActiveIncidents } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

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
    const unsub = listenAllActiveIncidents((data) => {
      const withCoords = data.filter((i) => i.latitude && i.longitude);
      setIncidents(withCoords.sort(sortByTimeAsc));
      setLoading(false);
    });
    return unsub;
  }, []);

  const mapHtml = useMemo(() => {
    const markers = incidents.map((i) => ({
      lat: i.latitude,
      lng: i.longitude,
      label: i.citizenAlias || "Usuario",
      type: i.type || "Sin tipo",
      status: i.status || "",
      id: i.id,
      folio: i.id.slice(0, 8).toUpperCase(),
    }));
    const center = markers.length > 0 ? `[${markers[0].lat}, ${markers[0].lng}]` : "[-33.4489, -70.6693]";
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
          body { font-family: system-ui, -apple-system, sans-serif; }
          #map { width: 100vw; height: 100vh; }
          .leaflet-popup-content-wrapper { border-radius: 8px; }
          .leaflet-popup-content { margin: 8px 12px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', { zoomControl: true });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19
          }).addTo(map);
          var markers = ${JSON.stringify(markers)};
          var bounds = [];
          var colors = {
            'NO_CLASIFICADO': '#F57C00',
            'ACTIVO': '#D32F2F',
            'EN_CURSO': '#0B5E2E',
            'CERRADO': '#666666',
            'ANULADO': '#9E9E9E'
          };
          markers.forEach(function(m) {
            if (!m.lat || !m.lng) return;
            var color = colors[m.status] || '#3B82F6';
            var icon = L.divIcon({
              className: '',
              html: '<div style="width:22px;height:22px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">●</div>',
              iconSize: [22, 22],
              iconAnchor: [11, 11],
              popupAnchor: [0, -14]
            });
            var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(map);
            marker.bindPopup(
              '<b>' + m.label + '</b><br/>' +
              m.type + '<br/>' +
              'Folio: ' + m.folio + '<br/>' +
              'Estado: ' + m.status
            );
            bounds.push([m.lat, m.lng]);
          });
          if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [40, 40] });
          } else {
            map.setView(${center}, 12);
          }
        </script>
      </body>
      </html>
    `;
  }, [incidents]);

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
          <Text style={[s.headerSub, { color: colors.whiteTranslucent }]}>
            {incidents.length} incidente{incidents.length !== 1 ? "s" : ""} activo{incidents.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <View style={s.mapArea}>
        <WebView
          source={{ html: mapHtml }}
          style={s.webView}
          scrollEnabled={false}
          bounces={false}
        />
        <View style={[s.legendBox, { backgroundColor: colors.blackTranslucent }]}>
          <Text style={s.legendTitle}>INCIDENTES ACTIVOS</Text>
          <Text style={s.legendText}>
            <Text style={{ color: colors.badgeRed }}>●</Text> Activos: {incidents.length}
          </Text>
        </View>
      </View>

      <View style={[s.bottomList, { backgroundColor: colors.surface }]}>
        <Text style={[s.listTitle, { color: colors.textSecondary }]}>INCIDENTES ACTIVOS</Text>
        {incidents.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color={colors.border} />
            <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>Sin incidentes activos</Text>
            <Text style={[s.emptySub, { color: colors.textSecondary }]}>Los nuevos requerimientos aparecerán aquí.</Text>
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
    webView: { flex: 1, backgroundColor: "#0f1117" },

    legendBox: {
      position: "absolute", top: 16, left: 16,
      padding: 12, borderRadius: 8,
    },
    legendTitle: { color: colors.white, fontSize: 10, fontWeight: "bold", marginBottom: 8, letterSpacing: 1 },
    legendText: { color: colors.white, fontSize: 11, marginBottom: 4 },

    bottomList: {
      padding: 16,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: 300,
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
