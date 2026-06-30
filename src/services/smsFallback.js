import * as SMS from "expo-sms";

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
