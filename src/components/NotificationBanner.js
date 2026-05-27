import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationBanner() {
  const { banner } = useNotifications();
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (banner) {
      Animated.sequence([
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(slideAnim, { toValue: -100, duration: 200, useNativeDriver: true }).start();
    }
  }, [banner]);

  if (!banner) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: colors.surface,
          borderColor: colors.primary,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.sender, { color: colors.textPrimary }]} numberOfLines={1}>
          {banner.senderName}
        </Text>
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
          {banner.text}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.danger }]}>
        <Text style={styles.badgeText}>1</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 9999,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,75,43,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  sender: { fontSize: 14, fontWeight: "700" },
  preview: { fontSize: 12, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});