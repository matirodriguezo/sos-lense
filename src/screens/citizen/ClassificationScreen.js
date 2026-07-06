import { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { cancelIncident, getIncident, updateParticipantStatus, CITIZEN_STATUS, updateCommunicationMode, COMM_MODE } from "../../services/incidentService";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
const INCIDENT_OPTIONS = [
  { id: "ACCIDENTE", icon: "car-outline", label: "Accidente de Tránsito", gifPath: require("../../../assets/gifs/Accidente de transito.gif") },
  { id: "ROBO", icon: "shield-half-outline", label: "Robo o Asalto", gifPath: require("../../../assets/gifs/Robo o Asalto.gif") },
  { id: "VIOLENCIA", icon: "home-outline", label: "Violencia Intrafamiliar", gifPath: require("../../../assets/gifs/Violencia.gif") },
  { id: "MEDICA", icon: "pulse-outline", label: "Emergencia Médica", gifPath: require("../../../assets/gifs/Emergencia Medica.gif") },
];

export default function ClassificationScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { incidentId } = route.params;
  const [selected, setSelected] = useState(null);
  const [restored, setRestored] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const insets = useSafeAreaInsets();

  const [loadedCount, setLoadedCount] = useState(0);
  const numGifs = INCIDENT_OPTIONS.filter((opt) => opt.gifPath).length;
  const allGifsReady = loadedCount >= numGifs;

  const s = useMemo(() => makeStyles(colors, insets), [colors, insets]);

  useFocusEffect(
    useCallback(() => {
      updateParticipantStatus(incidentId, "CITIZEN", CITIZEN_STATUS.CLASSIFYING).catch(() => {});
    }, [incidentId])
  );

  useEffect(() => {
    (async () => {
      const incident = await getIncident(incidentId);
      if (incident?.type && incident.type !== "Por definir") {
        setSelected(incident.type);
        setRestored(true);
        console.log("[Classification] Pre-selected type:", incident.type);
      }
    })();
  }, [incidentId]);

  const selectCategory = async (id) => {
    setSelected(id);
    setRestored(false);
    console.log("[Classification] Selected type:", id, "incident:", incidentId);

    try {
      await updateDoc(doc(db, "incidents", incidentId), {
        type: id,
        status: "ACTIVO",
        updatedAt: new Date().toISOString(),
      });
    } catch {
      Alert.alert("Error", "No se pudo actualizar el tipo de emergencia.");
    }
  };

  const handleOpenCancel = () => {
    setCancelReason("");
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      Alert.alert("Motivo requerido", "Por favor indica el motivo de la anulación.");
      return;
    }
    Alert.alert("Confirmar anulación", `¿Estás seguro de anular este incidente?\n\nMotivo: ${cancelReason.trim()}`, [
      { text: "Seguir reportando", style: "cancel" },
      {
        text: "Anular incidente",
        style: "destructive",
        onPress: async () => {
          try {
            await cancelIncident(incidentId, cancelReason.trim());
            setShowCancelModal(false);
            navigation.reset({ index: 0, routes: [{ name: "Home" }] });
          } catch (e) {
            Alert.alert("Error", "No se pudo anular el incidente.");
          }
        },
      },
    ]);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleVideoCall = () => {
    if (!selected) {
      Alert.alert("Selecciona un tipo", "Primero debes clasificar tu emergencia para continuar.");
      return;
    }
    updateCommunicationMode(incidentId, COMM_MODE.VIDEO_CALL).catch(() => {});
    navigation.navigate("VideoCall", { incidentId });
  };

  const handleChatOnly = () => {
    if (!selected) {
      Alert.alert("Selecciona un tipo", "Primero debes clasificar tu emergencia para continuar.");
      return;
    }
    updateCommunicationMode(incidentId, COMM_MODE.CHAT_ONLY).catch(() => {});
    navigation.navigate("VideoCall", { incidentId, chatOnly: true });
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.headerBg} />

      {!allGifsReady && (
        <View style={{ position: "absolute", opacity: 0 }}>
          {INCIDENT_OPTIONS.map((item) =>
            item.gifPath ? (
              <Image
                key={`preload-${item.id}`}
                source={item.gifPath}
                onLoad={() => setLoadedCount((c) => c + 1)}
              />
            ) : null
          )}
        </View>
      )}

      {/* Navbar */}
      <View style={[s.navbar, { backgroundColor: colors.headerBg, height: insets.top + 32 }]}>
        <TouchableOpacity style={s.backButton} onPress={handleGoBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={s.content}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>
          <Text style={[s.questionTitle, { color: colors.textPrimary }]}>¿Qué pasó?</Text>
          <Text style={[s.questionSub, { color: colors.textSecondary }]}>
            Seleccione la categoría de su emergencia
          </Text>
          {restored && (
            <View style={[s.restoredHint, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
              <Ionicons name="refresh" size={12} color={colors.primary} />
              <Text style={[s.restoredHintText, { color: colors.primary }]}>Se ha restaurado tu última selección</Text>
            </View>
          )}

          {/* 2x2 Grid */}
          <View style={s.grid}>
            {INCIDENT_OPTIONS.map((item) => {
              const isSelected = selected === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    s.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    isSelected && { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.greenTranslucent },
                  ]}
                  onPress={() => selectCategory(item.id)}
                  disabled={false}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={[s.checkBadge, { backgroundColor: colors.primary }]}>
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    </View>
                  )}
                  {item.gifPath ? (
                    allGifsReady ? (
                      <Image 
                        source={item.gifPath}
                        style={s.gifIcon}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={s.gifIconLoader}>
                        <ActivityIndicator color={colors.primary} />
                      </View>
                    )
                  ) : (
                    <Ionicons 
                      name={item.icon} 
                      size={42} 
                      color={isSelected ? colors.primary : colors.iconMuted}
                      style={{ marginBottom: 12 }} 
                    />
                  )}
                  <Text style={[s.cardLabel, { color: colors.textPrimary }, isSelected && { color: colors.primary }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[
              s.otherCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selected === "OTRO" && { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.greenTranslucent },
            ]}
            onPress={() => selectCategory("OTRO")}
            activeOpacity={0.7}
          >
            {selected === "OTRO" && (
              <View style={[s.otherCheckBadge, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={14} color={colors.white} />
              </View>
            )}
            <Ionicons name="help-circle-outline" size={24} color={selected === "OTRO" ? colors.primary : colors.iconMuted} />
            <Text style={[s.otherCardText, { color: colors.textPrimary }, selected === "OTRO" && { color: colors.primary }]}>
              No sé / Otro tipo de emergencia
            </Text>
          </TouchableOpacity>

          {/* Direct options */}
          <View style={s.directSection}>
            <Text style={[s.directLabel, { color: colors.textSecondary }]}>O accede directamente a:</Text>

            <View style={s.directRow}>
              <TouchableOpacity
                style={[
                  s.directBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  !selected && { opacity: 0.45, borderColor: colors.iconMuted },
                ]}
                onPress={handleVideoCall}
                activeOpacity={0.8}
              >
                <View style={[s.directIconWrap, { backgroundColor: colors.primary + "20" }]}>
                  <Ionicons name="videocam" size={22} color={selected ? colors.primary : colors.iconMuted} />
                </View>
                <Text style={[s.directBtnLabel, { color: selected ? colors.textPrimary : colors.textSecondary }]}>Videollamada</Text>
                <Text style={[s.directBtnSub, { color: colors.textSecondary }]}>Con CENCO</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.directBtn,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  !selected && { opacity: 0.45, borderColor: colors.iconMuted },
                ]}
                onPress={handleChatOnly}
                activeOpacity={0.8}
              >
                <View style={[s.directIconWrap, { backgroundColor: colors.blueDispatch + "20" }]}>
                  <Ionicons name="chatbubbles" size={22} color={selected ? colors.blueDispatch : colors.iconMuted} />
                </View>
                <Text style={[s.directBtnLabel, { color: selected ? colors.textPrimary : colors.textSecondary }]}>Solo Chat</Text>
                <Text style={[s.directBtnSub, { color: colors.textSecondary }]}>Texto con CENCO</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Cancel + selected bar (pinned at bottom) */}
        <TouchableOpacity style={s.cancelLink} onPress={handleOpenCancel}>
          <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
          <Text style={[s.cancelLinkText, { color: colors.danger }]}>Anular este incidente</Text>
        </TouchableOpacity>

        {selected && (
          <View style={s.selectedBar}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[s.selectedBarText, { color: colors.success }]} numberOfLines={1}>
              {restored ? "Clasificación anterior — elige cómo comunicarte" : "Incidente clasificado — elige cómo comunicarte"}
            </Text>
          </View>
        )}
      </View>

      {/* Cancel modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Anular Incidente</Text>
            <Text style={[s.modalSub, { color: colors.textSecondary }]}>Indica el motivo de la anulación:</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textPrimary }]}
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Motivo de la anulación..."
              placeholderTextColor={colors.iconMuted}
              multiline
              textAlignVertical="top"
            />
            <View style={s.modalButtons}>
              <TouchableOpacity style={[s.modalCancelBtn, { borderColor: colors.border }]} onPress={() => setShowCancelModal(false)}>
                <Text style={[s.modalCancelText, { color: colors.textPrimary }]}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalConfirmBtn, { backgroundColor: colors.danger }]} onPress={handleConfirmCancel}>
                <Text style={s.modalConfirmText}>Anular Incidente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors, insets) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    navbar: {
      flexDirection: "row", alignItems: "flex-end",
      paddingHorizontal: 8, paddingBottom: 4,
    },
    backButton: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
    navTitle: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, marginLeft: 10 },
    
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom, 12) },
    scrollInner: { paddingBottom: 8 },
    
    questionTitle: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
    questionSub: { fontSize: 14, marginBottom: 24 },
    
    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 },
    card: {
      width: "47%", aspectRatio: 1.05,
      borderRadius: 12, justifyContent: "center", alignItems: "center",
      borderWidth: 1, position: "relative", padding: 10,
    },
    checkBadge: {
      position: "absolute", top: 10, right: 10, width: 20, height: 20,
      borderRadius: 10, justifyContent: "center", alignItems: "center",
      zIndex: 2,
    },
    gifIcon: {
      flex: 1, width: "100%", marginBottom: 8,
    },
    gifIconLoader: {
      flex: 1, width: "100%", marginBottom: 8, justifyContent: "center", alignItems: "center",
    },
    cardLabel: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingHorizontal: 4 },
    
    otherCard: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      marginTop: 24, paddingVertical: 14, paddingHorizontal: 20,
      borderRadius: 12, borderWidth: 1, gap: 8, position: "relative",
    },
    otherCheckBadge: {
      position: "absolute", top: 6, right: 6, width: 18, height: 18,
      borderRadius: 9, justifyContent: "center", alignItems: "center",
      zIndex: 2,
    },
    otherCardText: { fontSize: 14, fontWeight: "600" },

    restoredHint: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 6, paddingHorizontal: 12,
      borderRadius: 8, borderWidth: 1, marginBottom: 6,
    },
    restoredHintText: { fontSize: 11, fontWeight: "600" },

    directSection: { marginTop: 32, gap: 12 },
    directLabel: { fontSize: 12, fontWeight: "600", textAlign: "center", letterSpacing: 0.5 },
    directRow: { flexDirection: "row", gap: 12 },
    directBtn: {
      flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 12,
      borderRadius: 14, borderWidth: 1, gap: 8,
    },
    directIconWrap: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
    directBtnLabel: { fontSize: 14, fontWeight: "bold", textAlign: "center" },
    directBtnSub: { fontSize: 11, textAlign: "center" },

    cancelLink: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      paddingVertical: 8, gap: 6,
    },
    cancelLinkText: { fontSize: 13, fontWeight: "600" },

    selectedBar: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, paddingVertical: 10, paddingHorizontal: 20, paddingBottom: 6,
    },
    selectedBarText: { fontSize: 13, fontWeight: "600", flexShrink: 1 },

    modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
    modalContent: { borderRadius: 16, padding: 24, width: "85%", maxWidth: 400 },
    modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
    modalSub: { fontSize: 14, marginBottom: 16 },
    modalInput: { borderRadius: 10, padding: 16, fontSize: 14, borderWidth: 1, minHeight: 100 },
    modalButtons: { flexDirection: "row", gap: 12, marginTop: 20 },
    modalCancelBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center", borderWidth: 1 },
    modalCancelText: { fontWeight: "bold" },
    modalConfirmBtn: { flex: 1, height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center" },
    modalConfirmText: { color: "#fff", fontWeight: "bold" },
  });
