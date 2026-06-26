import { useRef, useMemo, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const APPS = [
  { name: "Calculadora", icon: "calculator-outline", color: "#2563EB" },
  { name: "Notas", icon: "document-text-outline", color: "#D97706" },
  { name: "Clima", icon: "partly-sunny-outline", color: "#0891B2" },
  { name: "Calendario", icon: "calendar-outline", color: "#7C3AED" },
  { name: "Reloj", icon: "time-outline", color: "#DC2626" },
  { name: "Galería", icon: "images-outline", color: "#059669" },
  { name: "Música", icon: "musical-notes-outline", color: "#DB2777" },
  { name: "Ajustes", icon: "settings-outline", color: "#475569" },
  { name: "Mapas", icon: "map-outline", color: "#16A34A" },
  { name: "Teléfono", icon: "call-outline", color: "#2563EB" },
  { name: "Contactos", icon: "people-outline", color: "#0891B2" },
  { name: "Cámara", icon: "camera-outline", color: "#475569" },
];

export default function FakeAppScreen({ navigation }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleGoBack = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
    ]).start(() => navigation.goBack());
  };

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />

        {/* Home screen content */}
        <ScrollView contentContainerStyle={s.grid}>
          {APPS.map((app, i) => (
            <TouchableOpacity key={i} style={s.appItem} activeOpacity={0.5} onPress={() => {}}>
              <View style={[s.appIcon, { backgroundColor: app.color + "18" }]}>
                <Ionicons name={app.icon} size={28} color={app.color} />
              </View>
              <Text style={s.appLabel}>{app.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Dock */}
        <View style={s.dock}>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="call-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="chatbubbles-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="safari-outline" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="musical-notes-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        {/* Return button - MUCHO MÁS GRANDE */}
        <TouchableOpacity style={s.returnBtn} onPress={handleGoBack} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left-circle" size={44} color={colors.primary} />
          <Text style={s.returnText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const W = (SCREEN_WIDTH - 24 * 5) / 4;

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    safeArea: { flex: 1, backgroundColor: "#fff" },
    grid: {
      flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 24, paddingTop: 48,
      rowGap: 20, columnGap: 16, paddingBottom: 100,
    },
    appItem: { width: W, alignItems: "center" },
    appIcon: { width: 56, height: 56, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 6 },
    appLabel: { fontSize: 11, color: "#000", fontWeight: "500", textAlign: "center" },
    dock: {
      flexDirection: "row", justifyContent: "center", gap: 24,
      backgroundColor: "rgba(0,0,0,0.05)", paddingVertical: 12,
      marginHorizontal: 24, borderRadius: 24,
      position: "absolute", bottom: 100, left: 0, right: 0,
    },
    dockItem: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(0,0,0,0.05)", justifyContent: "center", alignItems: "center" },
    returnBtn: {
      position: "absolute", bottom: 40,
      left: SCREEN_WIDTH / 2 - 60,
      width: 120, height: 60, borderRadius: 30,
      backgroundColor: "rgba(0,0,0,0.06)",
      justifyContent: "center", alignItems: "center",
      flexDirection: "row", gap: 6,
    },
    returnText: { fontSize: 16, fontWeight: "600", color: colors.primary },
  });
