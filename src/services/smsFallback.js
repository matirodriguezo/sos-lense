import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/firebaseConfig";

const LOG = "[SMSFallback]";

function formatTimestamp() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function buildMessage({ latitude, longitude, address, alias }) {
  const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  return [
    "SOS CARABINEROS - Alerta de Emergencia",
    `Tu contacto ${alias || "desconocido"} ha activado S.O.S. Carabineros.`,
    `Ubicacion: ${mapsUrl}`,
    `Direccion: ${address || "Sin direccion"}`,
    `Hora: ${formatTimestamp()}`,
  ].join("\n");
}

async function tryFirebaseFunction(phone, message) {
  try {
    const functions = getFunctions(app, "southamerica-east1");
    const sendSMS = httpsCallable(functions, "sendEmergencySMS");
    const result = await sendSMS({ phone, message });
    console.log(`${LOG} Firebase Function result:`, result.data);
    return true;
  } catch (e) {
    console.warn(`${LOG} Firebase Function not available:`, e?.message);
    return false;
  }
}

async function tryTextBelt(phone, message) {
  try {
    const resp = await fetch("https://textbelt.com/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, key: "textbelt" }),
    });
    const data = await resp.json();
    if (data.success) {
      console.log(`${LOG} TextBelt SMS sent successfully`);
      return true;
    }
    console.warn(`${LOG} TextBelt failed:`, data.error || "unknown");
    return false;
  } catch (e) {
    console.warn(`${LOG} TextBelt error:`, e?.message);
    return false;
  }
}

async function tryExpoSMS(phone, message) {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.warn(`${LOG} expo-sms not available on this device`);
      return false;
    }
    console.log(`${LOG} Opening SMS composer for ${phone}`);
    const { result } = await SMS.sendSMSAsync([phone], message);
    console.log(`${LOG} SMS result: ${result}`);
    return result === "sent" || result === "unknown";
  } catch (e) {
    console.warn(`${LOG} expo-sms failed:`, e?.message);
    return false;
  }
}

async function tryLinking(phone, message) {
  if (Platform.OS !== "web") {
    try {
      await Linking.openURL(`sms:${phone}&body=${encodeURIComponent(message)}`);
      return true;
    } catch (e) {
      console.warn(`${LOG} Linking SMS failed:`, e?.message);
    }
  }
  return false;
}

export async function sendSOSBySMS(addresses, { latitude, longitude, address, alias }) {
  try {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      console.warn(`${LOG} SMS not available on this device`);
      return false;
    }

    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    const message = [
      "SOS CARABINEROS - Alerta sin conexion",
      `Alias: ${alias || "No especificado"}`,
      `Ubicacion: ${mapsUrl}`,
      `Direccion: ${address || "Sin direccion"}`,
      `Hora: ${formatTimestamp()}`,
    ].join("\n");

    console.log(`${LOG} Sending SMS to ${addresses}`);
    const { result } = await SMS.sendSMSAsync(addresses, message);
    console.log(`${LOG} SMS result: ${result}`);
    return result === "sent" || result === "unknown";
  } catch (e) {
    console.error(`${LOG} Error sending SMS:`, e);
    return false;
  }
}

export async function sendEmergencyAlertSMS(phone, data) {
  const message = buildMessage(data);
  console.log(`${LOG} Attempting automatic SMS to ${phone}`);

  // 1) Try Firebase Function (cloud-based, fully automatic)
  const fnSent = await tryFirebaseFunction(phone, message);
  if (fnSent) { console.log(`${LOG} SMS sent via Firebase Function`); return true; }

  // 2) Try TextBelt free API (fully automatic, 1 free SMS/day)
  const tbSent = await tryTextBelt(phone, message);
  if (tbSent) { console.log(`${LOG} SMS sent via TextBelt`); return true; }

  // 3) Fallback: open native SMS composer (user taps Send)
  const expoSent = await tryExpoSMS(phone, message);
  if (expoSent) { console.log(`${LOG} SMS sent via expo-sms`); return true; }

  // 4) Last resort: Linking fallback (web)
  const linkSent = await tryLinking(phone, message);
  if (linkSent) { console.log(`${LOG} SMS sent via Linking`); return true; }

  console.warn(`${LOG} All SMS methods failed for ${phone}`);
  return false;
}
