import { apiFetch } from "./apiClient";
import { getUser } from "./authService";

const LOG = "[IncidentSvc]";

/**
 * @typedef {Object} IncidentInput
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} [address]
 * @property {string} [citizenAlias]
 */

/**
 * @param {IncidentInput} input
 */
export async function triggerSOS(input) {
  const { latitude, longitude, address, citizenAlias } = input;
  console.log(`${LOG} triggerSOS: lat=${latitude.toFixed(4)}, lng=${longitude.toFixed(4)}`);
  const data = await apiFetch("/incidents", {
    method: "POST",
    body: JSON.stringify({ latitude, longitude, address, citizenAlias }),
  });
  console.log(`${LOG} Incident created: ${data.id}`);
  return data.id;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {number} [radiusMeters]
 */
export async function listActiveIncidents(latitude, longitude, radiusMeters = 10000) {
  return apiFetch(
    `/incidents/active?lat=${latitude}&lng=${longitude}&radius=${radiusMeters}`
  );
}

export async function listAllActiveIncidents() {
  console.warn(`${LOG} listAllActiveIncidents without location is deprecated; use listActiveIncidents`);
  return [];
}

export async function listAllCancelled() {
  const user = await getUser();
  if (!user) return [];
  const history = await apiFetch("/incidents/history");
  return history.filter((i) => i.status === "ANULADO");
}

export async function listMyCases() {
  return apiFetch("/incidents/mine");
}

export async function listCitizenHistory() {
  return apiFetch("/incidents/history");
}

export async function getIncident(incidentId) {
  return apiFetch(`/incidents/${incidentId}`);
}

export async function assignOfficer(incidentId) {
  console.log(`${LOG} assignOfficer: incident=${incidentId}`);
  return apiFetch(`/incidents/${incidentId}/assign`, { method: "POST" });
}

export async function startManaging(incidentId) {
  return apiFetch(`/incidents/${incidentId}/start`, { method: "POST" });
}

export async function updateIncidentType(incidentId, type) {
  return apiFetch(`/incidents/${incidentId}/type`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export async function addQuickRequest(incidentId, request) {
  const incident = await getIncident(incidentId);
  const updated = incident.quickRequests || [];
  if (!updated.includes(request)) updated.push(request);
  return apiFetch(`/incidents/${incidentId}/type`, {
    method: "POST",
    body: JSON.stringify({ type: incident.type }),
  });
}

export async function closeIncident(incidentId, observations, reason) {
  console.log(`${LOG} closeIncident: ${incidentId}, reason=${reason}`);
  return apiFetch(`/incidents/${incidentId}/close`, {
    method: "POST",
    body: JSON.stringify({ reason, observations }),
  });
}

export async function cancelIncident(incidentId, reason) {
  console.log(`${LOG} cancelIncident: ${incidentId}, reason=${reason}`);
  return apiFetch(`/incidents/${incidentId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function sendMessage(incidentId, text) {
  return apiFetch(`/incidents/${incidentId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function listMessages(incidentId) {
  return apiFetch(`/incidents/${incidentId}/messages`);
}

export async function markMessageAsRead(incidentId, messageId) {
  try {
    return apiFetch(`/incidents/${incidentId}/messages/${messageId}/read`, {
      method: "POST",
    });
  } catch (e) {
    console.warn(`${LOG} markMessageAsRead failed:`, e.message);
  }
}

export async function updateIncidentStatus(incidentId, status) {
  if (status === "CERRADO") {
    return closeIncident(incidentId, "", "Cierre manual");
  }
  if (status === "ANULADO") {
    return cancelIncident(incidentId, "Cancelación manual");
  }
  console.warn(`${LOG} updateIncidentStatus(${status}) not supported via direct status update`);
}

// Firestore-onSnapshot replacements are handled by realtimeService.js (Phase 4).
// The following helpers return empty unsubscription functions for backwards compatibility
// during the migration; callers in Phase 4 will switch to realtime subscriptions.
export function listenAllActiveIncidents(callback) {
  return () => {};
}

export function listenAllCancelled(callback) {
  return () => {};
}

export function listenMyCases(officerId, callback) {
  return () => {};
}

export function listenCitizenHistory(citizenId, callback) {
  return () => {};
}

export function listenIncidentById(incidentId, callback) {
  return () => {};
}

export function listenMessages(incidentId, callback) {
  return () => {};
}

export function listenMessagesWithStatus(incidentId, callback) {
  return () => {};
}

// sendSystemMessage removed: backend no longer supports SYSTEM sender role.
export async function sendSystemMessage(incidentId, text) {
  console.warn(`${LOG} sendSystemMessage disabled: SYSTEM role removed`);
}
