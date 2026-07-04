import { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { ROLES } from "../constants/roles";
import { useTheme } from "../context/ThemeContext";
import { setCurrentAlias, setShiftStart } from "../services/userStore";
import WebLoginScreen from "../screens/web/WebLoginScreen";
import WebDashboardView from "../screens/web/WebDashboardView";

export default function WebNavigator() {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          if (snap.exists()) {
            const data = snap.data();
            setRole(data.role);
            setCurrentAlias(data.alias || "");
            if (data.role === ROLES.OFFICER) setShiftStart(Date.now());
          }
        } catch {}
        setLoading(false);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user || role !== ROLES.OFFICER) {
    return <WebLoginScreen onLogin={() => setLoading(true)} />;
  }

  return <WebDashboardView />;
}
