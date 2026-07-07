import {
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
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
  let hadDoc = false;

  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      if (hadDoc) {
        console.log("[Signal] remote doc deleted — remote hung up");
        callbacks?.onHangup?.();
      } else {
        console.log("[Signal] snap no doc (initial)");
      }
      forwardedOffer = false;
      forwardedAnswer = false;
      seenIce.clear();
      return;
    }
    hadDoc = true;
    const data = snap.data();
    console.log("[Signal] snap type=" + (data.type || "?") + " ice=" + ((data.ice && data.ice.length) || 0) + " sdp=" + (data.sdp ? "yes" : "no"));

    if (data.type === "offer" && data.sdp && !forwardedOffer) {
      forwardedOffer = true;
      console.log("[Signal] forwarding offer");
      try { callbacks?.onOffer?.(JSON.parse(data.sdp)); } catch { callbacks?.onOffer?.(data.sdp); }
    }

    if (data.type === "answer" && data.sdp && !forwardedAnswer) {
      forwardedAnswer = true;
      try {
        const parsed = JSON.parse(data.sdp);
        const mlines = (parsed.sdp || "").split("\n").filter((l) => l.startsWith("m=")).join(", ");
        console.log("[Signal] forwarding answer m-lines:", mlines);
        callbacks?.onAnswer?.(parsed);
      } catch {
        console.log("[Signal] forwarding answer (raw)");
        callbacks?.onAnswer?.(data.sdp);
      }
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
    await setDoc(ref, { ice: arrayUnion(JSON.stringify(candidate)) }, { merge: true });
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
