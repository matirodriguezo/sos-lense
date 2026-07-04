import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import { ROLES } from "../../constants/roles";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

export default function WebLoginScreen({ onLogin }) {
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
      Alert.alert("Error", "Ingresa tu Placa/RUT y Contraseña");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, buildEmail(), password);
      onLogin?.();
    } catch (e) {
      Alert.alert("Error de inicio de sesión", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!rut || !password || !alias) {
      Alert.alert("Error", "Completa todos los campos (placa, nombre y contraseña)");
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
      setIsRegistering(false);
    } catch (e) {
      Alert.alert("Error al registrarse", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: colors.drawerHeaderBg }]}>
      <View style={s.centerWrap}>
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <View style={s.brandSection}>
            <View style={s.logoCircle}>
              <MaterialCommunityIcons name="star-circle" size={48} color={colors.gold} />
            </View>
            <Text style={[s.republicText, { color: colors.textSecondary }]}>REPÚBLICA DE CHILE</Text>
            <Text style={s.welcomeTitle}>S.O.S. CARABINEROS</Text>
            <View style={[s.divider, { backgroundColor: colors.gold }]} />
            <Text style={[s.portalText, { color: colors.gold }]}>PORTAL DE OPERADORES — CENCO</Text>
          </View>

          <Text style={[s.inputLabel, { color: colors.labelGray }]}>PLACA / RUT</Text>
          <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[s.input, { color: colors.textPrimary }]}
              placeholder="Ej: 12.345.678-9"
              placeholderTextColor={colors.textSecondary}
              value={rut}
              onChangeText={setRut}
              autoCapitalize="none"
            />
          </View>

          {isRegistering && (
            <>
              <Text style={[s.inputLabel, { color: colors.labelGray }]}>GRADO Y NOMBRE</Text>
              <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="Ej: Cabo 1ro José Martínez"
                  placeholderTextColor={colors.textSecondary}
                  value={alias}
                  onChangeText={setAlias}
                  autoCapitalize="words"
                />
              </View>
            </>
          )}

          <Text style={[s.inputLabel, { color: colors.labelGray }]}>
            {isRegistering ? "CREAR CONTRASEÑA" : "CONTRASEÑA"}
          </Text>
          <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[s.input, { color: colors.textPrimary }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isRegistering && (
            <>
              <Text style={[s.inputLabel, { color: colors.labelGray }]}>CONFIRMAR CONTRASEÑA</Text>
              <View style={[s.inputWrap, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
                <TextInput
                  style={[s.input, { color: colors.textPrimary }]}
                  placeholder="Repite la contraseña"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary }, loading && { opacity: 0.6 }]}
            onPress={isRegistering ? handleRegister : handleLogin}
            disabled={loading}
          >
            <Text style={s.primaryBtnText}>
              {loading ? "Procesando..." : isRegistering ? "Registrar Personal" : "Iniciar Turno"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.switchLink}
            onPress={() => {
              if (isRegistering) {
                Alert.alert("Cancelar", "¿Cancelar el registro?", [
                  { text: "Seguir", style: "cancel" },
                  { text: "Cancelar", onPress: () => setIsRegistering(false) },
                ]);
              } else {
                Alert.alert("Registro", "¿Eres personal autorizado?", [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Registrarme", onPress: () => setIsRegistering(true) },
                ]);
              }
            }}
          >
            <Text style={[s.switchLinkText, { color: colors.textSecondary }]}>
              {isRegistering ? "Cancelar registro" : "¿Nuevo operador? Regístrate"}
            </Text>
          </TouchableOpacity>

          <View style={s.footerRow}>
            <MaterialCommunityIcons name="shield-outline" size={14} color={colors.textSecondary} />
            <Text style={[s.footerText, { color: colors.textSecondary }]}>
              Sistema LENSE — Acceso Restringido — Personal Carabineros de Chile
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    centerWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 440,
      borderRadius: 16,
      padding: 32,
      elevation: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
    },
    brandSection: { alignItems: "center", marginBottom: 28 },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: colors.gold,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    republicText: { fontSize: 11, letterSpacing: 2, fontWeight: "600", marginBottom: 4 },
    welcomeTitle: { fontSize: 22, fontWeight: "900", color: colors.textPrimary, letterSpacing: 1 },
    divider: { width: 40, height: 3, marginVertical: 10, borderRadius: 2 },
    portalText: { fontSize: 13, letterSpacing: 2, fontWeight: "700" },

    inputLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 6 },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 14,
      height: 44,
      marginBottom: 16,
    },
    input: { flex: 1, fontSize: 15, includeFontPadding: false, outlineStyle: "none", outlineWidth: 0 },

    primaryBtn: {
      borderRadius: 10,
      height: 50,
      justifyContent: "center",
      alignItems: "center",
      marginTop: 4,
      cursor: "pointer",
    },
    primaryBtnText: { color: colors.white, fontSize: 15, fontWeight: "700" },

    switchLink: { marginTop: 16, alignSelf: "center" },
    switchLinkText: { fontSize: 14 },

    footerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
    footerText: { fontSize: 11, marginLeft: 6 },
  });
