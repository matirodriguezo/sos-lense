import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listenIncidentById, closeIncident } from "../../services/incidentService";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

export default function CloseIncidentScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [incident, setIncident] = useState(null);
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = listenIncidentById(incidentId, setIncident);
    return unsub;
  }, [incidentId]);

  const handleClose = async () => {
    if (!observations.trim()) {
      Alert.alert(
        "Observaciones requeridas",
        "Debes escribir las observaciones antes de cerrar el incidente."
      );
      return;
    }

    setLoading(true);
    try {
      await closeIncident(incidentId, observations.trim());
      Alert.alert("Incidente Cerrado", "El incidente ha sido cerrado exitosamente.", [
        {
          text: "Volver al panel",
          onPress: () =>
            navigation.reset({
              index: 0,
              routes: [{ name: "DispatchPanel" }],
            }),
        },
      ]);
    } catch {
      Alert.alert("Error", "No se pudo cerrar el incidente.");
    } finally {
      setLoading(false);
    }
  };

  if (!incident) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Cerrar Incidente</Text>
          <Text style={styles.subtitle}>
            Revisa la información antes de cerrar
          </Text>
        </View>

        <View style={[styles.summaryCard, SHADOWS.card]}>
          <Text style={styles.summaryTitle}>Resumen del Incidente</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tipo</Text>
            <Text style={styles.summaryValue}>
              {incident.type || "Sin clasificar"}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Estado</Text>
            <Text style={styles.summaryValue}>{incident.status}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Ubicación</Text>
            <Text style={styles.summaryValue}>
              {incident.latitude?.toFixed(4)}, {incident.longitude?.toFixed(4)}
            </Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Observaciones del operador</Text>
          <TextInput
            style={styles.textArea}
            value={observations}
            onChangeText={setObservations}
            placeholder="Describe las acciones tomadas, resultados y cualquier información relevante..."
            placeholderTextColor={COLORS.textSecondary}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.closeButton, loading && styles.closeButtonDisabled]}
          onPress={handleClose}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.surface} />
          ) : (
            <Text style={styles.closeButtonText}>Confirmar Cierre</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerSection: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    ...SHADOWS.header,
  },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  summaryCard: {
    backgroundColor: COLORS.surface,
    margin: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  summaryLabel: { fontSize: FONT_SIZE.base, color: COLORS.textSecondary },
  summaryValue: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.semiBold,
  },
  formSection: { paddingHorizontal: SPACING.md, flex: 1, marginTop: SPACING.sm },
  formLabel: {
    fontSize: FONT_SIZE.base,
    fontWeight: FONT_WEIGHT.semiBold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  textArea: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.md,
    fontSize: FONT_SIZE.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 180,
    lineHeight: 22,
    color: COLORS.textPrimary,
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    height: 50,
    justifyContent: "center",
  },
  closeButtonDisabled: { opacity: 0.6 },
  closeButtonText: {
    color: COLORS.surface,
    fontWeight: FONT_WEIGHT.semiBold,
    fontSize: FONT_SIZE.md,
  },
});
