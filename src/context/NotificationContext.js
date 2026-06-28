import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { connectRealtime, on, disconnect } from "../services/realtimeService";
import { listMyCases, listCitizenHistory } from "../services/incidentService";
import { getUser, getToken } from "../services/authService";

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
  const isVisibleRef = useRef(true);
  const prevCountRef = useRef(0);
  const incidentIdsRef = useRef(new Set());
  const userRef = useRef(null);

  const showBanner = useCallback((senderName, text, incidentId, role) => {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    const navTarget = role === "OFFICER"
      ? { route: "Emergencia", params: { screen: "IncidentManagement", params: { incidentId, autoOpenChat: true } } }
      : { route: "VideoCall", params: { incidentId, autoOpenChat: true } };
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
    let mounted = true;

    async function bootstrap() {
      const [token, user] = await Promise.all([getToken(), getUser()]);
      if (!mounted || !token || !user) return;

      userRef.current = user;
      initializedAt.current = Date.now();
      seenMessages.current.clear();

      connectRealtime(token);

      // Subscribe to relevant incidents
      try {
        const cases =
          user.role === "OFFICER"
            ? await listMyCases()
            : await listCitizenHistory();
        cases.forEach((inc) => {
          incidentIdsRef.current.add(inc.id);
        });
      } catch (e) {
        console.warn(`${LOG_TAG} initial load failed:`, e.message);
      }

      const handleMessageCreated = (data) => {
        const msg = data?.message;
        const incident = data?.incident;
        if (!msg) return;
        if (msg.senderId === user.userId) return;
        if (seenMessages.current.has(msg.id)) return;
        if (new Date(msg.createdAt).getTime() < initializedAt.current) return;
        seenMessages.current.add(msg.id);

        const senderName =
          user.role === "OFFICER"
            ? (incident?.citizenAlias || "Ciudadano")
            : (incident?.officerAlias || "Oficial");

        if (inChatListRef.current) {
          showBanner(senderName, msg.text, data.incidentId, user.role);
        } else if (activeChatIdRef.current !== data.incidentId) {
          setUnreadCount((prev) => {
            const next = prev + 1;
            prevCountRef.current = next;
            return next;
          });
          showBanner(senderName, msg.text, data.incidentId, user.role);
        }
      };

      on("message:created", handleMessageCreated);
    }

    bootstrap();

    return () => {
      mounted = false;
      disconnect();
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
