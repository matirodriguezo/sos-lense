import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [banner, setBanner] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const activeChatIdRef = useRef(null);
  const seenMessages = useRef(new Set());
  const initializedAt = useRef(Date.now());
  const bannerTimer = useRef(null);
  const msgUnsubs = useRef([]);
  const incidentUnsub = useRef(null);
  const authUnsub = useRef(null);

  const showBanner = useCallback((senderName, text) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    setBanner({ senderName, text });
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const enterChat = useCallback((incidentId) => {
    activeChatIdRef.current = incidentId;
    setUnreadCount(0);
  }, []);

  const leaveChat = useCallback(() => {
    activeChatIdRef.current = null;
  }, []);

  useEffect(() => {
    authUnsub.current = onAuthStateChanged(auth, (user) => {
      // Cleanup previous listeners
      if (incidentUnsub.current) {
        incidentUnsub.current();
        incidentUnsub.current = null;
      }
      msgUnsubs.current.forEach((u) => u());
      msgUnsubs.current = [];

      if (!user) {
        setUnreadCount(0);
        return;
      }

      const uid = user.uid;
      initializedAt.current = Date.now();
      seenMessages.current.clear();

      getDoc(doc(db, "users", uid)).then((snap) => {
        if (!snap.exists()) return;
        if (auth.currentUser?.uid !== uid) return;

        const role = snap.data().role;
        const isOfficer = role === "OFFICER";
        const userIdField = isOfficer ? "officerId" : "citizenId";

        incidentUnsub.current = onSnapshot(
          query(
            collection(db, "incidents"),
            where(userIdField, "==", uid),
            where("status", "in", ["ACTIVO", "EN_CURSO", "NO_CLASIFICADO"])
          ),
          (snapshot) => {
            msgUnsubs.current.forEach((u) => u());
            msgUnsubs.current = [];

            snapshot.docs.forEach((d) => {
              const incident = { id: d.id, ...d.data() };

              const iq = query(
                collection(db, "incidents", incident.id, "messages"),
                orderBy("createdAt", "asc")
              );
              const unsub = onSnapshot(iq, (msgSnap) => {
                msgSnap.docChanges().forEach((change) => {
                  if (change.type !== "added") return;
                  const msg = { id: change.doc.id, ...change.doc.data() };
                  if (msg.senderId === uid) return;
                  if (msg.senderRole === "SYSTEM") return;
                  if (seenMessages.current.has(msg.id)) return;
                  const msgTime = msg.createdAt?.toMillis?.() || Date.now();
                  if (msgTime < initializedAt.current) return;
                  seenMessages.current.add(msg.id);

                  const senderName = isOfficer
                    ? (incident.citizenAlias || "Ciudadano")
                    : (incident.officerAlias || "Oficial");

                  // Always show banner (in-app) unless user is actively in this chat
                  if (activeChatIdRef.current !== incident.id) {
                    setUnreadCount((prev) => prev + 1);
                    showBanner(senderName, msg.text);
                  }
                });
              });
              msgUnsubs.current.push(unsub);
            });
          }
        );
      });
    });

    return () => {
      if (authUnsub.current) authUnsub.current();
      if (incidentUnsub.current) incidentUnsub.current();
      msgUnsubs.current.forEach((u) => u());
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [showBanner]);

  const value = { banner, unreadCount, enterChat, leaveChat };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return { banner: null, unreadCount: 0, enterChat: () => {}, leaveChat: () => {} };
  return ctx;
}