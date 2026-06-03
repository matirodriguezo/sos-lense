import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Easing,
  Vibration,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import * as Location from "expo-location";
import { auth } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { triggerSOS, listenCitizenHistory } from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import { INCIDENT_STATUS } from "../../constants/roles";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SOS_SIZE = Math.min(SCREEN_WIDTH * 0.45, 210);
const HISTORY_PREVIEW_COUNT = 3;
const SOS_HOLD_DURATION = 1500;

const TYPE_ICONS = {
  ACCIDENTE: "car-outline",
  ROBO: "shield-half-outline",
  VIOLENCIA: "home-outline",
  OTRO: "alert-circle-outline",
};

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [lastIncidents, setLastIncidents] = useState([]);
  const [userData, setUserData] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const { unreadCount } = useNotifications();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef(null);
  const insets = useSafeAreaInsets();

  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) setUserData(snap.data());
      });
      const unsub = listenCitizenHistory(user.uid, (data) => {
        setLastIncidents(data.slice(0, HISTORY_PREVIEW_COUNT));
        const active = data.find(
          (inc) =>
            inc.status === INCIDENT_STATUS.NO_CLASIFICADO ||
            inc.status === INCIDENT_STATUS.ACTIVO ||
            inc.status === INCIDENT_STATUS.EN_CURSO
        );
        setActiveIncident(active || null);
      });
      return unsub;
    }
  }, []);

  useEffect(() => {
    const createPulse = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1800,
            delay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );

    const p1 = createPulse(pulseAnim, 0);
    const p2 = createPulse(pulseAnim2, 600);
    const p3 = createPulse(pulseAnim3, 1200);
    p1.start();
    p2.start();
    p3.start();
    return () => { p1.stop(); p2.stop(); p3.stop(); };
  }, []);

  const animateButton = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim]);

  const startSOSPress = () => {
    setIsPressing(true);
    progressAnim.setValue(0);
    Vibration.vibrate(50);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: SOS_HOLD_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setIsPressing(false);
        executeSOS();
      }
    });
  };

  const cancelSOSPress = () => {
    progressAnim.stopAnimation((value) => {
      if (value > 0.3) Vibration.vibrate(50);
    });
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 150,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
    setIsPressing(false);
  };

  const getAddress = async (latitude, longitude) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const r = results[0];
        return [r.street, r.name, r.city, r.region].filter(Boolean).join(", ");
      }
    } catch {}
    return "";
  };

  const executeSOS = async () => {
    if (loading) return;
    animateButton();
    Vibration.vibrate([0, 200, 100, 200]);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación para enviar la alerta.");
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      const user = auth.currentUser;
      const citizenAlias = getCurrentAlias();
      const address = await getAddress(latitude, longitude);
      const incidentId = await triggerSOS(user.uid, { latitude, longitude, address, citizenAlias });

      navigation.navigate("Classification", { incidentId });
    } catch (e) {
      Alert.alert("Error", "No se pudo crear la alerta. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setMenuVisible(false);
    Alert.alert("Cerrar sesión", "¿Estás seguro de que deseas salir?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  const ringInterpolate = (anim) => ({
    scale: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.35],
    }),
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.25, 0],
    }),
  });

  const ring1 = ringInterpolate(pulseAnim);
  const ring2 = ringInterpolate(pulseAnim2);
  const ring3 = ringInterpolate(pulseAnim3);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [colors.success, colors.warning, colors.danger],
  });

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />

      {menuVisible && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[s.drawerContainer, { backgroundColor: colors.surface }]}>
            <View style={[s.drawerHeader, { backgroundColor: colors.drawerHeaderBg, paddingTop: 24 + insets.top }]}>
              <View style={[s.drawerAvatar, { backgroundColor: colors.greenTranslucent }]}>
                <Ionicons name="person-outline" size={32} color={colors.primary} />
              </View>
              <Text style={s.drawerName}>{userData?.alias || "Ciudadano"}</Text>
              {userData?.rut && <Text style={s.drawerRut}>RUT: {userData.rut}</Text>}
              <Text style={[s.drawerEmail, { color: colors.textSecondary }]}>{auth.currentUser?.email}</Text>
            </View>

            <View style={s.drawerBody}>
              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate("Perfil"); }}>
                <Ionicons name="person-outline" size={22} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Mi Perfil</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate("Historial"); }}>
                <MaterialCommunityIcons name="history" size={24} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Historial</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); Alert.alert("Ajustes", "Próximamente"); }}>
                <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Ajustes LENSE</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.logoutBtn, { borderTopColor: colors.border }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
              <Text style={[s.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      <View style={[s.navbar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, paddingTop: 12 + insets.top }]}>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.menuBtn}>
          <Ionicons name="menu" size={28} color={colors.white} />
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: colors.white }]}>S.O.S. CARABINEROS</Text>
        <TouchableOpacity style={[s.avatarButton, { backgroundColor: colors.greenTranslucent }]} onPress={() => navigation.navigate("Perfil")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="person-outline" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        {activeIncident && (
          <TouchableOpacity
            style={[s.activeCallBanner, { backgroundColor: colors.primary }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("VideoCall", { incidentId: activeIncident.id })}
          >
            <View style={s.activeCallDot} />
            <View style={s.activeCallInfo}>
              <Text style={s.activeCallTitle}>Llamada activa</Text>
              <Text style={s.activeCallSub}>Presiona para reingresar</Text>
            </View>
            {unreadCount > 0 && (
              <View style={[s.activeCallBadge, { backgroundColor: colors.badgeRed }]}>
                <Text style={s.activeCallBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.lenseCard, { backgroundColor: colors.lenseCard }]} activeOpacity={0.9} onPress={() => Alert.alert("Guía", "Instrucciones de señas.")}>
          <View style={s.playButton}>
            <Ionicons name="play" size={24} color={colors.white} style={{ marginLeft: 4 }} />
          </View>
          <View style={s.lenseTag}>
            <Text style={s.lenseTagText}>Guía LENSE</Text>
          </View>
        </TouchableOpacity>

        <View style={s.sosSection}>
          <View style={{ width: SOS_SIZE, height: SOS_SIZE, alignItems: "center", justifyContent: "center" }}>
            {[ring1, ring2, ring3].map((ring, i) => (
              <Animated.View
                key={i}
                style={[s.pulseRing, {
                  width: SOS_SIZE * 1.3,
                  height: SOS_SIZE * 1.3,
                  borderRadius: (SOS_SIZE * 1.3) / 2,
                  borderColor: colors.danger,
                  opacity: ring.opacity,
                  transform: [{ scale: ring.scale }],
                }]}
              />
            ))}
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                style={[s.sosButton, { backgroundColor: colors.danger, width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2 }, loading && { opacity: 0.7 }]}
                onPressIn={startSOSPress}
                onPressOut={cancelSOSPress}
                disabled={loading}
                activeOpacity={0.9}
              >
                <MaterialCommunityIcons name="broadcast" size={44} color={colors.white} style={{ marginBottom: -5 }} />
                <Text style={s.sosText}>S.O.S</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {isPressing && (
            <View style={[s.progressContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.1)" }]}>
              <Animated.View style={[s.progressBar, { width: progressWidth, backgroundColor: progressColor }]} />
            </View>
          )}

          <Text style={[s.sosHint, { color: colors.textSecondary }]}>
            Mantenga presionado en caso de{"\n"}
            <Text style={[s.sosHintBold, { color: colors.textPrimary }]}>EMERGENCIA</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.blackTranslucent, zIndex: 100 },
    drawerContainer: { width: SCREEN_WIDTH * 0.75, height: "100%" },
    drawerHeader: { paddingVertical: 24, paddingHorizontal: 24 },
    drawerAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 12 },
    drawerName: { color: colors.white, fontSize: 20, fontWeight: "bold" },
    drawerRut: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
    drawerEmail: { color: colors.iconMuted, fontSize: 11, marginTop: 2 },
    drawerBody: { flex: 1, paddingTop: 20 },
    drawerItem: { flexDirection: "row", alignItems: "center", paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1 },
    drawerItemText: { fontSize: 16, marginLeft: 16, fontWeight: "500" },
    logoutBtn: { flexDirection: "row", alignItems: "center", padding: 24, borderTopWidth: 1 },
    logoutText: { fontSize: 16, marginLeft: 16, fontWeight: "600" },

    navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1 },
    navTitle: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1 },
    menuBtn: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
    avatarButton: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },

    content: { flex: 1, paddingHorizontal: 24, alignItems: "center" },

    activeCallBanner: {
      flexDirection: "row", alignItems: "center",
      borderRadius: RADIUS.md, padding: 16, marginTop: 24, gap: 12, width: "100%",
    },
    activeCallDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success },
    activeCallInfo: { flex: 1 },
    activeCallTitle: { color: colors.white, fontSize: 16, fontWeight: "bold" },
    activeCallSub: { color: colors.whiteTranslucent, fontSize: 13, marginTop: 2 },
    activeCallBadge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
    activeCallBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
    lenseCard: { width: "100%", height: 160, borderRadius: RADIUS.md, marginTop: 24, justifyContent: "center", alignItems: "center", position: "relative", overflow: "hidden" },
    playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.whiteTranslucent, justifyContent: "center", alignItems: "center" },
    lenseTag: { position: "absolute", bottom: 12, left: 12, backgroundColor: colors.blackTranslucent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    lenseTagText: { color: colors.white, fontSize: 12, fontWeight: "bold" },
    sosSection: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
    sosButton: { justifyContent: "center", alignItems: "center" },
    pulseRing: { position: "absolute", borderWidth: 2 },
    sosText: { fontSize: 38, fontWeight: FONT_WEIGHT.bold, color: colors.white, letterSpacing: 2, marginTop: SPACING.xs },
    progressContainer: { width: Math.min(SCREEN_WIDTH * 0.55, 220), height: 5, borderRadius: 3, marginTop: 20, overflow: "hidden" },
    progressBar: { height: "100%", borderRadius: 3 },
    sosHint: { fontSize: FONT_SIZE.base, textAlign: "center", marginTop: SPACING.xl, lineHeight: 22 },
    sosHintBold: { fontWeight: "900", letterSpacing: 1 },
  });