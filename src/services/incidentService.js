import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  GeoPoint,
  orderBy,
  arrayUnion,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const LOG = "[IncidentSvc]";

export async function triggerSOS(citizenId, { latitude, longitude, address, citizenAlias }) {
  console.log(`${LOG} triggerSOS: citizen=${citizenId.slice(0, 6)}..., lat=${latitude.toFixed(4)}, lng=${longitude.toFixed(4)}`);
  const docRef = await addDoc(collection(db, "incidents"), {
    citizenId,
    citizenAlias: citizenAlias || "",
    officerId: null,
    officerAlias: "",
    status: "NO_CLASIFICADO",
    type: "Por definir",
    location: new GeoPoint(latitude, longitude),
    latitude,
    longitude,
    address: address || "",
    quick_requests: [],
    observations: "",
    closedReason: "",
    cancelled: false,
    participantStatus: {
      citizen: "CITIZEN_ALERT_SENT",
      citizenUpdatedAt: serverTimestamp(),
      communication: "NOT_SET",
      communicationUpdatedAt: serverTimestamp(),
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  console.log(`${LOG} Incident created: ${docRef.id}`);
  return docRef.id;
}

export function listenAllActiveIncidents(callback) {
  const q = query(
    collection(db, "incidents"),
    where("status", "in", ["NO_CLASIFICADO", "ACTIVO", "EN_CURSO"])
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.warn(`${LOG} listenAllActiveIncidents error:`, error?.code || error);
  });
}

export function listenAllCancelled(callback) {
  const q = query(
    collection(db, "incidents"),
    where("status", "==", "ANULADO")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.warn(`${LOG} listenAllCancelled error:`, error?.code || error);
  });
}

export function listenMyCases(officerId, callback) {
  const q = query(
    collection(db, "incidents"),
    where("officerId", "==", officerId)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.warn(`${LOG} listenMyCases error:`, error?.code || error);
  });
}

export function listenCitizenHistory(citizenId, callback) {
  const q = query(
    collection(db, "incidents"),
    where("citizenId", "==", citizenId)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => {
      const tA = a.createdAt?.toMillis?.() || 0;
      const tB = b.createdAt?.toMillis?.() || 0;
      return tB - tA;
    });
    callback(data);
  }, (error) => {
    console.warn(`${LOG} listenCitizenHistory error:`, error?.code || error);
  });
}

export function listenIncidentById(incidentId, callback) {
  return onSnapshot(doc(db, "incidents", incidentId), (snapshot) => {
    if (snapshot?.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    }
  }, (error) => {
    console.warn(`${LOG} listenIncidentById error:`, error?.code || error);
  });
}

export function listenMessages(incidentId, callback) {
  const q = query(
    collection(db, "incidents", incidentId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.warn(`${LOG} listenMessages error:`, error?.code || error);
  });
}

export async function assignOfficer(incidentId, officerId, officerAlias = "") {
  console.log(`${LOG} assignOfficer: incident=${incidentId}, officer=${officerId.slice(0, 6)}..., alias=${officerAlias}`);
  await updateDoc(doc(db, "incidents", incidentId), {
    officerId,
    officerAlias,
    status: "ACTIVO",
    updatedAt: serverTimestamp(),
  });
  console.log(`${LOG} Incident ${incidentId} assigned to ${officerAlias}`);
}

export async function startManaging(incidentId) {
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "EN_CURSO",
    updatedAt: serverTimestamp(),
  });
}

export async function addQuickRequest(incidentId, request) {
  await updateDoc(doc(db, "incidents", incidentId), {
    quick_requests: arrayUnion(request),
    updatedAt: serverTimestamp(),
  });
}

export async function closeIncident(incidentId, observations, reason) {
  console.log(`${LOG} closeIncident: ${incidentId}, reason=${reason}`);
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "CERRADO",
    observations,
    closedReason: reason || "",
    updatedAt: serverTimestamp(),
  });
  await sendSystemMessage(incidentId, `INCIDENTE CERRADO POR CARABINEROS. Resolución: ${reason || "Sin especificar"}`);
}

export async function cancelIncident(incidentId, reason) {
  console.log(`${LOG} cancelIncident: ${incidentId}, reason=${reason}`);
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "ANULADO",
    observations: reason || "Cancelado por el ciudadano",
    closedReason: reason || "Cancelación voluntaria",
    cancelled: true,
    updatedAt: serverTimestamp(),
  });
  await sendSystemMessage(incidentId, `INCIDENTE ANULADO POR EL CIUDADANO. Motivo: ${reason || "Cancelación voluntaria"}`);
}

export async function sendSystemMessage(incidentId, text) {
  await addDoc(collection(db, "incidents", incidentId, "messages"), {
    text: `[SISTEMA] ${text}`,
    senderId: "system",
    senderRole: "SYSTEM",
    createdAt: serverTimestamp(),
  });
}

export async function sendMessage(incidentId, text, senderId, senderRole) {
  await addDoc(collection(db, "incidents", incidentId, "messages"), {
    text,
    senderId,
    senderRole,
    createdAt: serverTimestamp(),
    readBy: [],
    status: "sent",
  });
}

export async function markMessageAsRead(incidentId, messageId, userId) {
  try {
    const msgRef = doc(db, "incidents", incidentId, "messages", messageId);
    await updateDoc(msgRef, {
      readBy: arrayUnion(userId),
      status: "read",
    });
  } catch {}
}

export function listenMessagesWithStatus(incidentId, callback) {
  const q = query(
    collection(db, "incidents", incidentId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (error) => {
    console.warn(`${LOG} listenMessagesWithStatus error:`, error?.code || error);
  });
}

export async function updateIncidentStatus(incidentId, status) {
  await updateDoc(doc(db, "incidents", incidentId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function getIncident(incidentId) {
  const snap = await getDoc(doc(db, "incidents", incidentId));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return null;
}

/* ─── Participant Status Tracking ─── */
export const CITIZEN_STATUS = {
  IDLE: "CITIZEN_IDLE",
  ALERT_SENT: "CITIZEN_ALERT_SENT",
  CLASSIFYING: "CITIZEN_CLASSIFYING",
  IN_CALL: "CITIZEN_IN_CALL",
  CHAT_ONLY: "CITIZEN_CHAT_ONLY",
  IN_FAKE_APP: "CITIZEN_IN_FAKE_APP",
};

export const OFFICER_STATUS = {
  IDLE: "OFFICER_IDLE",
  DISPATCHING: "OFFICER_DISPATCHING",
  IN_CALL: "OFFICER_IN_CALL",
  CHATTING: "OFFICER_CHATTING",
  CLOSING: "OFFICER_CLOSING",
};

export async function updateParticipantStatus(incidentId, role, status) {
  const update = { updatedAt: serverTimestamp() };
  if (role === "CITIZEN") {
    update["participantStatus.citizen"] = status;
    update["participantStatus.citizenUpdatedAt"] = serverTimestamp();
  } else {
    update["participantStatus.officer"] = status;
    update["participantStatus.officerUpdatedAt"] = serverTimestamp();
  }
  await updateDoc(doc(db, "incidents", incidentId), update);
}

/* ─── Communication Mode ─── */
export const COMM_MODE = {
  NOT_SET: "NOT_SET",
  VIDEO_CALL: "VIDEO_CALL",
  CHAT_ONLY: "CHAT_ONLY",
  ALERT_ONLY: "ALERT_ONLY",
};

export async function updateCommunicationMode(incidentId, mode) {
  await updateDoc(doc(db, "incidents", incidentId), {
    "participantStatus.communication": mode,
    "participantStatus.communicationUpdatedAt": serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
