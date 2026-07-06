import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

export function createSignalingChannel(incidentId, uid) {
  return doc(db, "incidents", incidentId, "signaling", uid);
}

export function listenSignaling(incidentId, remoteUid, callbacks) {
  const ref = createSignalingChannel(incidentId, remoteUid);
  const seenIce = new Set();
  let forwardedOffer = false;
  let forwardedAnswer = false;

  console.log("[Signal] listen start", incidentId, remoteUid);

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) { console.log("[Signal] snap no doc"); return; }
    const data = snap.data();
    console.log("[Signal] snap type=" + (data.type || "?") + " ice=" + ((data.ice && data.ice.length) || 0) + " sdp=" + (data.sdp ? "yes" : "no"));

    if (data.type === "offer" && data.sdp && !forwardedOffer) {
      forwardedOffer = true;
      console.log("[Signal] forwarding offer");
      try { callbacks?.onOffer?.(JSON.parse(data.sdp)); } catch { callbacks?.onOffer?.(data.sdp); }
    }

    if (data.type === "answer" && data.sdp && !forwardedAnswer) {
      forwardedAnswer = true;
      console.log("[Signal] forwarding answer");
      try { callbacks?.onAnswer?.(JSON.parse(data.sdp)); } catch { callbacks?.onAnswer?.(data.sdp); }
    }

    if (data.ice && Array.isArray(data.ice)) {
      data.ice.forEach((c) => {
        if (!seenIce.has(c)) {
          seenIce.add(c);
          let parsed = c;
          try { parsed = JSON.parse(c); } catch {}
          callbacks?.onIce?.(parsed);
        }
      });
    }
  }, (error) => {
    console.warn("[Signal] listen error:", error?.code || error);
  });
}

export async function sendOffer(incidentId, uid, sdp) {
  console.log("[Signal] sendOffer", incidentId, uid, sdp ? "sdp=" + sdp.sdp?.substring(0, 40) + "..." : "no sdp");
  const ref = createSignalingChannel(incidentId, uid);
  await setDoc(ref, {
    type: "offer",
    sdp: JSON.stringify(sdp),
    role: "",
    createdAt: serverTimestamp(),
    ice: [],
  });
  console.log("[Signal] sendOffer done");
}

export async function sendAnswer(incidentId, uid, sdp) {
  console.log("[Signal] sendAnswer", incidentId, uid, sdp ? "sdp=" + sdp.sdp?.substring(0, 40) + "..." : "no sdp");
  const ref = createSignalingChannel(incidentId, uid);
  await setDoc(ref, {
    type: "answer",
    sdp: JSON.stringify(sdp),
    role: "",
    createdAt: serverTimestamp(),
    ice: [],
  });
  console.log("[Signal] sendAnswer done");
}

export async function sendIceCandidate(incidentId, uid, candidate) {
  console.log("[Signal] sendIce", incidentId, uid);
  const ref = createSignalingChannel(incidentId, uid);
  try {
    await updateDoc(ref, {
      ice: arrayUnion(JSON.stringify(candidate)),
    });
  } catch (e) {
    console.log("[Signal] sendIce error", e.message);
  }
}

export async function clearSignaling(incidentId, uid) {
  const ref = createSignalingChannel(incidentId, uid);
  try {
    await deleteDoc(ref);
  } catch {}
}
