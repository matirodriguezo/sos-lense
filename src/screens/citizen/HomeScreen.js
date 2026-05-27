import { useState, useRef, useEffect, useMemo } from "react";
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
  FlatList,
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
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SOS_SIZE = Math.min(SCREEN_WIDTH * 0.42, 200);
const HISTORY_PREVIEW_COUNT = 3;

const TYPE_ICONS = {
  ACCIDENTE: "car-outline",
  ROBO: "shield-half-outline",
  VIOLENCIA: "home-outline",
  OTRO: "alert-circle-outline",
};

export default function HomeScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [lastIncidents, setLastIncidents] = useState([]);
  const [userData, setUserData] = useState(null);
  const [activeIncident, setActiveIncident] = useState(null);
  const { unreadCount } = useNotifications();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef(null);
  const pressInterval = useRef(null);
  const insets = useSafeAreaInsets();

  const s = useMemo(() => makeStyles(colors), [colors]);

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

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.05, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.98, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const startSOSPress = () => {
    setIsPressing(true);
    setPressProgress(0);
    progressAnim.setValue(0);
    Vibration.vibrate(50);

    let progress = 0;
    pressInterval.current = setInterval(() => {
      progress += 5;
      setPressProgress(progress);
      Animated.timing(progressAnim, {
        toValue: progress / 100,
        duration: 50,
        useNativeDriver: false,
      }).start();

      if (progress >= 100) {
        clearInterval(pressInterval.current);
        clearTimeout(pressTimer.current);
        setIsPressing(false);
        setPressProgress(0);
        executeSOS();
      }
    }, 100);
  };

  const cancelSOSPress = () => {
    if (pressInterval.current) clearInterval(pressInterval.current);
    if (pressTimer.current) clearTimeout(pressTimer.current);
    setIsPressing(false);
    setPressProgress(0);
    progressAnim.setValue(0);
    if (pressProgress > 30) Vibration.vibrate(50);
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

  const handleDenuncia = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación.");
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;
      const user = auth.currentUser;
      const citizenAlias = getCurrentAlias();
      const address = await getAddress(latitude, longitude);
      const incidentId = await triggerSOS(user.uid, { latitude, longitude, address, citizenAlias });
      if (incidentId) {
        navigation.navigate("Classification", { incidentId });
      }
    } catch {
      Alert.alert("Error", "No se pudo crear la denuncia.");
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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />

      {/* Drawer Overlay Menú */}
      {menuVisible && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={[s.drawerContainer, { backgroundColor: colors.surface }]}>
            <View style={[s.drawerHeader, { backgroundColor: colors.drawerHeaderBg, paddingTop: 24 + insets.top }]}>
              <View style={[s.drawerAvatar, { backgroundColor: colors.primary + "20" }]}>
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
                <Ionicons name="chevron-forward" size={20} color={colors.emptyText} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
              
              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); navigation.navigate("Historial"); }}>
                <MaterialCommunityIcons name="history" size={24} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Historial</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.emptyText} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={[s.drawerItem, { borderBottomColor: colors.border }]} onPress={() => { setMenuVisible(false); Alert.alert("Ajustes", "Próximamente"); }}>
                <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
                <Text style={[s.drawerItemText, { color: colors.textPrimary }]}>Ajustes LENSE</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.emptyText} style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[s.logoutBtn, { borderTopColor: colors.border }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
              <Text style={[s.logoutText, { color: colors.danger }]}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: colors.headerBg, borderBottomColor: colors.border, paddingTop: 12 + insets.top }]}>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={s.menuBtn}>
          <Ionicons name="menu" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: colors.primary }]}>S.O.S. CARABINEROS</Text>
        <TouchableOpacity style={[s.avatarButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate("Perfil")} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="person-outline" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        {/* LENSE Video Card */}
        <TouchableOpacity style={[s.lenseCard, { backgroundColor: colors.lenseCard }]} activeOpacity={0.9} onPress={() => Alert.alert("Guía", "Instrucciones de señas.")}>
          <View style={s.playButton}>
            <Ionicons name="play" size={24} color={colors.white} style={{ marginLeft: 4 }} />
          </View>
          <View style={s.lenseTag}>
            <Text style={s.lenseTagText}>Guía LENSE</Text>
          </View>
        </TouchableOpacity>

        {/* Active Call Banner */}
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

        {/* SOS Button Area */}
        <View style={s.sosSection}>
          <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              style={[s.sosButton, { backgroundColor: colors.danger, width: SOS_SIZE, height: SOS_SIZE, borderRadius: SOS_SIZE / 2, ...SHADOWS.sos }, loading && { opacity: 0.7 }]}
              onPressIn={startSOSPress}
              onPressOut={cancelSOSPress}
              disabled={loading}
              activeOpacity={0.9}
              delayLongPress={2000}
            >
              <MaterialCommunityIcons name="broadcast" size={40} color={colors.white} style={{ marginBottom: -5 }} />
              <Text style={s.sosText}>S.O.S</Text>
            </TouchableOpacity>
            {isPressing && (
              <View style={s.progressContainer}>
                <Animated.View style={[s.progressBar, { width: progressWidth }]} />
              </View>
            )}
          </Animated.View>
          <Text style={[s.sosHint, { color: colors.textSecondary }]}>
            Mantenga presionado en caso de{"\n"}
            <Text style={[s.sosHintBold, { color: colors.textPrimary }]}>EMERGENCIA</Text>
          </Text>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={[s.bottomBar, { backgroundColor: colors.background, paddingBottom: 20 + insets.bottom }]}>
        <TouchableOpacity
          style={[s.denunciaButton, { backgroundColor: colors.primary }, loading && { opacity: 0.5 }]}
          onPress={handleDenuncia}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={24} color={colors.white} />
          <Text style={s.denunciaText}>Botón para denuncias</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.blackTranslucent, zIndex: 100 },
    drawerContainer: { width: SCREEN_WIDTH * 0.75, height: "100%" },
    drawerHeader: { paddingVertical: 24, paddingHorizontal: 24 },
    drawerAvatar: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 12 },
    drawerName: { color: colors.white, fontSize: 20, fontWeight: "bold" },
    drawerRut: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
    drawerEmail: { color: colors.emptyText, fontSize: 11, marginTop: 2 },
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
    lenseCard: { width: "100%", height: 180, borderRadius: 16, marginTop: 24, justifyContent: "center", alignItems: "center", position: "relative" },
    playButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.whiteTranslucent, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.whiteTranslucent },
    lenseTag: { position: "absolute", bottom: 12, left: 12, backgroundColor: colors.blackTranslucent, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    lenseTagText: { color: colors.white, fontSize: 12, fontWeight: "bold" },
    
    activeCallBanner: {
      flexDirection: "row", alignItems: "center",
      borderRadius: 12, padding: 16, marginTop: 24, gap: 12, width: "100%",
      elevation: 4, shadowColor: colors.primary, shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.3, shadowRadius: 4,
    },
    activeCallDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.success },
    activeCallInfo: { flex: 1 },
    activeCallTitle: { color: colors.white, fontSize: 16, fontWeight: "bold" },
    activeCallSub: { color: colors.whiteTranslucent, fontSize: 13, marginTop: 2 },
    activeCallBadge: { minWidth: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
    activeCallBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
    sosSection: { flex: 1, justifyContent: "center", alignItems: "center" },
    sosButton: { justifyContent: "center", alignItems: "center" },
    sosText: { fontSize: 40, fontWeight: FONT_WEIGHT.bold, color: colors.white, letterSpacing: 2, marginTop: SPACING.xs },
    progressContainer: { width: 140, height: 6, backgroundColor: colors.whiteTranslucent, borderRadius: 3, marginTop: 16, alignSelf: "center" },
    progressBar: { height: "100%", backgroundColor: colors.white, borderRadius: 3 },
    sosHint: { fontSize: FONT_SIZE.base, textAlign: "center", marginTop: SPACING.xl, lineHeight: 22 },
    sosHintBold: { fontWeight: "900", letterSpacing: 1 },
    
    bottomBar: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
    denunciaButton: { flexDirection: "row", borderRadius: RADIUS.md, height: 56, justifyContent: "center", alignItems: "center", gap: SPACING.sm },
    denunciaText: { color: colors.white, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  });
