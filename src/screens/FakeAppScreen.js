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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COL = 4;
const GAP = 16;
const PAD = 24;
const APP_SIZE = Math.floor((SCREEN_WIDTH - PAD * 2 - GAP * (COL - 1)) / COL);

const APPS = [
  { name: "Teléfono", icon: "call-outline", color: "#34C759" },
  { name: "Mensajes", icon: "chatbubble-outline", color: "#34C759" },
  { name: "Correo", icon: "mail-outline", color: "#007AFF" },
  { name: "Cámara", icon: "camera-outline", color: "#8E8E93" },
  { name: "Fotos", icon: "images-outline", color: "#FF3B30" },
  { name: "WhatsApp", icon: "logo-whatsapp", color: "#25D366" },
  { name: "YouTube", icon: "logo-youtube", color: "#FF0000" },
  { name: "Instagram", icon: "logo-instagram", color: "#C13584" },
  { name: "Chrome", icon: "globe-outline", color: "#4285F4" },
  { name: "Gmail", icon: "mail-unread-outline", color: "#EA4335" },
  { name: "Mapas", icon: "map-outline", color: "#34C759" },
  { name: "Reloj", icon: "time-outline", color: "#007AFF" },
  { name: "Calculadora", icon: "calculator-outline", color: "#5856D6" },
  { name: "Calendario", icon: "calendar-outline", color: "#FF3B30" },
  { name: "Notas", icon: "document-text-outline", color: "#FFD60A" },
  { name: "Clima", icon: "partly-sunny-outline", color: "#5AC8FA" },
  { name: "Música", icon: "musical-notes-outline", color: "#FF2D55" },
  { name: "Ajustes", icon: "settings-outline", color: "#8E8E93" },
];

const chunkArray = (arr, size) => {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
};

const rows = chunkArray(APPS, COL);

export default function FakeAppScreen({ route, navigation }) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const handleGoBack = () => {
    const { fromDirectAlert } = route.params || {};
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      if (fromDirectAlert) {
        navigation.reset({ index: 0, routes: [{ name: "Main" }] });
      } else {
        navigation.goBack();
      }
    });
  };

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={Platform.OS === "android" ? "#fff" : undefined} />

        <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={s.row}>
              {row.map((app, colIndex) => (
                <TouchableOpacity key={colIndex} style={s.appItem} activeOpacity={0.5} onPress={() => {}}>
                  <View style={[s.appIcon, { backgroundColor: app.color + "18" }]}>
                    <Ionicons name={app.icon} size={26} color={app.color} />
                  </View>
                  <Text style={s.appLabel} numberOfLines={1}>{app.name}</Text>
                </TouchableOpacity>
              ))}
              {row.length < COL && Array.from({ length: COL - row.length }).map((_, i) => (
                <View key={`ph-${i}`} style={s.appItem} />
              ))}
            </View>
          ))}
        </ScrollView>

        {/* Dock */}
        <View style={s.dock}>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="call-outline" size={26} color="#34C759" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="globe-outline" size={26} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="chatbubble-ellipses-outline" size={26} color="#34C759" />
          </TouchableOpacity>
          <TouchableOpacity style={s.dockItem} activeOpacity={0.5}>
            <Ionicons name="musical-notes-outline" size={26} color="#FF2D55" />
          </TouchableOpacity>
        </View>

        {/* Return button */}
        <TouchableOpacity style={s.returnBtn} onPress={handleGoBack} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={18} color="#8E8E93" />
        </TouchableOpacity>
      </SafeAreaView>
    </Animated.View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    safeArea: { flex: 1, backgroundColor: "#fff" },

    grid: {
      paddingHorizontal: PAD, paddingTop: 32, paddingBottom: 150,
    },
    row: {
      flexDirection: "row", justifyContent: "space-between",
      marginBottom: 22,
    },
    appItem: { width: APP_SIZE, alignItems: "center" },
    appIcon: {
      width: 58, height: 58, borderRadius: 14,
      justifyContent: "center", alignItems: "center", marginBottom: 6,
    },
    appLabel: { fontSize: 11, color: "#000", fontWeight: "500", textAlign: "center", maxWidth: APP_SIZE - 4 },

    dock: {
      flexDirection: "row", justifyContent: "center", gap: 22,
      paddingVertical: 14, marginHorizontal: 28, borderRadius: 22,
      position: "absolute", bottom: 68, left: 0, right: 0,
    },
    dockItem: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: "rgba(0,0,0,0.04)",
      justifyContent: "center", alignItems: "center",
    },

    returnBtn: {
      position: "absolute", bottom: 20, alignSelf: "center",
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: "rgba(0,0,0,0.04)",
      justifyContent: "center", alignItems: "center",
    },
  });
