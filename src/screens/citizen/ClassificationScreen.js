import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { cancelIncident } from "../../services/incidentService";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - 48 - 16) / 2; // padding 24x2 + gap 16

const INCIDENT_OPTIONS = [
  { id: "ACCIDENTE", icon: "car-outline", label: "Accidente de Tránsito" },
  { id: "ROBO", icon: "shield-half-outline", label: "Robo o Asalto" },
  { id: "VIOLENCIA", icon: "home-outline", label: "Violencia Intrafamiliar" },
  { id: "MEDICA", icon: "pulse-outline", label: "Emergencia Médica" },
];

export default function ClassificationScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const classifyAndNavigate = async (id) => {
    setSelected(id);
    setSubmitting(true);

    try {
      await updateDoc(doc(db, "incidents", incidentId), {
        type: id,
        status: "ACTIVO",
        updatedAt: new Date().toISOString(),
      });

      // Simulación visual rápida de carga antes de entrar al video
      setTimeout(() => {
        navigation.replace("VideoCall", { incidentId });
      }, 1000);
    } catch {
      setSubmitting(false);
      Alert.alert("Error", "No se pudo actualizar el tipo de emergencia.");
    }
  };

  const confirmCancel = () => {
    Alert.alert(
      "Cancelar alerta",
      "¿Estás seguro de que deseas cancelar esta alerta?",
      [
        { text: "Seguir reportando", style: "cancel" },
        {
          text: "Cancelar alerta",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelIncident(incidentId, "Cancelado por el usuario");
            } catch {}
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.closeButton} onPress={confirmCancel}>
          <Ionicons name="close" size={28} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.stepText}>Paso 1 de 2</Text>
        <Text style={styles.sosLabel}>S.O.S.</Text>
      </View>

      <View style={styles.content}>
        {/* LENSE Video Mini */}
        <TouchableOpacity style={styles.lenseMini} activeOpacity={0.9}>
          <View style={styles.playMini}>
            <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 3 }} />
          </View>
        </TouchableOpacity>

        <Text style={styles.questionTitle}>¿Qué pasó?</Text>
        <Text style={styles.questionSub}>
          Seleccione la categoría de su emergencia
        </Text>

        {/* 2x2 Grid */}
        <View style={styles.grid}>
          {INCIDENT_OPTIONS.map((item) => {
            const isSelected = selected === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => classifyAndNavigate(item.id)}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
                <Ionicons 
                  name={item.icon} 
                  size={42} 
                  color={isSelected ? "#004B2B" : "#4A4A4A"} 
                  style={{ marginBottom: 12 }} 
                />
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.otherLink} onPress={() => classifyAndNavigate("OTRO")} disabled={submitting}>
          <Text style={styles.otherLinkText}>No sé / Otro tipo de emergencia</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Fixed Area */}
      <View style={styles.bottomArea}>
        <TouchableOpacity 
          style={[styles.confirmButton, submitting && { opacity: 0.6 }]} 
          disabled={true} 
        >
          <Text style={styles.confirmButtonText}>
            {submitting ? "Actualizando..." : "Actualizar Reporte"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#FFFFFF", paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#E0E0E0",
  },
  closeButton: { width: 36, height: 36, justifyContent: "center" },
  stepText: { fontSize: 16, fontWeight: "bold", color: "#1A1A1A" },
  sosLabel: { fontSize: 16, fontWeight: "900", color: "#004B2B", letterSpacing: 1 },
  
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  lenseMini: {
    width: "100%", height: 120, borderRadius: 12, backgroundColor: "#151F1A",
    justifyContent: "center", alignItems: "center", marginBottom: 24,
  },
  playMini: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.5)",
  },
  
  questionTitle: { fontSize: 26, fontWeight: "bold", color: "#1A1A1A", marginBottom: 4 },
  questionSub: { fontSize: 14, color: "#666666", marginBottom: 24 },
  
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
  card: {
    width: CARD_SIZE, height: CARD_SIZE * 0.95, backgroundColor: "#FFFFFF",
    borderRadius: 12, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#E0E0E0", position: "relative",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardSelected: { borderWidth: 2, borderColor: "#004B2B", backgroundColor: "#F2F7F5" },
  checkBadge: {
    position: "absolute", top: 10, right: 10, width: 20, height: 20,
    borderRadius: 10, backgroundColor: "#004B2B", justifyContent: "center", alignItems: "center",
  },
  cardLabel: { fontSize: 13, fontWeight: "600", color: "#1A1A1A", textAlign: "center", paddingHorizontal: 8 },
  cardLabelSelected: { color: "#004B2B" },
  
  otherLink: { alignItems: "center", marginTop: 32 },
  otherLinkText: { fontSize: 14, color: "#004B2B", fontWeight: "bold", textDecorationLine: "underline" },
  
  bottomArea: { paddingHorizontal: 24, paddingVertical: 20, backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E0E0E0" },
  confirmButton: { backgroundColor: "#004B2B", borderRadius: 12, height: 54, justifyContent: "center", alignItems: "center" },
  confirmButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
});