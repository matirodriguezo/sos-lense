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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listenIncidentById, closeIncident, sendMessage } from "../../services/incidentService";
import { auth } from "../../firebase/firebaseConfig";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navbarBg} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      
      {/* Header Institucional */}
      <View style={styles.header}>
        <View style={styles.headerIconBox}><Ionicons name="document-text" size={24} color="#D4AF37" /></View>
        <View style={styles.headerTexts}>
            <Text style={styles.headerSub}>Caso #{incidentId.slice(0, 8).toUpperCase()}</Text>
            <Text style={styles.headerTitle}>Clasificación Final</Text>
        </View>
      </View>
      <View style={styles.headerFooter}><Text style={styles.headerFooterText}>Complete el reporte para archivar el caso</Text></View>

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
                placeholderTextColor={COLORS.textSecondary}
            />
        </View>

        <Text style={styles.inputLabel}>OBSERVACIONES DEL OFICIAL</Text>
        <View style={styles.textAreaBox}>
            <TextInput
                style={styles.textArea}
                value={observations}
                onChangeText={setObservations}
                placeholder="Describa el desarrollo del procedimiento, medidas tomadas y resultado final..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                textAlignVertical="top"
            />
        </View>

        {/* Warning & Submit */}
        <View style={styles.footerArea}>
            <TouchableOpacity style={[styles.submitBtn, loading && {opacity: 0.5}]} onPress={handleClose} disabled={loading} activeOpacity={0.7}>
                <Text style={styles.submitBtnText}>{loading ? "Archivando..." : "Guardar y Cerrar Caso"}</Text>
            </TouchableOpacity>
            
            <View style={styles.warningBox}>
                <Ionicons name="warning" size={20} color="#B45309" />
                <Text style={styles.warningText}>Esta acción es irreversible. El caso será archivado y enviado al registro institucional.</Text>
            </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  header: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.navbarBg, padding: SPACING.lg, paddingTop: 30 },
  headerIconBox: { width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.whiteTranslucent, justifyContent: "center", alignItems: "center", marginRight: SPACING.md },
  headerSub: { color: COLORS.textSecondary, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
  headerTitle: { color: "#FFFFFF", fontSize: FONT_SIZE.xl, fontWeight: "900" },
  headerTexts: { flex: 1 },
  headerFooter: { backgroundColor: COLORS.navbarBg, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
  headerFooterText: { color: COLORS.success, fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold },
  
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, ...SHADOWS.card },
  cardTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.textSecondary, letterSpacing: 1, marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACING.lg },
  gridItem: { width: "50%" },
  gridLabel: { fontSize: FONT_SIZE.xxs, color: COLORS.textSecondary, marginBottom: SPACING.xxs },
  gridValue: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary },
  row: { flexDirection: "row", alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger, marginRight: SPACING.xs },
  
  inputLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, letterSpacing: 0.5, marginBottom: SPACING.sm },
  pickerFake: { backgroundColor: COLORS.inputBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, height: 50, justifyContent: "center", marginBottom: SPACING.lg },
  inputText: { fontSize: FONT_SIZE.base, color: COLORS.textPrimary, includeFontPadding: false },
  textAreaBox: { backgroundColor: COLORS.inputBg, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, height: 120 },
  textArea: { flex: 1, fontSize: FONT_SIZE.base, color: COLORS.textPrimary, lineHeight: 20 },
  
  footerArea: { marginTop: "auto", marginBottom: SPACING.lg },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 56, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
  submitBtnText: { color: "#FFFFFF", fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
  
  warningBox: { flexDirection: "row", backgroundColor: "#FFFBEB", borderRadius: RADIUS.sm, padding: SPACING.md, borderWidth: 1, borderColor: "#FEF08A", alignItems: "center" },
  warningText: { flex: 1, fontSize: FONT_SIZE.xs, color: "#B45309", marginLeft: SPACING.sm, lineHeight: 16 },
});