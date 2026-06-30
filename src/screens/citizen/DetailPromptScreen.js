import { useState, useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function DetailPromptScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { incidentId, address, sentViaSMS } = route.params;
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log("[DetailPrompt] Mounted, incidentId:", incidentId);
  }, []);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const handleYes = () => {
    navigation.navigate("Classification", { incidentId });
  };

  const handleNo = () => {
    navigation.replace("VideoCall", { incidentId });
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />
      
      <View style={[s.navbar, { backgroundColor: colors.headerBg, paddingTop: 12 + insets.top }]}>
        <View style={{ width: 44 }} />
        <Text style={[s.navTitle, { color: colors.white }]}>S.O.S. CARABINEROS</Text>
        <View style={{ width: 44 }} />
      </View>

      <Animated.View style={[s.content, { opacity: fadeAnim }]}>
        <View style={s.iconContainer}>
          <MaterialCommunityIcons name="alert-rhombus" size={64} color={colors.danger} />
        </View>

        <Text style={[s.title, { color: colors.textPrimary }]}>Alerta Enviada</Text>
        <Text style={[s.subtitle, { color: colors.textSecondary }]}>
          {sentViaSMS
            ? "Tu ubicacion fue enviada por SMS a CENCO. Cuando recuperes conexion podras dar mas detalles."
            : "Tu ubicacion ha sido enviada a la Central de Carabineros (CENCO)."}
        </Text>

        <View style={[s.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <Text style={[s.locationText, { color: colors.textPrimary }]} numberOfLines={2}>
            {address || "Ubicación enviada"}
          </Text>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        </View>

        <View style={s.divider} />

        <Text style={[s.question, { color: colors.textPrimary }]}>
          ¿Deseas dar más detalles sobre la emergencia?
        </Text>

        {sentViaSMS ? (
          <View style={[s.smsBanner, { backgroundColor: colors.warning + "20", borderColor: colors.warning }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
            <Text style={[s.smsBannerText, { color: colors.textPrimary }]}>
              Conectate a internet para clasificar tu emergencia y videollamar con CENCO.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[s.yesBtn, { backgroundColor: colors.primary }]}
              onPress={handleYes}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="gesture-tap" size={22} color={colors.white} />
              <Text style={s.yesBtnText}>Sí, clasificar mi emergencia</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.noBtn, { borderColor: colors.border }]}
              onPress={handleNo}
              activeOpacity={0.8}
            >
              <Text style={[s.noBtnText, { color: colors.textSecondary }]}>
                No, conectar directamente con CENCO
              </Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    navbar: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
    content: { flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" },
    iconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: colors.danger + "15", justifyContent: "center", alignItems: "center", marginBottom: 24 },
    title: { fontSize: 26, fontWeight: "900", marginBottom: 8, textAlign: "center" },
    subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24, paddingHorizontal: 16 },
    locationCard: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 12, padding: 16, borderWidth: 1,
      gap: 12, width: "100%", marginBottom: 32,
    },
    locationText: { flex: 1, fontSize: 14, fontWeight: "500" },
    divider: { width: 60, height: 3, backgroundColor: colors.border, borderRadius: 2, marginBottom: 24 },
    question: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 24 },
    yesBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: 14, height: 56, gap: 10,
      width: "100%", marginBottom: 16,
    },
    yesBtnText: { color: colors.white, fontSize: 16, fontWeight: "bold" },
    noBtn: {
      justifyContent: "center", alignItems: "center",
      borderRadius: 14, height: 50, borderWidth: 1,
      width: "100%",
    },
    noBtnText: { fontSize: 14, fontWeight: "600" },
    smsBanner: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 12, padding: 16, borderWidth: 1,
      gap: 12, width: "100%", marginBottom: 16,
    },
    smsBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  });
