import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import CitizenStack from "./CitizenStack";
import { COLORS, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Inicio: "🏠", Historial: "📋", Perfil: "👤" };
  return (
    <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
      <Text style={styles.icon}>{icons[label] || "•"}</Text>
    </View>
  );
}

export default function CitizenTabs() {
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
        name="Inicio"
        component={CitizenStack}
        options={{ tabBarLabel: "Inicio" }}
      />
      <Tab.Screen
        name="Historial"
        component={PlaceholderScreen}
        options={{ tabBarLabel: "Historial" }}
      />
      <Tab.Screen
        name="Perfil"
        component={PlaceholderScreen}
        options={{ tabBarLabel: "Perfil" }}
      />
    </Tab.Navigator>
  );
}

function PlaceholderScreen() {
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
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semiBold,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainerActive: {
    backgroundColor: "rgba(0, 75, 43, 0.1)",
  },
  icon: { fontSize: 20 },
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
