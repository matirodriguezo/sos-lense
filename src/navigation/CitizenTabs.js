import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import HomeScreen from "../screens/citizen/HomeScreen";
import HistoryScreen from "../screens/citizen/HistoryScreen";
import ProfileScreen from "../screens/citizen/ProfileScreen";
import { FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused, colors }) {
  const icons = { Inicio: "🏠", Historial: "📋", Perfil: "👤" };
  return (
    <View style={[styles.iconContainer, focused && { backgroundColor: colors.greenTranslucent }]}>
      <Text style={styles.icon}>{icons[label] || "•"}</Text>
    </View>
  );
}

export default function CitizenTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name} focused={focused} colors={colors} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: colors.tabBorder,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{ tabBarLabel: "Inicio" }}
      />
      <Tab.Screen
        name="Historial"
        component={HistoryScreen}
        options={{ tabBarLabel: "Historial" }}
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
  icon: { fontSize: 20 },
});
