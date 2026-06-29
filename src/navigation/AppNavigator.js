import { ActivityIndicator, View } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import AuthStack from "./AuthStack";
import CitizenStack from "./CitizenStack";
import OfficerTabs from "./OfficerTabs";

export default function AppNavigator() {
  const { colors } = useTheme();
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) { console.log("[AppNavigator] No user → AuthStack"); return <AuthStack />; }
  if (role === "OFFICER") { console.log("[AppNavigator] Role OFFICER → OfficerTabs"); return <OfficerTabs />; }
  console.log("[AppNavigator] Role CITIZEN → CitizenStack");
  return <CitizenStack />;
}