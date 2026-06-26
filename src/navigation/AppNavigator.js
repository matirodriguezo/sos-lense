import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { ROLES } from "../constants/roles";
import { useTheme } from "../context/ThemeContext";
import { setCurrentAlias, setShiftStart } from "../services/userStore";
import AuthStack from "./AuthStack";
import CitizenStack from "./CitizenStack";
import OfficerTabs from "./OfficerTabs";

export default function AppNavigator() {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const retryCount = useRef(0);

  useEffect(() => {
    console.log("[AppNavigator] Initializing...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        let docSnap = null;
        retryCount.current = 0;

        while (retryCount.current < 10) {
          try {
            docSnap = await getDoc(doc(db, "users", firebaseUser.uid));
            if (docSnap.exists()) break;
          } catch {}
          retryCount.current++;
          await new Promise((r) => setTimeout(r, 300));
        }

        if (docSnap?.exists()) {
          const data = docSnap.data();
          setRole(data.role);
          setCurrentAlias(data.alias || "");
          if (data.role === ROLES.OFFICER) setShiftStart(Date.now());
          console.log("[AppNavigator] User ready:", data.role, data.alias || "no alias");
        }
        setLoading(false);
      } else {
        console.log("[AppNavigator] No user found");
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return unsubscribe;
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
