import { useEffect, useState, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { ROLES } from "../constants/roles";
import { COLORS } from "../constants/theme";
import { setCurrentAlias } from "../services/userStore";
import { registerForPushNotifications } from "../services/notificationService";
import AuthStack from "./AuthStack";
import CitizenStack from "./CitizenStack";
import OfficerTabs from "./OfficerTabs";

export default function AppNavigator() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const retryCount = useRef(0);

  useEffect(() => {
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
        }
        registerForPushNotifications(firebaseUser.uid);
        setLoading(false);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.surface }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) return <AuthStack />;
  if (role === ROLES.OFFICER) return <OfficerTabs />;
  return <CitizenStack />;
}
