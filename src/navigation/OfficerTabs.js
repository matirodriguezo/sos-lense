import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import OfficerStack from "./OfficerStack";
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../constants/theme";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = {
    Emergencia: "🆘",
    Mapa: "🗺️",
    Chat: "💬",
    Perfil: "👤",
  };
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Text style={[styles.icon, focused && styles.iconActive]}>
        {icons[label] || "•"}
      </Text>
    </View>
  );
}

export default function OfficerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
      })}
    >
      <Tab.Screen
        name="Emergencia"
        component={OfficerStack}
        options={{ tabBarLabel: "Emergencia" }}
      />
      <Tab.Screen
        name="Mapa"
        component={Placeholder}
        options={{ tabBarLabel: "Mapa" }}
      />
      <Tab.Screen
        name="Chat"
        component={Placeholder}
        options={{ tabBarLabel: "Chat" }}
      />
      <Tab.Screen
        name="Perfil"
        component={Placeholder}
        options={{ tabBarLabel: "Perfil" }}
      />
    </Tab.Navigator>
  );
}

function Placeholder() {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>Próximamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
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
  },
  iconWrapActive: {
    backgroundColor: COLORS.greenTranslucent,
  },
  icon: { fontSize: 20, opacity: 0.5 },
  iconActive: { opacity: 1 },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  placeholderText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semiBold,
  },
});
