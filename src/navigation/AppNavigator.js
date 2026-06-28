import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ROLES } from "../constants/roles";
import { useTheme } from "../context/ThemeContext";
import { setCurrentAlias, setShiftStart } from "../services/userStore";
import { hydrateUserFromToken, getUser, getToken } from "../services/authService";
import AuthStack from "./AuthStack";
import CitizenStack from "./CitizenStack";
import OfficerTabs from "./OfficerTabs";

export default function AppNavigator() {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AppNavigator] Initializing...");
    let mounted = true;

    async function bootstrap() {
      try {
        await hydrateUserFromToken();
        const [token, stored] = await Promise.all([
          getToken(),
          getUser(),
        ]);
        if (!mounted) return;

        if (token && stored) {
          setUser({ userId: stored.userId, email: stored.email });
          setRole(stored.role);
          setCurrentAlias(stored.alias || "");
          if (stored.role === ROLES.OFFICER) setShiftStart(Date.now());
          console.log("[AppNavigator] User ready:", stored.role, stored.alias || "no alias");
        } else {
          console.log("[AppNavigator] No user found");
          setUser(null);
          setRole(null);
        }
      } catch (e) {
        console.warn("[AppNavigator] Bootstrap error:", e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) { console.log("[AppNavigator] No user → AuthStack"); return <AuthStack />; }
  if (role === ROLES.OFFICER) { console.log("[AppNavigator] Role OFFICER → OfficerTabs"); return <OfficerTabs />; }
  console.log("[AppNavigator] Role CITIZEN → CitizenStack");
  return <CitizenStack />;
}
