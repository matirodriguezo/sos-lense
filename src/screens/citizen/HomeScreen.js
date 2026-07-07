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
  Image,
  ActivityIndicator,
  InteractionManager,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { signOut } from "firebase/auth";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import { auth } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { triggerSOS, listenCitizenHistory } from "../../services/incidentService";
import { getCurrentAlias } from "../../services/userStore";
import { INCIDENT_STATUS, CENCO_PHONE } from "../../constants/roles";
import { sendSOSBySMS } from "../../services/smsFallback";
import { useTheme } from "../../context/ThemeContext";
import { useNotifications } from "../../context/NotificationContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
const LOG = "[HomeScreen]";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BTN_SIZE = Math.min(SCREEN_WIDTH * 0.5, 220);
const HISTORY_PREVIEW_COUNT = 3;
const SOS_HOLD_DURATION = 1500;

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
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
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef(null);
  const insets = useSafeAreaInsets();

  const s = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  useEffect(() => {
    console.log(`${LOG} Mounted`);
    const user = auth.currentUser;
    if (user) {
      InteractionManager.runAfterInteractions(() => {
        getDoc(doc(db, "users", user.uid)).then((snap) => {
          if (snap.exists()) { setUserData(snap.data()); console.log(`${LOG} User data loaded`); }
        });
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
      return () => { console.log(`${LOG} Unmounted`); unsub(); };
    }
  }, []);

  const animRefs = useRef([]);

  const startAnimations = useCallback(() => {
    animRefs.current.forEach((a) => a?.stop?.());
    animRefs.current = [];

    const createPulse = (anim, delay) => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1, duration: 2000, delay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0, duration: 2000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return loop;
    };

    animRefs.current.push(createPulse(pulseAnim, 0));
    animRefs.current.push(createPulse(pulseAnim2, 660));
    animRefs.current.push(createPulse(pulseAnim3, 1320));

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    glow.start();
    animRefs.current.push(glow);

    const rot = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 4000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    rot.start();
    animRefs.current.push(rot);
  }, []);

  const stopAnimations = useCallback(() => {
    animRefs.current.forEach((a) => a?.stop?.());
    animRefs.current = [];
  }, []);

  // Only run animations when screen is focused
  useFocusEffect(
    useCallback(() => {
      startAnimations();
      console.log(`${LOG} Animations started (focused)`);
      return () => {
        stopAnimations();
        console.log(`${LOG} Animations stopped (blurred)`);
      };
    }, [startAnimations, stopAnimations])
  );

  const animateButton = useCallback(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.08, friction: 3, tension: 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 0.96, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, tension: 80, useNativeDriver: true }),
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
    if (activeIncident) {
      Alert.alert(
        "Ya tienes una emergencia activa",
        "Finaliza el procedimiento actual antes de crear uno nuevo.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Reingresar", onPress: () => navigation.navigate("Classification", { incidentId: activeIncident.id }) },
        ]
      );
      return;
    }
    console.log(`${LOG} SOS triggered`);
    animateButton();
    Vibration.vibrate([0, 200, 100, 200]);
    setLoading(true);
    setLoadingMessage("Obteniendo ubicación...");
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.warn(`${LOG} Location permission denied`);
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación para enviar la alerta.");
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      const user = auth.currentUser;
      const citizenAlias = getCurrentAlias();

      setLoadingMessage("Enviando ubicación a CENCO...");
      const address = await getAddress(latitude, longitude);

      const netState = await NetInfo.fetch();
      const isOnline = netState.isConnected && netState.isInternetReachable !== false;

      let incidentId = null;
      if (isOnline) {
        incidentId = await triggerSOS(user.uid, { latitude, longitude, address, citizenAlias });
        console.log(`${LOG} Incident created: ${incidentId}`);
      } else {
        console.log(`${LOG} Offline — falling back to SMS`);
        await sendSOSBySMS([CENCO_PHONE], { latitude, longitude, address, alias: citizenAlias });
      }

      setLoadingMessage("Ubicación enviada ✓");

      setTimeout(() => {
        setLoading(false);
        navigation.navigate("DetailPrompt", { incidentId, address, sentViaSMS: !isOnline });
      }, 1200);
    } catch (e) {
      console.error(`${LOG} SOS error:`, e);
      setLoading(false);
      Alert.alert("Error", "No se pudo crear la alerta. Verifica tu conexión.");
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
      outputRange: [1, 1.4],
    }),
    opacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0],
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

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const rotateInterp = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-8deg", "8deg"],
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
               <Text style={[s.drawerEmail, { color: colors.whiteTranslucent }]}>{auth.currentUser?.email}</Text>
            </View>

            <View style={s.drawerBody}>
              <View style={[s.lenseDrawerSection, { borderBottomColor: colors.border }]}>
                <Text style={[s.lenseDrawerTitle, { color: colors.primary }]}>
                  <Ionicons name="hand-left-outline" size={16} color={colors.primary} /> Guía LENSE
                </Text>
                <Text style={[s.lenseDrawerSub, { color: colors.textSecondary }]}>
                  Aprende señas básicas para tu emergencia
                </Text>
              </View>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate("CitizenProfile"); }}>
                <Ionicons name="person-outline" size={24} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Mi Perfil</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate("Historial"); }}>
                <MaterialCommunityIcons name="history" size={24} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Historial</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.iconMuted} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); Alert.alert("Guía LENSE", "Aquí encontrarás videos educativos en lengua de señas para aprender a comunicarte en situaciones de emergencia.\n\nPróximamente más contenido."); }}>
                <Ionicons name="book-outline" size={22} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Aprender LENSE</Text>
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
        <TouchableOpacity style={[s.avatarButton, { backgroundColor: colors.greenTranslucent }]} onPress={() => navigation.navigate("CitizenProfile")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="person-outline" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        {activeIncident && (
          <TouchableOpacity
            style={[s.activeCallBanner, { backgroundColor: colors.primary }]}
            activeOpacity={0.9}
            onPress={() => navigation.navigate("Classification", { incidentId: activeIncident.id })}
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

        <View style={s.emergencySection}>
          <View style={{ width: BTN_SIZE * 1.4, height: BTN_SIZE * 1.4, alignItems: "center", justifyContent: "center" }}>
            {[ring1, ring2, ring3].map((ring, i) => (
              <Animated.View
                key={i}
                style={[s.pulseRing, {
                  width: BTN_SIZE * 1.3,
                  height: BTN_SIZE * 1.3,
                  borderRadius: (BTN_SIZE * 1.3) / 2,
                  borderColor: colors.danger,
                  opacity: ring.opacity,
                  transform: [{ scale: ring.scale }],
                }]}
              />
            ))}
            <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: rotateInterp }] }}>
              <Animated.View style={[s.glowRing, { opacity: glowOpacity }]} />
              <TouchableOpacity
                style={[s.emergencyButton, { backgroundColor: colors.danger, width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2 }, loading && { opacity: 0.7 }]}
                onPressIn={startSOSPress}
                onPressOut={cancelSOSPress}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Image
                  source={require("../../../assets/gifs/EMERGENCIA.webp")}
                  style={s.btnGif}
                  resizeMode="contain"
                />
                <Text style={s.emergencyText}>EMERGENCIA</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {isPressing && (
            <View style={[s.progressContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(15,23,42,0.1)" }]}>
              <Animated.View style={[s.progressBar, { width: progressWidth, backgroundColor: progressColor }]} />
            </View>
          )}

          <View style={s.descContainer}>
            <Text style={[s.descText, { color: colors.textSecondary }]}>
              Presiona y mantén presionado el botón para{" "}
              <Text style={[s.descBold, { color: colors.danger }]}>activar una alerta de emergencia</Text>{" "}
              y ser conectado al Centro de Carabineros (CENCO) mediante videollamada.
            </Text>
          </View>
        </View>
      </View>

      {/* Loading Overlay */}
      {loading && (
        <View style={[s.loadingOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[s.loadingBox, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[s.loadingText, { color: colors.textPrimary }]}>{loadingMessage}</Text>
            <View style={[s.loadingProgressBg, { backgroundColor: colors.border }]}>
              <Animated.View style={[s.loadingProgressFill, { backgroundColor: colors.primary }]} />
            </View>
          </View>
        </View>
      )}
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
    drawerRut: { color: colors.gold, fontSize: 13, marginTop: 4 },
    drawerEmail: { color: colors.whiteTranslucent, fontSize: 11, marginTop: 2 },
    drawerBody: { flex: 1, paddingTop: 20 },
    lenseDrawerSection: { paddingHorizontal: 24, paddingBottom: 16, marginBottom: 8, borderBottomWidth: 1 },
    lenseDrawerTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
    lenseDrawerSub: { fontSize: 12, lineHeight: 18 },
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
    emergencySection: { flex: 1, justifyContent: "center", alignItems: "center", width: "100%" },
    emergencyButton: { justifyContent: "center", alignItems: "center", overflow: "hidden" },
    pulseRing: { position: "absolute", borderWidth: 2.5 },
    glowRing: {
      position: "absolute", top: -8, left: -8, right: -8, bottom: -8,
      borderRadius: (BTN_SIZE + 16) / 2,
      backgroundColor: colors.danger,
    },
    btnGif: { width: 120, height: 120, marginBottom: 6 },
    emergencyText: { fontSize: 18, fontWeight: FONT_WEIGHT.bold, color: colors.white, letterSpacing: 1.5 },
    progressContainer: { width: Math.min(SCREEN_WIDTH * 0.55, 220), height: 5, borderRadius: 3, marginTop: 20, overflow: "hidden" },
    progressBar: { height: "100%", borderRadius: 3 },
    descContainer: { marginTop: 24, paddingHorizontal: 24 },
    descText: { fontSize: FONT_SIZE.base, textAlign: "center", lineHeight: 22 },
    descBold: { fontWeight: "900" },
    loadingOverlay: {
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      justifyContent: "center", alignItems: "center", zIndex: 200,
    },
    loadingBox: {
      borderRadius: 20, padding: 36, alignItems: "center",
      width: SCREEN_WIDTH * 0.75,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
    },
    loadingText: { fontSize: 16, fontWeight: "600", marginTop: 20, textAlign: "center" },
    loadingProgressBg: { width: "100%", height: 3, borderRadius: 2, marginTop: 20, overflow: "hidden" },
    loadingProgressFill: { width: "60%", height: "100%", borderRadius: 2 },
  });
