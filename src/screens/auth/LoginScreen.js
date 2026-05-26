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
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from "../../constants/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"; // Agregado

export default function LoginScreen({ navigation }) {
  const [rut, setRut] = useState("");
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
        role: ROLES.CITIZEN,
        rut: rut || "",
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
                  style={[styles.inputField, { flex: 1 }]}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.border}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                {!isRegistering && (
                  <Ionicons name="finger-print-outline" size={24} color="#A0A0A0" style={{ marginRight: 12 }} />
                )}
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#A0A0A0"
                  />
                </TouchableOpacity>
              </View>
            </View>

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

            <TouchableOpacity style={styles.switchMode} onPress={() => setIsRegistering(!isRegistering)}>
              <Text style={styles.wcagText}>
                {isRegistering ? "¿Ya tienes cuenta? Inicia sesión" : "Cumple con estándares de accesibilidad WCAG 2.1"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.officerLink} onPress={() => navigation.navigate("OfficerLogin")}>
              <Text style={styles.officerLinkText}>Acceso Personal Carabineros</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" }, // Fondo gris muy claro
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandSection: { alignItems: "center", marginBottom: 40 },
  shieldContainer: {
    width: 90,
    height: 100,
    backgroundColor: "#004B2B",
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  shieldText: { color: "#FFF", fontSize: 10, fontWeight: "bold", marginTop: 4 },
  shieldSubText: { color: "#FFF", fontSize: 8 },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1A1A1A",
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
  },
  formSection: { width: "100%", marginBottom: 32 },
  inputWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  inputLabelInside: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "600",
    marginBottom: 4,
  },
  inputField: {
    fontSize: 16,
    color: "#1A1A1A",
    height: 30,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  forgotLink: { alignSelf: "flex-end" },
  forgotText: {
    fontSize: 13,
    color: "#004B2B",
    fontWeight: "600",
  },
  footerSection: { width: "100%" },
  primaryButton: {
    backgroundColor: "#004B2B",
    borderRadius: 25,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#004B2B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  switchMode: { alignItems: "center", marginBottom: 32 },
  wcagText: {
    fontSize: 12,
    color: "#888888",
    textDecorationLine: "underline",
  },
  officerLink: { alignItems: "center" },
  officerLinkText: {
    fontSize: 14,
    color: "#004B2B",
    fontWeight: "bold",
  },
});