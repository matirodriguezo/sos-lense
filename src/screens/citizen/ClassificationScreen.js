import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_SIZE = (width - SPACING.lg * 2 - SPACING.md) / 2;

const INCIDENT_OPTIONS = [
  { id: "ACCIDENTE", icon: "🚗💥", label: "Accidente de Tránsito" },
  { id: "ROBO", icon: "🦹", label: "Robo o Asalto" },
  { id: "VIOLENCIA", icon: "⚔️", label: "Violencia Intrafamiliar" },
  { id: "OTRO", icon: "⚠️", label: "Otro Incidente" },
];

export default function ClassificationScreen({ route, navigation }) {
  const { incidentId } = route.params;
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  const classifyAndNavigate = async (id) => {
    setSelected(id);
    setSubmitting(true);
    setToastVisible(true);

    try {
      await updateDoc(doc(db, "incidents", incidentId), {
        type: id,
        status: "ACTIVO",
        updatedAt: new Date().toISOString(),
      });

      setTimeout(() => {
        setToastVisible(false);
        navigation.replace("VideoCall", { incidentId });
      }, 1500);
    } catch {
      setSubmitting(false);
      setToastVisible(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.stepText}>CLASIFICAR</Text>
        <Text style={styles.sosLabel}>S.O.S.</Text>
      </View>

      <View style={styles.content}>
        <View style={[styles.lenseMini, SHADOWS.lenseCard]}>
          <View style={styles.lenseInner}>
            <TouchableOpacity style={styles.playMini}>
              <Text style={styles.playMiniIcon}>▶</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.lenseTag}>
            <Text style={styles.lenseTagText}>Instrucciones LENSE</Text>
          </View>
        </View>

        <Text style={styles.questionTitle}>¿Qué pasó?</Text>
        <Text style={styles.questionSub}>
          Selecciona el tipo de emergencia para recibir la ayuda adecuada.
        </Text>

        <View style={styles.grid}>
          {INCIDENT_OPTIONS.map((item) => {
            const isSelected = selected === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.card, SHADOWS.card, isSelected && styles.cardSelected]}
                onPress={() => classifyAndNavigate(item.id)}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkIcon}>✔</Text>
                  </View>
                )}
                <Text style={styles.cardIcon}>{item.icon}</Text>
                <Text style={[styles.cardLabel, isSelected && styles.cardLabelSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.otherLink}
          onPress={() => classifyAndNavigate("OTRO")}
          disabled={submitting}
        >
          <Text style={styles.otherLinkText}>Otros motivos</Text>
        </TouchableOpacity>
      </View>

      {toastVisible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>✔ Alerta enviada a la central</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  navbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md - 4, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.background,
    justifyContent: "center", alignItems: "center",
  },
  closeIcon: { fontSize: 18, color: COLORS.textPrimary, fontWeight: FONT_WEIGHT.bold },
  stepText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: COLORS.textSecondary, letterSpacing: 1 },
  sosLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold, color: COLORS.primary },
  content: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  lenseMini: {
    width: "100%", height: (width - SPACING.lg * 2) * 0.45,
    borderRadius: RADIUS.md, backgroundColor: COLORS.lenseCard,
    overflow: "hidden", position: "relative", marginBottom: SPACING.lg,
  },
  lenseInner: { flex: 1, justifyContent: "center", alignItems: "center" },
  playMini: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.greenTranslucent,
    justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  playMiniIcon: { fontSize: 18, color: COLORS.surface, marginLeft: 2 },
  lenseTag: {
    position: "absolute", bottom: SPACING.sm, left: SPACING.sm,
    backgroundColor: COLORS.blackTranslucent, paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs, borderRadius: RADIUS.xs,
  },
  lenseTagText: { color: COLORS.surface, fontSize: FONT_SIZE.xxs, fontWeight: FONT_WEIGHT.medium },
  questionTitle: { fontSize: FONT_SIZE.xl, fontWeight: FONT_WEIGHT.bold, color: COLORS.textPrimary, marginBottom: SPACING.xs },
  questionSub: { fontSize: FONT_SIZE.sm, color: COLORS.textSecondary, lineHeight: 20, marginBottom: SPACING.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md },
  card: {
    width: CARD_SIZE, height: CARD_SIZE * 0.9, backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, position: "relative",
  },
  cardSelected: { borderWidth: 3, borderColor: COLORS.primary },
  checkBadge: {
    position: "absolute", top: SPACING.sm, right: SPACING.sm,
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.primary,
    justifyContent: "center", alignItems: "center",
  },
  checkIcon: { color: COLORS.surface, fontSize: 12, fontWeight: FONT_WEIGHT.bold },
  cardIcon: { fontSize: 36, marginBottom: SPACING.sm + 2 },
  cardLabel: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.semiBold, color: COLORS.textPrimary, textAlign: "center", paddingHorizontal: SPACING.xs },
  cardLabelSelected: { color: COLORS.primary },
  otherLink: { alignItems: "center", marginTop: SPACING.lg },
  otherLinkText: { fontSize: FONT_SIZE.sm, color: COLORS.primary, fontWeight: FONT_WEIGHT.semiBold, textDecorationLine: "underline" },
  toast: {
    position: "absolute", bottom: SPACING.xl, left: SPACING.lg, right: SPACING.lg,
    backgroundColor: "#111", borderRadius: RADIUS.sm, paddingVertical: SPACING.md - 4,
    alignItems: "center",
  },
  toastText: { color: COLORS.surface, fontSize: FONT_SIZE.base, fontWeight: FONT_WEIGHT.medium },
});
