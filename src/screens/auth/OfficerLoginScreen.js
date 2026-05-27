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
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function OfficerLoginScreen({ navigation }) {
  const [rut, setRut] = useState("");
  const [alias, setAlias] = useState("");
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          
          {/* Header & Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <MaterialCommunityIcons name="star-circle" size={50} color="#D4AF37" />
            </View>
            <Text style={styles.republicText}>REPÚBLICA DE CHILE</Text>
            <Text style={styles.welcomeTitle}>S.O.S. CARABINEROS</Text>
            <View style={styles.divider} />
            <Text style={styles.portalText}>PORTAL DE OPERADORES</Text>
          </View>

          {/* Form Card Overlay */}
          <View style={styles.cardContainer}>
            <Text style={styles.inputLabelInside}>NÚMERO DE PLACA / RUT</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.inputField}
                placeholder="Ej: 12.345.678-9"
                placeholderTextColor="#A0A0A0"
                value={rut}
                onChangeText={setRut}
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.inputLabelInside}>
              {isRegistering ? "CREAR CONTRASEÑA" : "CONTRASEÑA DE SISTEMA"}
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.inputField, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#A0A0A0"
                />
              </TouchableOpacity>
            </View>

            {isRegistering && (
              <>
                <Text style={styles.inputLabelInside}>GRADO Y NOMBRE / ALIAS</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Ej: Cabo 1ro José Martínez"
                    placeholderTextColor="#A0A0A0"
                    value={alias}
                    onChangeText={setAlias}
                    autoCapitalize="words"
                  />
                </View>
              </>
            )}

            {isRegistering && (
              <>
                <Text style={styles.inputLabelInside}>CONFIRMAR CONTRASEÑA</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Repite la contraseña"
                    placeholderTextColor="#A0A0A0"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                  />
                </View>
              </>
            )}

            {!isRegistering && (
              <View style={styles.checkboxRow}>
                <Ionicons name="square-outline" size={20} color="#A0A0A0" />
                <Text style={styles.checkboxText}>Mantener sesión activa en turno</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.6 }]}
              onPress={isRegistering ? handleRegister : handleLogin}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? "Verificando..." : isRegistering ? "Registrar Personal" : "Iniciar Turno"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegistering(!isRegistering)} style={{marginTop: 15, alignSelf: 'center'}}>
               <Text style={styles.checkboxText}>{isRegistering ? "Cancelar registro" : "¿Nuevo operador? Regístrate"}</Text>
            </TouchableOpacity>

            <View style={styles.footerInfoRow}>
              <MaterialCommunityIcons name="shield-outline" size={16} color="#A0A0A0" />
              <Text style={styles.footerInfoText}>Sistema LENSE — Acceso Restringido</Text>
            </View>
          </View>

          {/* Back to Citizen Flow */}
          <TouchableOpacity style={styles.backToCitizen} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color="#D4AF37" />
            <Text style={styles.backToCitizenText}>Volver a portal ciudadano</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#003A20" }, // Verde Institucional Profundo
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  brandSection: { alignItems: "center", marginBottom: 30 },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#D4AF37", // Dorado Institucional
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  republicText: { color: "#E0E0E0", fontSize: 12, letterSpacing: 2, fontWeight: "600", marginBottom: 4 },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  divider: {
    width: 40,
    height: 3,
    backgroundColor: "#D4AF37",
    marginVertical: 12,
  },
  portalText: { color: "#D4AF37", fontSize: 14, letterSpacing: 2, fontWeight: "bold" },
  
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  inputLabelInside: {
    fontSize: 12,
    color: "#666666",
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 20,
  },
  inputField: {
    fontSize: 16,
    color: "#1A1A1A",
    height: "100%",
  },
  checkboxRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  checkboxText: { fontSize: 14, color: "#666666", marginLeft: 8 },
  
  primaryButton: {
    backgroundColor: "#004B2B",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  
  footerInfoRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  footerInfoText: { fontSize: 12, color: "#A0A0A0", marginLeft: 6 },
  
  backToCitizen: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
  },
  backToCitizenText: { color: "#D4AF37", fontSize: 14, marginLeft: 8, fontWeight: "600" },
});