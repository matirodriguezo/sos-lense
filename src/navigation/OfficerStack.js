import { useMemo } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../context/ThemeContext";
import { FONT_SIZE, FONT_WEIGHT } from "../constants/theme";
import DispatchPanelScreen from "../screens/officer/DispatchPanelScreen";
import IncidentManagementScreen from "../screens/officer/IncidentManagementScreen";
import CloseIncidentScreen from "../screens/officer/CloseIncidentScreen";

const Stack = createNativeStackNavigator();

export default function OfficerStack() {
  const { colors } = useTheme();

  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontWeight: FONT_WEIGHT.bold,
      fontSize: FONT_SIZE.md,
    },
    headerShadowVisible: false,
    animation: "fade",
  }), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DispatchPanel"
        component={DispatchPanelScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IncidentManagement"
        component={IncidentManagementScreen}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen
        name="CloseIncident"
        component={CloseIncidentScreen}
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
    </Stack.Navigator>
  );
}
