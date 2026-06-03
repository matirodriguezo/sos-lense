import { useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNotifications } from "../context/NotificationContext";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

export default function NotificationBanner() {
  const { banner } = useNotifications();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (banner) {
      slideAnim.setValue(-120);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 180,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [banner]);

  const handlePress = useCallback(() => {
    if (!banner?.route) return;
    navigation.navigate(banner.route, banner.params);
  }, [banner, navigation]);

  if (!banner) return null;

  return (
    <Animated.View
      style={[
        s.root,
        {
          top: insets.top + 8,
          left: 12,
          right: 12,
          transform: [{ translateY: slideAnim }],
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          shadowColor: "#000",
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={s.touchable}>
        <View style={[s.iconWrap, { backgroundColor: colors.greenTranslucent }]}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        </View>
        <View style={s.textWrap}>
          <Text style={[s.sender, { color: colors.textPrimary }]} numberOfLines={1}>
            {banner.senderName}
          </Text>
          <Text style={[s.preview, { color: colors.textSecondary }]} numberOfLines={1}>
            {banner.text}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: colors.danger }]}>
          <Text style={[s.badgeText, { color: colors.white }]}>1</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: {
    position: "absolute",
    zIndex: 9999,
    elevation: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    overflow: "visible",
  },
  touchable: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  badgeText: { fontSize: 11, fontWeight: "700" },
});
