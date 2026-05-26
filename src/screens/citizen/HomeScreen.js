import { useState, useRef, useEffect } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import * as Location from "expo-location";
import { auth } from "../../firebase/firebaseConfig";
import { triggerSOS, listenCitizenHistory } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width - SPACING.lg * 2;
const HISTORY_PREVIEW_COUNT = 3;

const TYPE_ICONS = {
  ACCIDENTE: "car-outline",
  ROBO: "shield-half-outline",
  VIOLENCIA: "home-outline",
  OTRO: "alert-circle-outline",
};

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [lastIncidents, setLastIncidents] = useState([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef(null);
  const pressInterval = useRef(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const unsub = listenCitizenHistory(user.uid, (data) => {
        setLastIncidents(data.slice(0, HISTORY_PREVIEW_COUNT));
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
      const incidentId = await triggerSOS(user.uid, { latitude, longitude });

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
      const incidentId = await triggerSOS(user.uid, { latitude, longitude });
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Drawer Overlay Menú */}
      {menuVisible && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerAvatar}>
                <Ionicons name="person-outline" size={32} color="#004B2B" />
              </View>
              <Text style={styles.drawerName}>Ciudadano</Text>
              <Text style={styles.drawerRut}>RUT: {auth.currentUser?.email?.split('@')[0]}</Text>
            </View>

            <View style={styles.drawerBody}>
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMenuVisible(false); navigation.navigate("Perfil"); }}>
                <Ionicons name="person-outline" size={22} color="#1A1A1A" />
                <Text style={styles.drawerItemText}>Mi Perfil</Text>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMenuVisible(false); navigation.navigate("Historial"); }}>
                <MaterialCommunityIcons name="history" size={24} color="#1A1A1A" />
                <Text style={styles.drawerItemText}>Historial</Text>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" style={{marginLeft: 'auto'}} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.drawerItem} onPress={() => { setMenuVisible(false); Alert.alert("Ajustes", "Próximamente"); }}>
                <Ionicons name="settings-outline" size={22} color="#1A1A1A" />
                <Text style={styles.drawerItemText}>Ajustes LENSE</Text>
                <Ionicons name="chevron-forward" size={20} color="#A0A0A0" style={{marginLeft: 'auto'}} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="#D32F2F" />
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="menu" size={30} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>S.O.S. CARABINEROS</Text>
        <TouchableOpacity style={styles.avatarButton} onPress={() => navigation.navigate("Perfil")}>
          <Ionicons name="person-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* LENSE Video Card */}
        <TouchableOpacity style={styles.lenseCard} activeOpacity={0.9} onPress={() => Alert.alert("Guía", "Instrucciones de señas.")}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </View>
          <View style={styles.lenseTag}>
            <Text style={styles.lenseTagText}>Guía LENSE</Text>
          </View>
        </TouchableOpacity>

        {/* SOS Button Area */}
        <View style={styles.sosSection}>
          <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              style={[styles.sosButton, loading && { opacity: 0.7 }]}
              onPressIn={startSOSPress}
              onPressOut={cancelSOSPress}
              disabled={loading}
              activeOpacity={0.9}
              delayLongPress={2000}
            >
              <MaterialCommunityIcons name="broadcast" size={40} color="#FFFFFF" style={{ marginBottom: -5 }} />
              <Text style={styles.sosText}>S.O.S</Text>
            </TouchableOpacity>
            {isPressing && (
              <View style={styles.progressContainer}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
              </View>
            )}
          </Animated.View>
          <Text style={styles.sosHint}>
            Mantenga presionado en caso de{"\n"}
            <Text style={styles.sosHintBold}>EMERGENCIA</Text>
          </Text>
        </View>
      </View>

      {/* Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={[styles.denunciaButton, loading && { opacity: 0.6 }]} onPress={handleDenuncia} disabled={loading}>
          <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
          <Text style={styles.denunciaText}>Botón para denuncias</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  // Drawer
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 100 },
  drawerContainer: { width: width * 0.75, height: "100%", backgroundColor: "#FFFFFF" },
  drawerHeader: { backgroundColor: "#004B2B", paddingVertical: 40, paddingHorizontal: 24, paddingTop: 60 },
  drawerAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#E6F0EC", justifyContent: "center", alignItems: "center", marginBottom: 12 },
  drawerName: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  drawerRut: { color: "#E0E0E0", fontSize: 13, marginTop: 4 },
  drawerBody: { flex: 1, paddingTop: 20 },
  drawerItem: { flexDirection: "row", alignItems: "center", paddingVertical: 18, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  drawerItemText: { fontSize: 16, color: "#1A1A1A", marginLeft: 16, fontWeight: "500" },
  logoutBtn: { flexDirection: "row", alignItems: "center", padding: 24, borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  logoutText: { fontSize: 16, color: "#D32F2F", marginLeft: 16, fontWeight: "600" },
  
  // Navbar
  navbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  navTitle: { fontSize: 16, fontWeight: "bold", color: "#004B2B", letterSpacing: 1 },
  avatarButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#004B2B", justifyContent: "center", alignItems: "center" },
  
  content: { flex: 1, paddingHorizontal: 24, alignItems: "center" },
  lenseCard: { width: "100%", height: 180, borderRadius: 16, backgroundColor: "#151F1A", marginTop: 24, justifyContent: "center", alignItems: "center", position: "relative" },
  playButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)" },
  lenseTag: { position: "absolute", bottom: 12, left: 12, backgroundColor: "rgba(0,0,0,0.8)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  lenseTagText: { color: "#FFFFFF", fontSize: 12, fontWeight: "bold" },
  
  sosSection: { flex: 1, justifyContent: "center", alignItems: "center" },
  sosButton: { width: 220, height: 220, borderRadius: 110, backgroundColor: "#D32F2F", justifyContent: "center", alignItems: "center", elevation: 12, shadowColor: "#D32F2F", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 10 },
  sosText: { fontSize: 44, fontWeight: "bold", color: "#FFFFFF", letterSpacing: 2, marginTop: 4 },
  progressContainer: { width: 140, height: 6, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 3, marginTop: 16, alignSelf: "center" },
  progressBar: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 3 },
  sosHint: { fontSize: 14, color: "#666666", textAlign: "center", marginTop: 32, lineHeight: 22 },
  sosHintBold: { color: "#1A1A1A", fontWeight: "900", letterSpacing: 1 },
  
  bottomBar: { paddingHorizontal: 24, paddingVertical: 20, backgroundColor: "#F8F9FA" },
  denunciaButton: { flexDirection: "row", backgroundColor: "#004B2B", borderRadius: 12, height: 56, justifyContent: "center", alignItems: "center", gap: 12 },
  denunciaText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});