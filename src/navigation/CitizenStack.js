import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CitizenTabs from "./CitizenTabs";
import ClassificationScreen from "../screens/citizen/ClassificationScreen";
import VideoCallScreen from "../screens/citizen/VideoCallScreen";
import { COLORS, FONT_SIZE, FONT_WEIGHT } from "../constants/theme";

const Stack = createNativeStackNavigator();

export default function CitizenStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.surface },
        headerTintColor: COLORS.primary,
        headerTitleStyle: {
          fontWeight: FONT_WEIGHT.bold,
          fontSize: FONT_SIZE.md,
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={CitizenTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Classification"
        component={ClassificationScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="VideoCall"
        component={VideoCallScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
