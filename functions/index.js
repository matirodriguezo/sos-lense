const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendEmergencySMS = functions
  .region("southamerica-east1")
  .runWith({ secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"] })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesion.");
    }

    const { phone, message } = data;
    if (!phone || !message) {
      throw new functions.https.HttpsError("invalid-argument", "Se requieren phone y message.");
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.warn("Twilio credentials not configured");
      throw new functions.https.HttpsError("failed-precondition", "SMS no configurado.");
    }

    const client = require("twilio")(accountSid, authToken);

    try {
      const twilioResp = await client.messages.create({
        body: message,
        from: fromNumber,
        to: phone,
      });
      console.log("Twilio response:", twilioResp.sid);
      return { success: true, sid: twilioResp.sid };
    } catch (e) {
      console.error("Twilio error:", e);
      throw new functions.https.HttpsError("internal", "Error al enviar SMS: " + e.message);
    }
  });
