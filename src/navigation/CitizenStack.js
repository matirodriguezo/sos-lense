import { useMemo } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../context/ThemeContext";
import CitizenTabs from "./CitizenTabs";
import ClassificationScreen from "../screens/citizen/ClassificationScreen";
import VideoCallScreen from "../screens/citizen/VideoCallScreen";
import DetailPromptScreen from "../screens/citizen/DetailPromptScreen";
import CitizenProfileScreen from "../screens/citizen/ProfileScreen";
import { FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

const Stack = createNativeStackNavigator();

function CitizenLayout() {
  return <CitizenTabs />;
}

export default function CitizenStack() {
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
        name="Home"
        component={CitizenLayout}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DetailPrompt"
        component={DetailPromptScreen}
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="Classification"
        component={ClassificationScreen}
        options={{ headerShown: false, animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{ headerShown: false, animation: "fade" }}
      />
      <Stack.Screen
        name="CitizenProfile"
        component={CitizenProfileScreen}
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}
