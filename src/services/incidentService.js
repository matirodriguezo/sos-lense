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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export function listenActiveIncidents(callback) {
  const q = query(
    collection(db, "incidents"),
    where("status", "==", "ACTIVO")
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function listenMyCases(officerId, callback) {
  const q = query(
    collection(db, "incidents"),
    where("status", "==", "EN_CURSO"),
    where("officerId", "==", officerId)
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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

export async function closeIncident(incidentId, observations) {
  await updateDoc(doc(db, "incidents", incidentId), {
    status: "CERRADO",
    observations,
    updatedAt: serverTimestamp(),
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
