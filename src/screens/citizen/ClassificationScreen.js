import { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { cancelIncident } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

const INCIDENT_OPTIONS = [
  { id: "ACCIDENTE", icon: "car-outline", label: "Accidente de Tránsito", gifPath: require("../../../assets/gifs/Accidente de transito.gif") },
  { id: "ROBO", icon: "shield-half-outline", label: "Robo o Asalto", gifPath: require("../../../assets/gifs/Robo o Asalto.gif") },
  { id: "VIOLENCIA", icon: "home-outline", label: "Violencia Intrafamiliar", gifPath: require("../../../assets/gifs/Violencia.gif") },
  { id: "MEDICA", icon: "pulse-outline", label: "Emergencia Médica", gifPath: require("../../../assets/gifs/Emergencia Medica.gif") },
];

export default function ClassificationScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { incidentId } = route.params;
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const insets = useSafeAreaInsets();

  const [loadedCount, setLoadedCount] = useState(0);
  const numGifs = INCIDENT_OPTIONS.filter((opt) => opt.gifPath).length;
  const allGifsReady = loadedCount >= numGifs;

  const s = useMemo(() => makeStyles(colors), [colors]);

  const classifyAndNavigate = async (id) => {
    setSelected(id);
    setSubmitting(true);

    try {
      await updateDoc(doc(db, "incidents", incidentId), {
        type: id,
        status: "ACTIVO",
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        navigation.replace("VideoCall", { incidentId });
      }, 1000);
    } catch {
      setSubmitting(false);
      Alert.alert("Error", "No se pudo actualizar el tipo de emergencia.");
    }
  };

  const confirmCancel = () => {
    Alert.alert(
      "Cancelar alerta",
      "¿Estás seguro de que deseas cancelar esta alerta?",
      [
        { text: "Seguir reportando", style: "cancel" },
        {
          text: "Cancelar alerta",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelIncident(incidentId, "Cancelado por el usuario");
            } catch {}
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />

      {!allGifsReady && (
        <View style={{ position: "absolute", opacity: 0 }}>
          {INCIDENT_OPTIONS.map((item) =>
            item.gifPath ? (
              <Image
                key={`preload-${item.id}`}
                source={item.gifPath}
                onLoad={() => setLoadedCount((c) => c + 1)}
              />
            ) : null
          )}
        </View>
      )}

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, paddingTop: 12 + insets.top }]}>
        <TouchableOpacity style={s.closeButton} onPress={confirmCancel}>
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.stepText, { color: colors.textPrimary }]}>Paso 1 de 2</Text>
        <Text style={[s.sosLabel, { color: colors.primary }]}>S.O.S.</Text>
      </View>

      <View style={s.content}>
        {/* LENSE Video Mini */}
        <TouchableOpacity style={[s.lenseMini, { backgroundColor: colors.lenseCard }]} activeOpacity={0.9}>
          <View style={[s.playMini, { backgroundColor: colors.whiteTranslucent, borderColor: colors.whiteTranslucent }]}>
            <Ionicons name="play" size={20} color={colors.white} style={{ marginLeft: 3 }} />
          </View>
        </TouchableOpacity>

        <Text style={[s.questionTitle, { color: colors.textPrimary }]}>¿Qué pasó?</Text>
        <Text style={[s.questionSub, { color: colors.textSecondary }]}>
          Seleccione la categoría de su emergencia
        </Text>

        {/* 2x2 Grid */}
        <View style={s.grid}>
          {INCIDENT_OPTIONS.map((item) => {
            const isSelected = selected === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isSelected && { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.greenTranslucent },
                ]}
                onPress={() => classifyAndNavigate(item.id)}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={[s.checkBadge, { backgroundColor: colors.primary }]}>
                    <Ionicons name="checkmark" size={14} color={colors.white} />
                  </View>
                )}
                {item.gifPath ? (
                  allGifsReady ? (
                    <Image 
                      source={item.gifPath}
                      style={s.gifIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={s.gifIconLoader}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  )
                ) : (
                  <Ionicons 
                    name={item.icon} 
                    size={42} 
                    color={isSelected ? colors.primary : colors.iconMuted}
                    style={{ marginBottom: 12 }} 
                  />
                )}
                <Text style={[s.cardLabel, { color: colors.textPrimary }, isSelected && { color: colors.primary }]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={s.otherLink} onPress={() => classifyAndNavigate("OTRO")} disabled={submitting}>
          <Text style={[s.otherLinkText, { color: colors.primary }]}>No sé / Otro tipo de emergencia</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Fixed Area */}
      <View style={[s.bottomArea, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 20 + insets.bottom }]}>
        {submitting && (
          <View style={[s.confirmButton, { backgroundColor: colors.primary }]}>
            <Text style={s.confirmButtonText}>Actualizando...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    navbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1,
    },
    closeButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    stepText: { fontSize: 16, fontWeight: "bold" },
    sosLabel: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    lenseMini: {
      width: "100%", height: 120, borderRadius: 12,
      justifyContent: "center", alignItems: "center", marginBottom: 24,
    },
    playMini: {
      width: 48, height: 48, borderRadius: 24,
      justifyContent: "center", alignItems: "center", borderWidth: 1,
    },
    
    questionTitle: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
    questionSub: { fontSize: 14, marginBottom: 24 },
    
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
    card: {
      width: "47%", aspectRatio: 1.05,
      borderRadius: 12, justifyContent: "center", alignItems: "center",
      borderWidth: 1, position: "relative", padding: 10,
      shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    checkBadge: {
      position: "absolute", top: 10, right: 10, width: 20, height: 20,
      borderRadius: 10, justifyContent: "center", alignItems: "center",
      zIndex: 2,
    },
    gifIcon: {
      flex: 1, width: "100%", marginBottom: 8,
    },
    gifIconLoader: {
      flex: 1, width: "100%", marginBottom: 8, justifyContent: "center", alignItems: "center",
    },
    cardLabel: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 4 },
    
    otherLink: { alignItems: "center", marginTop: 32 },
    otherLinkText: { fontSize: 14, fontWeight: "bold", textDecorationLine: "underline" },
    
    bottomArea: { paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1 },
    confirmButton: { borderRadius: 12, height: 54, justifyContent: "center", alignItems: "center" },
    confirmButtonText: { color: colors.white, fontSize: 16, fontWeight: "bold" },
  });
