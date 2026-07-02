import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { ROLES } from "../../constants/roles";
import { useTheme } from "../../context/ThemeContext";
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
export default function OfficerLoginScreen({ navigation }) {
  const { colors } = useTheme();
  const [rut, setRut] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const s = useMemo(() => makeStyles(colors), [colors]);

  const buildEmail = () =>
    rut.includes("@") ? rut : `${rut.replace(/[.\-]/g, "")}@carabineros.cl`;

  const handleLogin = async () => {
    if (!rut || !password) {
      Alert.alert("Error", "Ingresa tu RUT/Placa y Contraseña");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, buildEmail(), password);
    } catch (e) {
      Alert.alert("Error de inicio de sesión", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!rut || !password || !alias) {
      Alert.alert("Error", "Completa todos los campos (placa, nombre/grado y contraseña)");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, buildEmail(), password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: buildEmail(),
        role: ROLES.OFFICER,
        rut: rut || "",
        alias: alias.trim(),
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Cuenta creada", "Acceso habilitado para personal autorizado");
    } catch (e) {
      Alert.alert("Error al registrarse", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.drawerHeaderBg }]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          
          {/* Header & Brand */}
          <View style={s.brandSection}>
            <View style={s.logoCircle}>
              <MaterialCommunityIcons name="star-circle" size={50} color={colors.gold} />
            </View>
            <Text style={[s.republicText, { color: colors.whiteTranslucent }]}>REPÚBLICA DE CHILE</Text>
            <Text style={s.welcomeTitle}>S.O.S. CARABINEROS</Text>
            <View style={s.divider} />
            <Text style={[s.portalText, { color: colors.gold }]}>PORTAL DE OPERADORES</Text>
          </View>

          {/* Form Card Overlay */}
          <View style={[s.cardContainer, { backgroundColor: colors.surface }]}>
            <Text style={[s.inputLabelInside, { color: colors.labelGray }]}>NÚMERO DE PLACA / RUT</Text>
            <View style={[s.inputWrapper, { borderColor: colors.border }]}>
              <TextInput
                style={[s.inputFieldFlex, { color: colors.textPrimary }]}
                placeholder="Ej: 12.345.678-9"
                placeholderTextColor={colors.textSecondary}
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
              />
            </View>

            {isRegistering && (
              <>
                <Text style={[s.inputLabelInside, { color: colors.labelGray }]}>GRADO Y NOMBRE / ALIAS</Text>
                <View style={[s.inputWrapper, { borderColor: colors.border }]}>
                  <TextInput
                    style={[s.inputFieldFlex, { color: colors.textPrimary }]}
                    placeholder="Ej: Cabo 1ro José Martínez"
                    placeholderTextColor={colors.textSecondary}
                    value={alias}
                    onChangeText={setAlias}
                    autoCapitalize="words"
                  />
                </View>
              </>
            )}

            <Text style={[s.inputLabelInside, { color: colors.labelGray }]}>
              {isRegistering ? "CREAR CONTRASEÑA" : "CONTRASEÑA DE SISTEMA"}
            </Text>
            <View style={[s.inputWrapper, { borderColor: colors.border }]}>
              <TextInput
                style={[s.inputFieldFlex, { color: colors.textPrimary }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {isRegistering && (
              <>
                <Text style={[s.inputLabelInside, { color: colors.labelGray }]}>CONFIRMAR CONTRASEÑA</Text>
                <View style={[s.inputWrapper, { borderColor: colors.border }]}>
                  <TextInput
                    style={[s.inputFieldFlex, { color: colors.textPrimary }]}
                    placeholder="Repite la contraseña"
                    placeholderTextColor={colors.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </>
            )}

            {!isRegistering && (
              <View style={s.checkboxRow}>
                <Ionicons name="square-outline" size={20} color={colors.textSecondary} />
                <Text style={[s.checkboxText, { color: colors.textSecondary }]}>Mantener sesión activa en turno</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.primaryButton, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={s.primaryButtonText}>
                {loading ? "Verificando..." : isRegistering ? "Registrar Personal" : "Iniciar Turno"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (isRegistering) {
                  Alert.alert("Cancelar registro", "¿Estás seguro de cancelar el registro?", [
                    { text: "Seguir registrando", style: "cancel" },
                    { text: "Cancelar registro", onPress: () => setIsRegistering(false) },
                  ]);
                } else {
                  Alert.alert("Nuevo operador", "¿Eres personal autorizado de Carabineros para registrarte?", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Sí, registrarme", onPress: () => setIsRegistering(true) },
                  ]);
                }
              }}
              style={s.switchLink}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
               <Text style={[s.switchLinkText, { color: colors.textSecondary }]}>{isRegistering ? "Cancelar registro" : "¿Nuevo operador? Regístrate"}</Text>
            </TouchableOpacity>

            <View style={s.footerInfoRow}>
              <MaterialCommunityIcons name="shield-outline" size={16} color={colors.textSecondary} />
              <Text style={[s.footerInfoText, { color: colors.textSecondary }]}>Sistema LENSE — Acceso Restringido</Text>
            </View>
          </View>

          {/* Back to Citizen Flow */}
          <TouchableOpacity
            style={s.backToCitizen}
            onPress={() => Alert.alert("Volver", "¿Deseas regresar al portal ciudadano?", [
              { text: "Cancelar", style: "cancel" },
              { text: "Volver", onPress: () => navigation.goBack() },
            ])}
            hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
          >
            <Ionicons name="arrow-back" size={18} color={colors.gold} />
            <Text style={[s.backToCitizenText, { color: colors.gold }]}>Volver a portal ciudadano</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    safeArea: { flex: 1 },
    flex: { flex: 1 },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.lg,
    },
    brandSection: { alignItems: "center", marginBottom: SPACING.xl },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: colors.gold,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.md,
    },
    republicText: { fontSize: FONT_SIZE.xs, letterSpacing: 2, fontWeight: FONT_WEIGHT.semiBold, marginBottom: SPACING.xs },
    welcomeTitle: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: "900",
      color: colors.white,
      letterSpacing: 1,
    },
    divider: {
      width: 40,
      height: 3,
      backgroundColor: colors.gold,
      marginVertical: SPACING.sm,
    },
    portalText: { fontSize: FONT_SIZE.base, letterSpacing: 2, fontWeight: FONT_WEIGHT.bold },
    
    cardContainer: {
      borderRadius: RADIUS.xl,
      padding: SPACING.lg,
      elevation: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    inputLabelInside: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.bold,
      marginBottom: SPACING.sm,
      letterSpacing: 0.5,
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: RADIUS.sm,
      paddingHorizontal: SPACING.md,
      height: 50,
      marginBottom: SPACING.lg,
    },
    inputFieldFlex: {
      fontSize: FONT_SIZE.md,
      flex: 1,
      height: "100%",
      includeFontPadding: false,
    },
    checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: SPACING.lg },
    checkboxText: { fontSize: FONT_SIZE.base, marginLeft: SPACING.sm },
    
    primaryButton: {
      borderRadius: RADIUS.md,
      height: 54,
      justifyContent: "center",
      alignItems: "center",
    },
    primaryButtonText: { color: colors.white, fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold },
    
    switchLink: { marginTop: SPACING.md, alignSelf: "center" },
    switchLinkText: { fontSize: FONT_SIZE.base },
    
    footerInfoRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: SPACING.xl,
    },
    footerInfoText: { fontSize: FONT_SIZE.xs, marginLeft: SPACING.xs },
    
    backToCitizen: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: SPACING.xl,
    },
    backToCitizenText: { fontSize: FONT_SIZE.base, marginLeft: SPACING.sm, fontWeight: FONT_WEIGHT.semiBold },
  });
