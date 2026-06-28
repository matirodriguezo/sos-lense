import { io } from "socket.io-client";
import { API_URL } from "./apiClient";
import { refresh as refreshAuth, logout as logoutAuth } from "./authService";

const LOG = "[RealtimeSvc]";

let socket = null;
let currentToken = null;
let isReconnecting = false;
let listenersAttached = false;

const listeners = {
  "incident:created": [],
  "incident:updated": [],
  "incident:status-changed": [],
  "message:created": [],
  "message:read": [],
};

const activeSubscriptions = new Set();

function dispatch(event, data) {
  if (!listeners[event]) return;
  listeners[event].forEach((cb) => {
    try {
      cb(data);
    } catch (e) {
      console.warn(`${LOG} listener error for ${event}:`, e.message);
    }
  });
}

function isAuthError(err) {
  const msg = (err?.message || "").toLowerCase();
  return (
    msg.includes("token") ||
    msg.includes("unauthorized") ||
    err?.status === 401 ||
    err?.data?.status === 401
  );
}

function rejoinRooms() {
  if (!socket?.connected) return;
  activeSubscriptions.forEach((incidentId) => {
    socket.emit("subscribe:incident", { incidentId });
    console.log(`${LOG} re-subscribe incident:${incidentId}`);
  });
}

/**
 * Connect to the /realtime namespace.
 * @param {string} token JWT access token
 */
export function connectRealtime(token) {
  if (socket?.connected && token === currentToken) {
    console.log(`${LOG} already connected`);
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;
  socket = io(`${API_URL}/realtime`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on("connect", () => {
    console.log(`${LOG} connected ${socket.id}`);
    isReconnecting = false;
    rejoinRooms();
  });

  socket.on("connect_error", async (err) => {
    console.warn(`${LOG} connect_error`, err.message);

    if (!isAuthError(err)) {
      // Let socket.io's built-in reconnection handle transient errors.
      return;
    }

    if (isReconnecting) {
      // Already attempted one refresh cycle; session is dead.
      await logoutAuth();
      disconnect();
      return;
    }

    isReconnecting = true;
    socket.disconnect();
    socket = null;
    currentToken = null;

    try {
      const data = await refreshAuth();
      if (!data?.accessToken) {
        throw new Error("refresh returned no access token");
      }
      connectRealtime(data.accessToken);
    } catch (e) {
      console.warn(`${LOG} token refresh failed, logging out:`, e.message);
      await logoutAuth();
      disconnect();
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`${LOG} disconnected`, reason);
  });

  if (!listenersAttached) {
    Object.keys(listeners).forEach((event) => {
      socket.on(event, (data) => {
        console.log(`${LOG} << ${event}`);
        dispatch(event, data);
      });
    });
    listenersAttached = true;
  }

  return socket;
}

export function subscribeIncident(incidentId) {
  activeSubscriptions.add(incidentId);
  if (socket?.connected) {
    socket.emit("subscribe:incident", { incidentId });
    console.log(`${LOG} subscribe incident:${incidentId}`);
  }
}

export function unsubscribeIncident(incidentId) {
  activeSubscriptions.delete(incidentId);
  if (socket?.connected) {
    socket.emit("unsubscribe:incident", { incidentId });
    console.log(`${LOG} unsubscribe incident:${incidentId}`);
  }
}

/**
 * @param {"incident:created" | "incident:updated" | "incident:status-changed" | "message:created" | "message:read"} event
 * @param {Function} callback
 */
export function on(event, callback) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
  return () => off(event, callback);
}

export function off(event, callback) {
  if (!listeners[event]) return;
  listeners[event] = listeners[event].filter((cb) => cb !== callback);
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentToken = null;
  isReconnecting = false;
  activeSubscriptions.clear();
  Object.keys(listeners).forEach((key) => {
    listeners[key] = [];
  });
  listenersAttached = false;
}

export function isConnected() {
  return !!socket?.connected;
}

export function getSocket() {
  return socket;
}
