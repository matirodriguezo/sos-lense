import { useState, useEffect, useMemo } from "react";
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
import { useTheme } from "../../context/ThemeContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons } from "@expo/vector-icons";
export default function CloseIncidentScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [observations, setObservations] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const unsub = listenIncidentById(incidentId, setIncident);
    return unsub;
  }, [incidentId]);

  const handleClose = async () => {
    if (!reason.trim()) {
      Alert.alert("Motivo requerido", "Indique el resultado del procedimiento.");
      return;
    }

    Alert.alert(
      "Confirmar cierre",
      "¿Estás seguro de cerrar este caso? Esta acción es irreversible.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, cerrar caso",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await closeIncident(incidentId, observations.trim(), reason.trim());
              await sendMessage(
                incidentId,
                `[CERRADO] INCIDENTE CERRADO. Resolución: ${reason.trim()}`,
                auth.currentUser.uid,
                "OFFICER"
              );
              
              navigation.reset({ index: 0, routes: [{ name: "DispatchPanel" }] });
            } catch {
              Alert.alert("Error", "No se pudo archivar el caso.");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!incident) return null;

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.drawerHeaderBg} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
      
      {/* Header */}
      <View style={[s.header, { backgroundColor: colors.drawerHeaderBg }]}>
        <View style={[s.headerIconBox, { backgroundColor: colors.whiteTranslucent }]}><Ionicons name="document-text" size={24} color={colors.gold} /></View>
        <View style={s.headerTexts}>
            <Text style={[s.headerSub, { color: colors.gold }]}>Caso #{incidentId.slice(0, 8).toUpperCase()}</Text>
            <Text style={[s.headerTitle, { color: colors.white }]}>Clasificación Final</Text>
        </View>
      </View>
      <View style={[s.headerFooter, { backgroundColor: colors.drawerHeaderBg }]}><Text style={[s.headerFooterText, { color: colors.success }]}>Complete el reporte para archivar el caso</Text></View>

        {/* Resumen */}
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.cardTitle, { color: colors.textSecondary }]}>RESUMEN DEL CASO</Text>
          <View style={s.grid}>
            <View style={s.gridItem}>
                <Text style={[s.gridLabel, { color: colors.textSecondary }]}>Tipo</Text>
                <View style={s.row}><View style={[s.dot, { backgroundColor: colors.danger }]}/><Text style={[s.gridValue, { color: colors.textPrimary }]}>{incident.type}</Text></View>
            </View>
            <View style={s.gridItem}>
                <Text style={[s.gridLabel, { color: colors.textSecondary }]}>Ciudadano</Text>
                <Text style={[s.gridValue, { color: colors.textPrimary }]}>Usuario LENSE</Text>
            </View>
            <View style={s.gridItem}>
                <Text style={[s.gridLabel, { color: colors.textSecondary }]}>Ubicación</Text>
                <Text style={[s.gridValue, { color: colors.textPrimary }]}>{incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <Text style={[s.inputLabel, { color: colors.textPrimary }]}>RESULTADO DEL PROCEDIMIENTO *</Text>
        <View style={[s.pickerFake, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <TextInput 
                style={[s.inputText, { color: colors.textPrimary }]}
                value={reason}
                onChangeText={setReason}
                placeholder="Ej: Resuelto, Derivado a unidad, Falsa alarma..."
                placeholderTextColor={colors.textSecondary}
            />
        </View>

        <Text style={[s.inputLabel, { color: colors.textPrimary }]}>OBSERVACIONES DEL OFICIAL</Text>
        <View style={[s.textAreaBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <TextInput
                style={[s.textArea, { color: colors.textPrimary }]}
                value={observations}
                onChangeText={setObservations}
                placeholder="Describa el desarrollo del procedimiento, medidas tomadas y resultado final..."
                placeholderTextColor={colors.textSecondary}
                multiline
                textAlignVertical="top"
            />
        </View>

        {/* Warning & Submit */}
        <View style={s.footerArea}>
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: colors.primary }, loading && {opacity: 0.5}]} onPress={handleClose} disabled={loading} activeOpacity={0.7}>
                <Text style={[s.submitBtnText, { color: colors.white }]}>{loading ? "Archivando..." : "Guardar y Cerrar Caso"}</Text>
            </TouchableOpacity>
            
            <View style={[s.warningBox, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}>
                <Ionicons name="warning" size={20} color={colors.warningAmber} />
                <Text style={s.warningText}>Esta acción es irreversible. El caso será archivado y enviado al registro institucional.</Text>
            </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
    header: { flexDirection: "row", alignItems: "center", padding: SPACING.lg, paddingTop: 30 },
    headerIconBox: { width: 44, height: 44, borderRadius: RADIUS.sm, justifyContent: "center", alignItems: "center", marginRight: SPACING.md },
    headerSub: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },
    headerTitle: { fontSize: FONT_SIZE.xl, fontWeight: "900" },
    headerTexts: { flex: 1 },
    headerFooter: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg },
    headerFooterText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold },
    
    card: { borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, borderWidth: 1, shadowColor: colors.textPrimary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
    cardTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 1, marginBottom: SPACING.md },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACING.lg },
    gridItem: { width: "50%" },
    gridLabel: { fontSize: FONT_SIZE.xxs, marginBottom: SPACING.xxs },
    gridValue: { fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.bold },
    row: { flexDirection: "row", alignItems: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.xs },
    
    inputLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5, marginBottom: SPACING.sm },
    pickerFake: { borderRadius: RADIUS.sm, borderWidth: 1, paddingHorizontal: SPACING.md, height: 50, justifyContent: "center", marginBottom: SPACING.lg },
    inputText: { fontSize: FONT_SIZE.base, includeFontPadding: false },
    textAreaBox: { borderRadius: RADIUS.sm, borderWidth: 1, padding: SPACING.md, height: 120 },
    textArea: { flex: 1, fontSize: FONT_SIZE.base, lineHeight: 20 },
    
    footerArea: { marginTop: "auto", marginBottom: SPACING.lg },
    submitBtn: { borderRadius: RADIUS.md, height: 56, justifyContent: "center", alignItems: "center", marginBottom: SPACING.md },
    submitBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    
    warningBox: { flexDirection: "row", borderRadius: RADIUS.sm, padding: SPACING.md, borderWidth: 1, alignItems: "center" },
    warningText: { flex: 1, fontSize: FONT_SIZE.xs, color: colors.warningAmber, marginLeft: SPACING.sm, lineHeight: 16 },
  });
