import { useMemo } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../context/ThemeContext";
import LoginScreen from "../screens/auth/LoginScreen";
import OfficerLoginScreen from "../screens/auth/OfficerLoginScreen";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  const { colors } = useTheme();

  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: colors.headerBg },
    headerTintColor: colors.primary,
    headerTitleStyle: { fontWeight: "700", fontSize: 14 },
    headerShadowVisible: false,
    animation: "fade",
  }), [colors]);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OfficerLogin" component={OfficerLoginScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
