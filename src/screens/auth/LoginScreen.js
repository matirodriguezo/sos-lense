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
import { SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function LoginScreen({ navigation }) {
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
    rut.includes("@") ? rut : `${rut.replace(/[.\-]/g, "")}@ciudadano.sos.cl`;

  const handleLogin = async () => {
    if (!rut || !password) {
      Alert.alert("Error", "Ingresa tu RUT y Clave Única");
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
      Alert.alert("Error", "Completa todos los campos (RUT, nombre/alias y contraseña)");
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
        role: ROLES.CITIZEN,
        rut: rut || "",
        alias: alias.trim(),
        createdAt: new Date().toISOString(),
      });
      Alert.alert("Cuenta creada", "Bienvenido a S.O.S. Carabineros");
    } catch (e) {
      Alert.alert("Error al registrarse", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.brandSection}>
            <View style={[s.shieldContainer, { backgroundColor: colors.primary, ...SHADOWS.card }]}>
              <MaterialCommunityIcons name="shield-check" size={40} color={colors.white} />
              <Text style={s.shieldText}>CARABINEROS</Text>
              <Text style={s.shieldSubText}>DE CHILE</Text>
            </View>
            <Text style={[s.welcomeTitle, { color: colors.textPrimary }]}>Bienvenido</Text>
            <Text style={[s.welcomeSubtitle, { color: colors.textSecondary }]}>
              Plataforma de emergencia para la Comunidad Sorda
            </Text>
          </View>

          <View style={s.formSection}>
            <View style={[s.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[s.inputLabelInside, { color: colors.textSecondary }]}>RUT</Text>
              <TextInput
                style={[s.inputField, { color: colors.textPrimary }]}
                placeholder="Ej: 12.345.678-9"
                placeholderTextColor={colors.textSecondary}
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
              />
            </View>

            {isRegistering && (
              <View style={[s.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[s.inputLabelInside, { color: colors.textSecondary }]}>Nombre / Alias</Text>
                <TextInput
                  style={[s.inputField, { color: colors.textPrimary }]}
                  placeholder="Ej: Benjamin Muñoz"
                  placeholderTextColor={colors.textSecondary}
                  value={alias}
                  onChangeText={setAlias}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={[s.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[s.inputLabelInside, { color: colors.textSecondary }]}>
                {isRegistering ? "Crea una Contraseña" : "Clave Única"}
              </Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.inputFieldFlex, { color: colors.textPrimary }]}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                {!isRegistering && (
                  <TouchableOpacity
                    onPress={() => Alert.alert("Huella Digital", "¿Deseas usar tu huella digital para acceder?\n\n", [
                      { text: "Cancelar", style: "cancel" },
                      { text: "Usar huella", onPress: () => Alert.alert("Próximamente", "La autenticación biométrica estará disponible en una próxima actualización.") },
                    ])}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Autenticación biométrica"
                  >
                    <Ionicons name="finger-print-outline" size={22} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  </TouchableOpacity>
                )}
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
            </View>

            {isRegistering && (
              <View style={[s.inputWrapper, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Text style={[s.inputLabelInside, { color: colors.textSecondary }]}>Confirmar Contraseña</Text>
                <TextInput
                  style={[s.inputField, { color: colors.textPrimary }]}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            )}

            {!isRegistering && (
              <TouchableOpacity
                style={s.forgotLink}
                onPress={() => Alert.alert("Restablecer contraseña", "¿Necesitas ayuda con tu contraseña?\n\nContacta a Carabineros de Chile para restablecer tu acceso.", [
                  { text: "Entendido" },
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
              >
                <Text style={[s.forgotText, { color: colors.primary }]}>¿Olvidé mi contraseña?</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={s.footerSection}>
            <TouchableOpacity
              style={[s.primaryButton, { backgroundColor: colors.primary, ...SHADOWS.sos }, loading && { opacity: 0.6 }]}
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={s.primaryButtonText}>
                {loading ? "Procesando..." : isRegistering ? "Crear Cuenta" : "Ingresar con Clave Única"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.switchLink}
              onPress={() => {
                if (isRegistering) {
                  Alert.alert("Iniciar sesión", "¿Ya tienes una cuenta?", [
                    { text: "Seguir registrando", style: "cancel" },
                    { text: "Iniciar sesión", onPress: () => setIsRegistering(false) },
                  ]);
                } else {
                  Alert.alert("Registrarse", "¿No tienes cuenta? Vamos a crear una.", [
                    { text: "Cancelar", style: "cancel" },
                    { text: "Registrarme", onPress: () => setIsRegistering(true) },
                  ]);
                }
              }}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={[s.switchLinkText, { color: colors.primary }]}>
                {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
              </Text>
            </TouchableOpacity>

            <View style={s.switchMode}>
              <Text style={[s.wcagText, { color: colors.textSecondary }]}>
                Cumple con estándares de accesibilidad WCAG 2.1
              </Text>
            </View>

            <TouchableOpacity
              style={s.officerLink}
              onPress={() => Alert.alert("Acceso restringido", "¿Eres personal autorizado de Carabineros de Chile?", [
                { text: "Cancelar", style: "cancel" },
                { text: "Sí, continuar", onPress: () => navigation.navigate("OfficerLogin") },
              ])}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={[s.officerLinkText, { color: colors.primary }]}>Acceso Personal Carabineros</Text>
            </TouchableOpacity>
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
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xl,
    },
    brandSection: { alignItems: "center", marginBottom: SPACING.xl },
    shieldContainer: {
      width: 90,
      height: 100,
      borderBottomLeftRadius: 45,
      borderBottomRightRadius: 45,
      borderTopLeftRadius: RADIUS.sm,
      borderTopRightRadius: RADIUS.sm,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.lg,
    },
    shieldText: { color: colors.white, fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.xs },
    shieldSubText: { color: colors.white, fontSize: FONT_SIZE.xxs },
    welcomeTitle: {
      fontSize: FONT_SIZE.xxl,
      fontWeight: "800",
      marginBottom: SPACING.xs,
    },
    welcomeSubtitle: {
      fontSize: FONT_SIZE.base,
      textAlign: "center",
    },
    formSection: { width: "100%", marginBottom: SPACING.lg },
    inputWrapper: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.md,
    },
    inputLabelInside: {
      fontSize: FONT_SIZE.xs,
      fontWeight: FONT_WEIGHT.semiBold,
      marginBottom: SPACING.xs,
    },
    inputField: {
      fontSize: FONT_SIZE.md,
      minHeight: 28,
      includeFontPadding: false,
    },
    inputFieldFlex: {
      fontSize: FONT_SIZE.md,
      flex: 1,
      minHeight: 28,
      includeFontPadding: false,
    },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    forgotLink: { alignSelf: "flex-end" },
    forgotText: {
      fontSize: FONT_SIZE.sm,
      fontWeight: FONT_WEIGHT.semiBold,
    },
    footerSection: { width: "100%" },
    primaryButton: {
      borderRadius: RADIUS.pill,
      height: 56,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: SPACING.md,
    },
    primaryButtonText: {
      color: colors.white,
      fontSize: FONT_SIZE.md,
      fontWeight: FONT_WEIGHT.bold,
    },
    switchLink: { alignItems: "center", marginBottom: SPACING.md },
    switchLinkText: {
      fontSize: FONT_SIZE.base,
      fontWeight: FONT_WEIGHT.bold,
    },
    switchMode: { alignItems: "center", marginBottom: SPACING.xl },
    wcagText: {
      fontSize: FONT_SIZE.xs,
      textDecorationLine: "underline",
    },
    officerLink: { alignItems: "center" },
    officerLinkText: {
      fontSize: FONT_SIZE.base,
      fontWeight: FONT_WEIGHT.bold,
    },
  });
