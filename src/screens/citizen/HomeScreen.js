import { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Vibration,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import * as Location from "expo-location";
import { auth } from "../../firebase/firebaseConfig";
import { triggerSOS } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - SPACING.lg * 2;

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1, duration: 120, useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95, duration: 100, useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1, duration: 100, useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogout = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const getLocationAndNavigate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación.");
      return null;
    }
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude } = location.coords;
    const user = auth.currentUser;
    return await triggerSOS(user.uid, { latitude, longitude });
  };

  const handleSOS = async () => {
    if (loading) return;
    animateButton();
    Vibration.vibrate(200);
    setLoading(true);
    try {
      const incidentId = await getLocationAndNavigate();
      if (incidentId) {
        navigation.navigate("Classification", { incidentId });
      }
    } catch {
      Alert.alert("Error", "No se pudo crear la alerta.");
    } finally {
      setLoading(false);
    }
  };

  const handleDenuncia = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const incidentId = await getLocationAndNavigate();
      if (incidentId) {
        navigation.navigate("Classification", { incidentId });
      }
    } catch {
      Alert.alert("Error", "No se pudo crear la denuncia.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.menuButton} onPress={handleLogout}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>S.O.S. CARABINEROS</Text>
        <TouchableOpacity style={styles.avatarButton} onPress={handleLogout}>
          <Text style={styles.avatarText}>
            {auth.currentUser?.email?.charAt(0).toUpperCase() || "U"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.lenseCard, SHADOWS.lenseCard]}>
          <View style={styles.lenseInner}>
            <TouchableOpacity style={styles.playButton}>
              <Text style={styles.playIcon}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.lenseTag}>
            <Text style={styles.lenseTagText}>Instrucciones LENSE</Text>
          </View>
        </View>

        <View style={styles.sosSection}>
          <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, styles.sosShadow]}>
            <TouchableOpacity
              style={[styles.sosButton, loading && { opacity: 0.7 }]}
              onPress={handleSOS}
              onLongPress={handleSOS}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.sosPinIcon}>📍</Text>
              <Text style={styles.sosWaves}>〰️</Text>
              <Text style={styles.sosText}>S.O.S</Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.sosHint}>
            Toque el botón rojo en caso exclusivo de{" "}
            <Text style={styles.sosHintBold}>EMERGENCIA.</Text>
          </Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.denunciaButton, loading && { opacity: 0.6 }]}
          onPress={handleDenuncia}
          disabled={loading}
        >
          <Text style={styles.denunciaIcon}>📹</Text>
          <Text style={styles.denunciaText}>Botón para denuncias</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  menuButton: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  menuIcon: { fontSize: 22, color: COLORS.textPrimary },
  navTitle: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary, letterSpacing: 0.5 },
  avatarButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: COLORS.surface, fontWeight: FONT_WEIGHT.bold, fontSize: FONT_SIZE.md },
  content: { flex: 1, paddingHorizontal: SPACING.lg },
  lenseCard: {
    width: CARD_WIDTH, height: CARD_WIDTH * 0.5625, borderRadius: RADIUS.md,
    backgroundColor: COLORS.lenseCard, marginTop: SPACING.lg, overflow: "hidden", position: "relative",
  },
  lenseInner: { flex: 1, justifyContent: "center", alignItems: "center" },
  playButton: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.greenTranslucent,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  playIcon: { fontSize: 22, color: COLORS.surface, marginLeft: 3 },
  lenseTag: {
    position: "absolute", bottom: SPACING.sm, left: SPACING.sm,
    backgroundColor: COLORS.blackTranslucent, paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.xs,
  },
  lenseTagText: { color: COLORS.surface, fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.medium, letterSpacing: 0.3 },
  sosSection: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: SPACING.lg },
  sosShadow: SHADOWS.sos,
  sosButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: COLORS.danger,
    justifyContent: "center", alignItems: "center", borderWidth: 4, borderColor: "#B71C1C",
  },
  sosPinIcon: { fontSize: 24, position: "absolute", top: 44 },
  sosWaves: { fontSize: 16, position: "absolute", top: 32, opacity: 0.5 },
  sosText: { fontSize: 48, fontWeight: FONT_WEIGHT.bold, color: COLORS.surface, letterSpacing: 6, marginTop: 8 },
  sosHint: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, textAlign: "center", marginTop: SPACING.xl, lineHeight: 20 },
  sosHintBold: { color: COLORS.danger, fontWeight: FONT_WEIGHT.bold },
  bottomBar: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  denunciaButton: {
    flexDirection: "row", backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    height: 50, justifyContent: "center", alignItems: "center", gap: SPACING.sm,
  },
  denunciaIcon: { fontSize: 20 },
  denunciaText: { color: COLORS.surface, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.medium },
});
