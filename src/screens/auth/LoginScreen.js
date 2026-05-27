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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"; // Agregado

export default function LoginScreen({ navigation }) {
  const [rut, setRut] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandSection}>
            <View style={styles.shieldContainer}>
              <MaterialCommunityIcons name="shield-check" size={40} color="#FFFFFF" />
              <Text style={styles.shieldText}>CARABINEROS</Text>
              <Text style={styles.shieldSubText}>DE CHILE</Text>
            </View>
            <Text style={styles.welcomeTitle}>Bienvenido</Text>
            <Text style={styles.welcomeSubtitle}>
              Plataforma de emergencia para la Comunidad Sorda
            </Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabelInside}>RUT</Text>
              <TextInput
                style={styles.inputField}
                placeholder="Ej: 12.345.678-9"
                placeholderTextColor={COLORS.textSecondary}
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabelInside}>
                {isRegistering ? "Crea una Contraseña" : "Clave Única"}
              </Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={styles.inputFieldFlex}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                {!isRegistering && (
                  <TouchableOpacity
                    onPress={() => Alert.alert("Biometría", "Autenticación biométrica no disponible aún.")}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Autenticación biométrica"
                  >
                    <Ionicons name="finger-print-outline" size={22} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
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
                    color={COLORS.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isRegistering && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabelInside}>Nombre / Alias</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Ej: Benjamin Muñoz"
                  placeholderTextColor={COLORS.textSecondary}
                  value={alias}
                  onChangeText={setAlias}
                  autoCapitalize="words"
                />
              </View>
            )}

            {isRegistering && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabelInside}>Confirmar Contraseña</Text>
                <TextInput
                  style={styles.inputField}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={COLORS.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            )}

            {!isRegistering && (
              <TouchableOpacity
                style={styles.forgotLink}
                onPress={() => Alert.alert("Restablecer", "Contacta a tu unidad.")}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
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
                {loading ? "Procesando..." : isRegistering ? "Crear Cuenta" : "Ingresar con Clave Única"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchLink}
              onPress={() => setIsRegistering(!isRegistering)}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.switchLinkText}>
                {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchMode}>
              <Text style={styles.wcagText}>
                Cumple con estándares de accesibilidad WCAG 2.1
              </Text>
            </View>

            <TouchableOpacity
              style={styles.officerLink}
              onPress={() => navigation.navigate("OfficerLogin")}
              hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            >
              <Text style={styles.officerLinkText}>Acceso Personal Carabineros</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
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
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  shieldText: { color: "#FFFFFF", fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, marginTop: SPACING.xs },
  shieldSubText: { color: "#FFFFFF", fontSize: FONT_SIZE.xxs },
  welcomeTitle: {
    fontSize: FONT_SIZE.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  welcomeSubtitle: {
    fontSize: FONT_SIZE.base,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  formSection: { width: "100%", marginBottom: SPACING.lg },
  inputWrapper: {
    backgroundColor: COLORS.inputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  inputLabelInside: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.semiBold,
    marginBottom: SPACING.xs,
  },
  inputField: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    minHeight: 28,
    includeFontPadding: false,
  },
  inputFieldFlex: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
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
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.semiBold,
  },
  footerSection: { width: "100%" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: SPACING.md,
    ...SHADOWS.sos,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
  },
  switchLink: { alignItems: "center", marginBottom: SPACING.md },
  switchLinkText: {
    fontSize: FONT_SIZE.base,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
  switchMode: { alignItems: "center", marginBottom: SPACING.xl },
  wcagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    textDecorationLine: "underline",
  },
  officerLink: { alignItems: "center" },
  officerLinkText: {
    fontSize: FONT_SIZE.base,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
});