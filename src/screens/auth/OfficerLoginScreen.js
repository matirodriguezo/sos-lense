import { useState } from "react";
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
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS } from "../../constants/theme";

export default function OfficerLoginScreen({ navigation }) {
  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

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
    if (!rut || !password) {
      Alert.alert("Error", "Completa todos los campos");
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>

          <View style={styles.brandSection}>
            <View style={styles.shieldContainer}>
              <Text style={styles.shieldEmoji}>🛡️</Text>
            </View>
            <Text style={styles.welcomeTitle}>Ingreso de Personal</Text>
            <Text style={styles.welcomeSubtitle}>
              Sistema Integrado de Emergencias S.O.S.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>RUT / Placa</Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Ej: 12.345.678-9"
                placeholderTextColor={COLORS.textSecondary}
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
              />
            </View>

            <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>
              {isRegistering ? "Crea una Contraseña" : "Contraseña"}
            </Text>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.inputField}
                placeholder="••••••••"
                placeholderTextColor={COLORS.border}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeIcon}>
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </Text>
              </TouchableOpacity>
            </View>

            {isRegistering && (
              <>
                <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>
                  Confirmar Contraseña
                </Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Repite la contraseña"
                    placeholderTextColor={COLORS.textSecondary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </>
            )}

            {!isRegistering && (
              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => Alert.alert("Restablecer contraseña", "Contacta a tu unidad de Carabineros para restablecer tu acceso.")}
              >
                <Text style={styles.forgotText}>¿Olvidé mi contraseña?</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footerSection}>
            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.6 }]}
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? "Procesando..."
                  : isRegistering
                  ? "Registrar Personal"
                  : "Ingresar al Sistema"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchMode}
              onPress={() => setIsRegistering(!isRegistering)}
            >
              <Text style={styles.switchModeText}>
                {isRegistering
                  ? "¿Ya tienes cuenta? Ingresa"
                  : "¿Nuevo oficial? Regístrate"}
              </Text>
            </TouchableOpacity>

            <View style={[styles.restrictedCard, SHADOWS.card]}>
              <View style={styles.restrictedRow}>
                <Text style={styles.restrictedIcon}>🛡️</Text>
                <Text style={styles.restrictedText}>
                  ACCESO RESTRINGIDO A{"\n"}PERSONAL AUTORIZADO
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.surface },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  backArrow: { fontSize: 28, color: COLORS.primary, lineHeight: 28 },
  // Brand
  brandSection: { alignItems: "center", marginBottom: SPACING.xl },
  shieldContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.greenTranslucent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  shieldEmoji: { fontSize: 36 },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  // Form
  formSection: { width: "100%", marginBottom: SPACING.xl },
  inputLabel: {
    fontSize: 12,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.labelGray,
    marginBottom: SPACING.sm - 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md - 4,
    height: 48,
  },
  inputIcon: { fontSize: 18, marginRight: SPACING.sm, opacity: 0.6 },
  inputField: {
    flex: 1,
    fontSize: FONT_SIZE.base,
    color: COLORS.textPrimary,
    height: 48,
  },
  eyeButton: { padding: SPACING.sm },
  eyeIcon: { fontSize: 20, opacity: 0.6 },
  forgotLink: { alignSelf: "flex-end", marginTop: SPACING.sm },
  forgotText: {
    fontSize: 12,
    color: COLORS.primary,
    textDecorationLine: "underline",
    fontWeight: FONT_WEIGHT.medium,
  },
  // Footer
  footerSection: { width: "100%" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  primaryButtonText: {
    color: COLORS.surface,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
  },
  switchMode: { alignItems: "center", marginBottom: SPACING.md },
  switchModeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semiBold,
  },
  restrictedCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  restrictedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  restrictedIcon: { fontSize: 24, opacity: 0.5 },
  restrictedText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.bold,
    textAlign: "center",
    letterSpacing: 1,
  },
});
