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
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export async function triggerSOS(citizenId, { latitude, longitude }) {
  const docRef = await addDoc(collection(db, "incidents"), {
    citizenId,
    officerId: null,
    status: "NO_CLASIFICADO",
    type: "Por definir",
    location: new GeoPoint(latitude, longitude),
    latitude,
    longitude,
    quick_requests: [],
    observations: "",
    closedReason: "",
    cancelled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export function listenAllActiveIncidents(callback) {
  const q = query(
    collection(db, "incidents"),
    where("status", "in", ["NO_CLASIFICADO", "ACTIVO", "EN_CURSO"])
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenMyCases(officerId, callback) {
  const q = query(
    collection(db, "incidents"),
    where("officerId", "==", officerId)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  });
}

export function listenIncidentById(incidentId, callback) {
  return onSnapshot(doc(db, "incidents", incidentId), (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() });
    }
  });
}

export function listenMessages(incidentId, callback) {
  const q = query(
    collection(db, "incidents", incidentId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function assignOfficer(incidentId, officerId) {
  await updateDoc(doc(db, "incidents", incidentId), {
    officerId,
    status: "ACTIVO",
    updatedAt: serverTimestamp(),
  });
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
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "CERRADO",
    observations,
    closedReason: reason || "",
    updatedAt: serverTimestamp(),
  });
  await sendSystemMessage(incidentId, `🔴 INCIDENTE CERRADO POR CARABINEROS. Resolución: ${reason || "Sin especificar"}`);
}

export async function cancelIncident(incidentId, reason) {
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "ANULADO",
    observations: reason || "Cancelado por el ciudadano",
    closedReason: reason || "Cancelación voluntaria",
    cancelled: true,
    updatedAt: serverTimestamp(),
  });
  await sendSystemMessage(incidentId, `🚫 INCIDENTE ANULADO POR EL CIUDADANO. Motivo: ${reason || "Cancelación voluntaria"}`);
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
