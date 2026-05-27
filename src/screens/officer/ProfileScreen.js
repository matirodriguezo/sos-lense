import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { listenMyCases } from "../../services/incidentService";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function ProfileScreen({ navigation }) {
  const [userData, setUserData] = useState(null);
  const [caseCount, setCaseCount] = useState(0);

  useEffect(() => {
    loadUserData();
    const unsub = listenMyCases(auth.currentUser?.uid, (data) => setCaseCount(data.length));
    return unsub;
  }, []);

  const loadUserData = async () => {
    const snap = await getDoc(doc(db, "users", auth.currentUser?.uid));
    if (snap.exists()) setUserData(snap.data());
  };

  const handleLogout = () => {
    Alert.alert("Finalizar Turno", "¿Deseas salir del sistema?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: () => signOut(auth) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="menu" size={28} color="#004B2B" /></TouchableOpacity>
        <Text style={styles.headerTitle}>S.O.S. CARABINEROS</Text>
        <View style={styles.miniAvatar}><MaterialCommunityIcons name="police-badge" size={16} color="#D4AF37" /></View>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={styles.avatarLarge}>
            <MaterialCommunityIcons name="police-badge" size={48} color="#D4AF37" />
          </View>
          <View style={styles.serviceBadge}><Text style={styles.serviceBadgeText}>● En Servicio</Text></View>
          <Text style={styles.userName}>{userData?.alias || "Operador"}</Text>
          {userData?.rut && <Text style={styles.userRank}>Placa: {userData.rut}</Text>}
        </View>

        <View style={styles.actionRow}>
            <TouchableOpacity style={styles.editBtn}><Ionicons name="pencil" size={14} color="#FFF"/> <Text style={styles.editBtnText}>Editar Perfil</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn}><Ionicons name="document-text-outline" size={14} color="#004B2B"/> <Text style={styles.sheetBtnText}>Hoja de Vida</Text></TouchableOpacity>
        </View>

        <View style={styles.dataCard}>
            <View style={styles.dataHeader}><MaterialCommunityIcons name="badge-account-outline" size={20} color="#A0A0A0"/> <Text style={styles.dataTitle}>NÚMERO DE PLACA / RUT</Text></View>
            <Text style={styles.dataValueBig}>{userData?.rut || "12.345.678-9"}</Text>
            <Text style={styles.dataSub}>Credencial Validada</Text>
        </View>

        <View style={styles.dataCard}>
            <View style={styles.dataHeader}><Ionicons name="mail-outline" size={20} color="#A0A0A0"/> <Text style={styles.dataTitle}>EMAIL INSTITUCIONAL</Text></View>
            <Text style={styles.dataValue}>{auth.currentUser?.email || "—"}</Text>
        </View>

        <View style={styles.dataCard}>
            <View style={styles.dataHeader}><Ionicons name="shield-checkmark-outline" size={20} color="#A0A0A0"/> <Text style={styles.dataTitle}>UNIDAD ASIGNADA</Text></View>
            <Text style={styles.dataValue}>Central de Comunicaciones (CENCO)</Text>
            <Text style={styles.dataSub}>Sector Sur, Región Metropolitana</Text>
        </View>
        
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
          <Text style={styles.logoutText}>Finalizar Turno</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#FFF", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  headerTitle: { color: "#004B2B", fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#003A20", justifyContent: "center", alignItems: "center" },
  
  content: { flex: 1, padding: 24 },
  avatarSection: { alignItems: "center", marginBottom: 24 },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#003A20", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#004B2B" },
  serviceBadge: { backgroundColor: "#4CAF50", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: -12, borderWidth: 2, borderColor: "#F8F9FA" },
  serviceBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "bold" },
  userName: { fontSize: 22, fontWeight: "bold", color: "#1A1A1A", marginTop: 12 },
  userRank: { fontSize: 14, color: "#004B2B", fontWeight: "600", marginTop: 4 },
  
  actionRow: { flexDirection: "row", gap: 12, marginBottom: 32 },
  editBtn: { flex: 1, flexDirection: "row", backgroundColor: "#004B2B", paddingVertical: 12, borderRadius: 8, justifyContent: "center", alignItems: "center", gap: 6 },
  editBtnText: { color: "#FFF", fontSize: 12, fontWeight: "bold" },
  sheetBtn: { flex: 1, flexDirection: "row", backgroundColor: "#FFF", paddingVertical: 12, borderRadius: 8, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#E0E0E0", gap: 6 },
  sheetBtnText: { color: "#004B2B", fontSize: 12, fontWeight: "bold" },

  dataCard: { backgroundColor: "#FFF", padding: 20, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", marginBottom: 16 },
  dataHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  dataTitle: { fontSize: 11, color: "#666", fontWeight: "bold", letterSpacing: 1 },
  dataValueBig: { fontSize: 28, fontWeight: "900", color: "#1A1A1A" },
  dataValue: { fontSize: 18, fontWeight: "bold", color: "#1A1A1A" },
  dataSub: { fontSize: 12, color: "#A0A0A0", marginTop: 4 },

  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: "auto", padding: 16, borderRadius: 12, backgroundColor: "#FFF0F0", borderWidth: 1, borderColor: "#FFD6D6", gap: 8 },
  logoutText: { color: "#D32F2F", fontSize: 14, fontWeight: "bold" },
});