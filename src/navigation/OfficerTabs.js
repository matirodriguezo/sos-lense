import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import OfficerStack from "./OfficerStack";
import MapScreen from "../screens/officer/MapScreen";
import ChatScreen from "../screens/officer/ChatScreen";
import ProfileScreen from "../screens/officer/ProfileScreen";
import { FONT_SIZE, FONT_WEIGHT } from "../constants/theme";
import { useNotifications } from "../context/NotificationContext";

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Emergencia: "alert-circle-outline",
  Mapa: "map-outline",
  Chat: "chatbubbles-outline",
  Perfil: "person-outline",
};

function TabIcon({ label, focused, badge, colors }) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: colors.greenTranslucent }]}>
      <Ionicons
        name={TAB_ICONS[label]}
        size={22}
        color={focused ? colors.primary : colors.tabInactive}
      />
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.badgeRed }]}>
          <Text style={[styles.badgeText, { color: colors.white }]}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      )}
    </View>
  );
}

export default function OfficerTabs() {
  const { unreadCount } = useNotifications();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            label={route.name}
            focused={focused}
            badge={route.name === "Chat" ? unreadCount : 0}
            colors={colors}
          />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: colors.tabBorder,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen
        name="Emergencia"
        component={OfficerStack}
        options={{ tabBarLabel: "Emergencia" }}
      />
      <Tab.Screen
        name="Mapa"
        component={MapScreen}
        options={{ tabBarLabel: "Mapa" }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{ tabBarLabel: "Chat" }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{ tabBarLabel: "Perfil" }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    fontSize: FONT_SIZE.xxs,
    fontWeight: FONT_WEIGHT.medium,
    marginTop: -2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
});