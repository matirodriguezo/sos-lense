import { io } from "socket.io-client";
import { API_URL } from "./apiClient";

const LOG = "[RealtimeSvc]";

let socket = null;
let currentToken = null;

const listeners = {
  "incident:created": [],
  "incident:updated": [],
  "incident:status-changed": [],
  "message:created": [],
  "message:read": [],
};

/**
 * Connect to the /realtime namespace.
 * @param {string} token JWT access token
 */
export function connectRealtime(token) {
  if (socket?.connected) {
    console.log(`${LOG} already connected`);
    return socket;
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
  });

  socket.on("connect_error", async (err) => {
    console.warn(`${LOG} connect_error`, err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log(`${LOG} disconnected`, reason);
  });

  Object.keys(listeners).forEach((event) => {
    socket.on(event, (data) => {
      console.log(`${LOG} << ${event}`);
      listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.warn(`${LOG} listener error for ${event}:`, e.message);
        }
      });
    });
  });

  return socket;
}

export function subscribeIncident(incidentId) {
  if (!socket?.connected) return;
  socket.emit("subscribe:incident", { incidentId });
  console.log(`${LOG} subscribe incident:${incidentId}`);
}

export function unsubscribeIncident(incidentId) {
  if (!socket?.connected) return;
  socket.emit("unsubscribe:incident", { incidentId });
  console.log(`${LOG} unsubscribe incident:${incidentId}`);
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
  Object.keys(listeners).forEach((key) => {
    listeners[key] = [];
  });
}

export function isConnected() {
  return !!socket?.connected;
}

export function getSocket() {
  return socket;
}
