import { io } from "socket.io-client";
import { API_URL } from "./apiClient";

const LOG = "[SignalSvc]";

let socket = null;
let currentIncidentId = null;

const callbacks = {
  onOffer: null,
  onAnswer: null,
  onIce: null,
  onBye: null,
};

/**
 * Connect to the /signaling namespace.
 * @param {string} token JWT access token
 */
export function connectSignaling(token) {
  if (socket?.connected) {
    console.log(`${LOG} already connected`);
    return socket;
  }

  socket = io(`${API_URL}/signaling`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log(`${LOG} connected ${socket.id}`);
    if (currentIncidentId) {
      joinIncident(currentIncidentId);
    }
  });

  socket.on("connect_error", async (err) => {
    console.warn(`${LOG} connect_error`, err.message);
  });

  socket.on("disconnect", (reason) => {
    console.log(`${LOG} disconnected`, reason);
  });

  socket.on("signal:offer", (data) => {
    console.log(`${LOG} << offer`);
    callbacks.onOffer?.(data.sdp);
  });

  socket.on("signal:answer", (data) => {
    console.log(`${LOG} << answer`);
    callbacks.onAnswer?.(data.sdp);
  });

  socket.on("signal:ice", (data) => {
    console.log(`${LOG} << ice`);
    callbacks.onIce?.(data.candidate);
  });

  socket.on("signal:bye", () => {
    console.log(`${LOG} << bye`);
    callbacks.onBye?.();
  });

  return socket;
}

/**
 * Join the room for a specific incident.
 * @param {string} incidentId
 */
export function joinIncident(incidentId) {
  currentIncidentId = incidentId;
  if (!socket?.connected) {
    console.warn(`${LOG} cannot join, socket not connected`);
    return;
  }
  socket.emit("join", { incidentId });
  console.log(`${LOG} join incident:${incidentId}`);
}

export function sendOffer(sdp) {
  if (!socket?.connected || !currentIncidentId) return;
  console.log(`${LOG} >> offer`);
  socket.emit("signal:offer", { incidentId: currentIncidentId, sdp });
}

export function sendAnswer(sdp) {
  if (!socket?.connected || !currentIncidentId) return;
  console.log(`${LOG} >> answer`);
  socket.emit("signal:answer", { incidentId: currentIncidentId, sdp });
}

export function sendIce(candidate) {
  if (!socket?.connected || !currentIncidentId) return;
  console.log(`${LOG} >> ice`);
  socket.emit("signal:ice", { incidentId: currentIncidentId, candidate });
}

export function sendBye() {
  if (!socket?.connected || !currentIncidentId) return;
  console.log(`${LOG} >> bye`);
  socket.emit("signal:bye", { incidentId: currentIncidentId });
}

export function onOffer(cb) {
  callbacks.onOffer = cb;
}

export function onAnswer(cb) {
  callbacks.onAnswer = cb;
}

export function onIce(cb) {
  callbacks.onIce = cb;
}

export function onBye(cb) {
  callbacks.onBye = cb;
}

export function disconnect() {
  currentIncidentId = null;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function isConnected() {
  return !!socket?.connected;
}
