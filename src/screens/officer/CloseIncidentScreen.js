import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listenIncidentById, closeIncident, sendMessage } from "../../services/incidentService";
import { auth } from "../../firebase/firebaseConfig";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function CloseIncidentScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [observations, setObservations] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = listenIncidentById(incidentId, setIncident);
    return unsub;
  }, [incidentId]);

  const handleClose = async () => {
    if (!reason.trim()) {
      Alert.alert("Motivo requerido", "Indique el resultado del procedimiento.");
      return;
    }

    setLoading(true);
    try {
      await closeIncident(incidentId, observations.trim(), reason.trim());
      await sendMessage(
        incidentId,
        `🔴 INCIDENTE CERRADO. Resolución: ${reason.trim()}`,
        auth.currentUser.uid,
        "OFFICER"
      );
      
      navigation.reset({ index: 0, routes: [{ name: "DispatchPanel" }] });
    } catch {
      Alert.alert("Error", "No se pudo archivar el caso.");
      setLoading(false);
    }
  };

  if (!incident) return null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#003A20" />
      
      {/* Header Institucional */}
      <View style={styles.header}>
        <View style={styles.headerIconBox}><Ionicons name="document-text" size={24} color="#D4AF37" /></View>
        <View style={styles.headerTexts}>
            <Text style={styles.headerSub}>Caso #{incidentId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.headerTitle}>Clasificación Final</Text>
        </View>
      </View>
      <View style={styles.headerFooter}><Text style={styles.headerFooterText}>Complete el reporte para archivar el caso</Text></View>

      <View style={styles.content}>
        {/* Resumen */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RESUMEN DEL CASO</Text>
          <View style={styles.grid}>
            <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Tipo</Text>
                <View style={styles.row}><View style={styles.dot}/> <Text style={styles.gridValue}>{incident.type}</Text></View>
            </View>
            <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Ciudadano</Text>
                <Text style={styles.gridValue}>Usuario LENSE</Text>
            </View>
            <View style={styles.gridItem}>
                <Text style={styles.gridLabel}>Ubicación</Text>
                <Text style={styles.gridValue}>{incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}</Text>
            </View>
          </View>
        </View>

        {/* Formulario */}
        <Text style={styles.inputLabel}>RESULTADO DEL PROCEDIMIENTO *</Text>
        <View style={styles.pickerFake}>
            <TextInput 
                style={styles.inputText}
                value={reason}
                onChangeText={setReason}
                placeholder="Ej: Resuelto, Derivado a unidad, Falsa alarma..."
                placeholderTextColor="#A0A0A0"
            />
        </View>

        <Text style={styles.inputLabel}>OBSERVACIONES DEL OFICIAL</Text>
        <View style={styles.textAreaBox}>
            <TextInput
                style={styles.textArea}
                value={observations}
                onChangeText={setObservations}
                placeholder="Describa el desarrollo del procedimiento, medidas tomadas y resultado final..."
                placeholderTextColor="#A0A0A0"
                multiline
                textAlignVertical="top"
            />
        </View>

        {/* Warning & Submit */}
        <View style={{marginTop: 'auto', marginBottom: 20}}>
            <TouchableOpacity style={[styles.submitBtn, loading && {opacity: 0.7}]} onPress={handleClose} disabled={loading}>
                <Text style={styles.submitBtnText}>{loading ? "Archivando..." : "Guardar y Cerrar Caso"}</Text>
            </TouchableOpacity>
            
            <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color="#B45309" />
                <Text style={styles.warningText}>Esta acción es irreversible. El caso será archivado y enviado al registro institucional.</Text>
            </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6F8" },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: "#003A20", padding: 20, paddingTop: 30 },
  headerIconBox: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center", marginRight: 16 },
  headerSub: { color: "#A0A0A0", fontSize: 12, fontWeight: "bold" },
  headerTitle: { color: "#FFFFFF", fontSize: 22, fontWeight: "900" },
  headerFooter: { backgroundColor: "#003A20", paddingHorizontal: 20, paddingBottom: 20 },
  headerFooterText: { color: "#4CAF50", fontSize: 13, fontWeight: "600" },
  
  content: { flex: 1, padding: 20 },
  
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, marginBottom: 24, elevation: 2, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.05, shadowRadius: 4 },
  cardTitle: { fontSize: 12, fontWeight: "bold", color: "#A0A0A0", letterSpacing: 1, marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 20 },
  gridItem: { width: "50%" },
  gridLabel: { fontSize: 11, color: "#666666", marginBottom: 4 },
  gridValue: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A" },
  row: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#D32F2F", marginRight: 6 },
  
  inputLabel: { fontSize: 12, fontWeight: "bold", color: "#1A1A1A", letterSpacing: 0.5, marginBottom: 8 },
  pickerFake: { backgroundColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, borderColor: "#E0E0E0", paddingHorizontal: 16, height: 50, justifyContent: "center", marginBottom: 20 },
  inputText: { fontSize: 14, color: "#1A1A1A" },
  textAreaBox: { backgroundColor: "#FFFFFF", borderRadius: 8, borderWidth: 1, borderColor: "#E0E0E0", padding: 16, height: 120 },
  textArea: { flex: 1, fontSize: 14, color: "#1A1A1A", lineHeight: 20 },
  
  submitBtn: { backgroundColor: "#004B2B", borderRadius: 12, height: 56, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  submitBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  
  warningBox: { flexDirection: "row", backgroundColor: "#FFFBEB", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#FEF08A", alignItems: "center" },
  warningText: { flex: 1, fontSize: 12, color: "#B45309", marginLeft: 12, lineHeight: 16 },
});