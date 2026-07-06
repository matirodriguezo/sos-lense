import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const LOG_TAG = "[NotificationCtx]";

export const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [banner, setBanner] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const activeChatIdRef = useRef(null);
  const inChatListRef = useRef(false);
  const seenMessages = useRef(new Set());
  const initializedAt = useRef(Date.now());
  const bannerTimer = useRef(null);
  const msgUnsubs = useRef([]);
  const incidentUnsub = useRef(null);
  const authUnsub = useRef(null);
  const isVisibleRef = useRef(true);
  const prevCountRef = useRef(0);

  const showBanner = useCallback((senderName, text, incidentId, role) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    const navTarget = role === "OFFICER"
      ? { route: "Emergencia", params: { screen: "IncidentManagement", params: { incidentId, autoOpenChat: true } } }
      : { route: "VideoCall", params: { incidentId, chatOnly: true } };
    setBanner({ senderName, text, incidentId, ...navTarget });
    bannerTimer.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  const enterChat = useCallback((incidentId) => {
    activeChatIdRef.current = incidentId;
    if (prevCountRef.current !== 0) {
      console.log(`${LOG_TAG} Entering chat ${incidentId}, clearing unread count`);
    }
    setUnreadCount(0);
    prevCountRef.current = 0;
  }, []);

  const leaveChat = useCallback(() => {
    activeChatIdRef.current = null;
  }, []);

  const enterChatList = useCallback(() => {
    inChatListRef.current = true;
    if (prevCountRef.current !== 0) {
      console.log(`${LOG_TAG} Entering chat list, cleared ${prevCountRef.current} unreads`);
    }
    setUnreadCount(0);
    prevCountRef.current = 0;
  }, []);

  const leaveChatList = useCallback(() => {
    inChatListRef.current = false;
  }, []);

  useEffect(() => {
    authUnsub.current = onAuthStateChanged(auth, (user) => {
      console.log(`${LOG_TAG} Auth state changed:`, user?.uid ? `user ${user.uid.slice(0, 6)}...` : "null");

      if (incidentUnsub.current) {
        incidentUnsub.current();
        incidentUnsub.current = null;
      }
      msgUnsubs.current.forEach((u) => u());
      msgUnsubs.current = [];

      if (!user) {
        setUnreadCount(0);
        prevCountRef.current = 0;
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
        console.log(`${LOG_TAG} Setting up listeners for ${isOfficer ? "officer" : "citizen"} (${uid.slice(0, 6)}...)`);

        incidentUnsub.current = onSnapshot(
          query(
            collection(db, "incidents"),
            where(userIdField, "==", uid),
            where("status", "in", ["ACTIVO", "EN_CURSO", "NO_CLASIFICADO"])
          ),
          (snapshot) => {
            try {
              msgUnsubs.current.forEach((u) => u());
              msgUnsubs.current = [];

              if (snapshot.empty) {
                console.log(`${LOG_TAG} No active incidents found`);
                return;
              }

              console.log(`${LOG_TAG} Found ${snapshot.docs.length} active incident(s)`);

              snapshot.docs.forEach((d) => {
                const incident = { id: d.id, ...d.data() };

                const iq = query(
                  collection(db, "incidents", incident.id, "messages"),
                  orderBy("createdAt", "asc")
                );
                const unsub = onSnapshot(iq, (msgSnap) => {
                  try {
                    msgSnap.docChanges().forEach((change) => {
                      if (change.type !== "added") return;
                      const msg = { id: change.doc.id, ...change.doc.data() };
                      if (msg.senderId === uid) return;
                      if (msg.senderRole === "SYSTEM") return;
                      if (seenMessages.current.has(msg.id)) return;
                      const msgTime = msg.createdAt?.toMillis?.() || Date.now();
                      if (msgTime < initializedAt.current) return;
                      seenMessages.current.add(msg.id);

                      if (seenMessages.current.size > 200) {
                        const entries = [...seenMessages.current];
                        seenMessages.current = new Set(entries.slice(-100));
                      }

                      const senderName = isOfficer
                        ? (incident.citizenAlias || "Ciudadano")
                        : (incident.officerAlias || "Oficial");

                      if (inChatListRef.current) {
                        showBanner(senderName, msg.text, incident.id, role);
                      } else if (activeChatIdRef.current !== incident.id) {
                        setUnreadCount((prev) => {
                          const next = prev + 1;
                          prevCountRef.current = next;
                          return next;
                        });
                        showBanner(senderName, msg.text, incident.id, role);
                      }
                    });
                  } catch (e) {
                    console.warn(`${LOG_TAG} message listener callback error:`, e);
                  }
                }, (error) => {
                  console.warn(`${LOG_TAG} message listener error:`, error?.code || error);
                });
                msgUnsubs.current.push(unsub);
              });
            } catch (e) {
              console.warn(`${LOG_TAG} incident listener callback error:`, e);
            }
          },
          (error) => {
            console.warn(`${LOG_TAG} incident listener error:`, error?.code || error);
          }
        );
      }).catch((e) => {
        console.warn(`${LOG_TAG} getDoc error:`, e);
      });
    });

    return () => {
      if (authUnsub.current) authUnsub.current();
      if (incidentUnsub.current) incidentUnsub.current();
      msgUnsubs.current.forEach((u) => u());
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, [showBanner]);

  const value = { banner, unreadCount, enterChat, leaveChat, enterChatList, leaveChatList };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return { banner: null, unreadCount: 0, enterChat: () => {}, leaveChat: () => {}, enterChatList: () => {}, leaveChatList: () => {} };
  return ctx;
}
