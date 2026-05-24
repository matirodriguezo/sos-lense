import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../constants/theme";
import LoginScreen from "../screens/auth/LoginScreen";
import OfficerLoginScreen from "../screens/auth/OfficerLoginScreen";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="OfficerLogin" component={OfficerLoginScreen} />
    </Stack.Navigator>
  );
}
