import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { updateParticipantStatus, CITIZEN_STATUS, updateCommunicationMode, COMM_MODE } from "../../services/incidentService";
export default function DetailPromptScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { incidentId, address, sentViaSMS } = route.params;
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [submitting, setSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState(""); // "loading" or "success"

  useEffect(() => {
    console.log("[DetailPrompt] Mounted, incidentId:", incidentId);
  }, [incidentId]);

  useFocusEffect(
    useCallback(() => {
      if (incidentId) {
        updateParticipantStatus(incidentId, "CITIZEN", CITIZEN_STATUS.ALERT_SENT).catch(() => {});
      }
    }, [incidentId])
  );

  const s = useMemo(() => makeStyles(colors, insets), [colors, insets]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleClassify = () => {
    navigation.navigate("Classification", { incidentId });
  };

  const handleDirectAlert = useCallback(async () => {
    updateCommunicationMode(incidentId, COMM_MODE.ALERT_ONLY).catch(() => {});
    updateParticipantStatus(incidentId, "CITIZEN", CITIZEN_STATUS.IDLE).catch(() => {});

    setSubmitting(true);
    setSubmitPhase("loading");

    await new Promise((r) => setTimeout(r, 1500));

    setSubmitPhase("success");

    await new Promise((r) => setTimeout(r, 2000));

    navigation.getParent()?.navigate("FakeApp", { fromDirectAlert: true });
  }, [navigation]);

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />

      <View style={[s.navbar, { backgroundColor: colors.headerBg, paddingTop: 12 + insets.top }]}>
        <View style={{ width: 44 }} />
        <Text style={[s.navTitle, { color: colors.white }]}>S.O.S. CARABINEROS</Text>
        <View style={{ width: 44 }} />
      </View>

      <Animated.ScrollView
        style={[s.content, { opacity: fadeAnim }]}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.iconContainer}>
          <MaterialCommunityIcons name="alert-rhombus" size={56} color={colors.danger} />
        </View>

        <Text style={[s.title, { color: colors.textPrimary }]}>Alerta Enviada</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          {sentViaSMS
            ? "Tu ubicacion fue enviada por SMS a CENCO. Cuando recuperes conexion podras dar mas detalles."
            : "Tu ubicacion ha sido enviada a la Central de Carabineros (CENCO)."}
        </Text>

        <View style={[s.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="location-outline" size={18} color={colors.primary} />
          <Text style={[s.locationText, { color: colors.textPrimary }]} numberOfLines={2}>
            {address || "Ubicación enviada"}
          </Text>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        </View>

        <View style={s.divider} />

        {sentViaSMS ? (
          <View style={[s.smsBanner, { backgroundColor: colors.warning + "20", borderColor: colors.warning }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={[s.smsBannerText, { color: colors.textPrimary }]}>
              Conectate a internet para clasificar tu emergencia y videollamar con CENCO.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[s.sectionLabel, { color: colors.textPrimary }]}>¿Qué deseas hacer?</Text>

            {/* Classification route */}
            <TouchableOpacity
              style={[s.classifyBtn, { backgroundColor: colors.primary }]}
              onPress={handleClassify}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="gesture-tap" size={22} color={colors.white} />
              <View style={s.btnTextWrap}>
                <Text style={s.classifyBtnText}>Clasificar tipo de emergencia</Text>
                <Text style={s.classifyBtnSub}>Identifica qué tipo de incidente reportas</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>

            <View style={s.dividerLight} />

            {/* Direct alert only */}
            <TouchableOpacity
              style={[s.directAlertBtn, { borderColor: colors.border }]}
              onPress={handleDirectAlert}
              activeOpacity={0.8}
            >
              <Ionicons name="location-sharp" size={20} color={colors.danger} />
              <Text style={[s.directAlertText, { color: colors.danger }]}>
                Enviar alerta de ubicación directa a CENCO
              </Text>
            </TouchableOpacity>
            <Text style={[s.directAlertSub, { color: colors.textSecondary }]}>
              Solo envía tu ubicación, sin seguimiento adicional
            </Text>
          </>
        )}
      </Animated.ScrollView>

      {/* Loading / Success overlay */}
      {submitting && (
        <View style={[s.loadingOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.loadingBox, { backgroundColor: colors.surface }]}>
            {submitPhase === "loading" ? (
              <>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[s.loadingText, { color: colors.textPrimary }]}>
                  Enviando ubicación...
                </Text>
                <Text style={[s.loadingSub, { color: colors.textSecondary }]}>
                  Notificando a la Central de Carabineros
                </Text>
              </>
            ) : (
              <>
                <View style={[s.successIcon, { backgroundColor: colors.success + "20" }]}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.success} />
                </View>
                <Text style={[s.loadingText, { color: colors.textPrimary }]}>
                  Ubicación e Incidente notificado a CENCO
                </Text>
                <Text style={[s.loadingSub, { color: colors.textSecondary }]}>
                  Carabineros en camino
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (colors, insets) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    navbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    content: { flex: 1 },
    scrollContent: { alignItems: "center", paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 40) },
    iconContainer: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.danger + "15", justifyContent: "center", alignItems: "center", marginTop: 16, marginBottom: 20 },
    title: { fontSize: 24, fontWeight: "900", marginBottom: 6, textAlign: "center" },
    subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20, paddingHorizontal: 12 },
    locationCard: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 12, padding: 14, borderWidth: 1,
      gap: 10, width: "100%", marginBottom: 20,
    },
    locationText: { flex: 1, fontSize: 13, fontWeight: "500" },
    divider: { width: 50, height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: 20 },

    smsBanner: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 12, padding: 14, borderWidth: 1,
      gap: 10, width: "100%", marginBottom: 16,
    },
    smsBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },

    sectionLabel: { fontSize: 17, fontWeight: "bold", textAlign: "center", marginBottom: 16 },

    classifyBtn: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 14, paddingVertical: 16, paddingHorizontal: 18, gap: 12,
      width: "100%", marginBottom: 12,
    },
    btnTextWrap: { flex: 1 },
    classifyBtnText: { color: colors.white, fontSize: 15, fontWeight: "bold" },
    classifyBtnSub: { color: colors.whiteTranslucent || "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },

    dividerLight: { width: "100%", height: 1, backgroundColor: colors.border, marginVertical: 16 },

    directAlertBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: 14, height: 48, borderWidth: 1, gap: 8,
      width: "100%",
    },
    directAlertText: { fontSize: 14, fontWeight: "bold" },
    directAlertSub: { fontSize: 11, textAlign: "center", marginTop: 6, color: colors.iconMuted },

    loadingOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", zIndex: 200,
    },
    loadingBox: {
      borderRadius: 20, padding: 36, alignItems: "center",
      width: "85%",
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
    },
    loadingText: { fontSize: 17, fontWeight: "700", marginTop: 20, textAlign: "center" },
    loadingSub: { fontSize: 13, marginTop: 8, textAlign: "center" },
    successIcon: { width: 88, height: 88, borderRadius: 44, justifyContent: "center", alignItems: "center" },
  });
