import {
  setTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  clearStoredUser,
  setStoredUser,
  getStoredUser,
} from "./tokenStore";
import { apiFetch } from "./apiClient";
import { setCurrentAlias } from "./userStore";

const LOG = "[AuthSvc]";

/**
 * @typedef {Object} User
 * @property {string} userId
 * @property {string} email
 * @property {"CITIZEN" | "OFFICER"} role
 * @property {string} alias
 * @property {string} rut
 */

export async function storeUser(user) {
  if (user?.alias) setCurrentAlias(user.alias);
  await setStoredUser(user);
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
export async function login(email, password) {
  console.log(`${LOG} login: ${email}`);
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error("Respuesta de autenticación inválida");
  }

  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} rut
 * @param {string} alias
 */
export async function register(email, password, rut, alias) {
  console.log(`${LOG} register: ${email}`);
  const data = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, rut, alias }),
  });

  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error("Respuesta de registro inválida");
  }

  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout() {
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();
  try {
    if (refreshToken) {
      await apiFetch(
        "/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        },
        accessToken
      );
    }
  } catch (e) {
    console.warn(`${LOG} logout request failed:`, e.message);
  } finally {
    await clearTokens();
    await clearStoredUser();
    setCurrentAlias(null);
  }
}

export async function refresh() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error("No hay sesión activa");
  }

  const data = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error("Respuesta de refresh inválida");
  }

  await setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function isAuthenticated() {
  const token = await getAccessToken();
  return !!token;
}

export async function getToken() {
  return getAccessToken();
}

export async function getUser() {
  return getStoredUser();
}

export async function isOfficer() {
  const user = await getStoredUser();
  return user?.role === "OFFICER";
}

/**
 * Parse a JWT payload without verification.
 * @param {string} token
 * @returns {object|null}
 */
function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Hydrate local user state from the current access token.
 * Useful on app startup before fetching profile.
 */
export async function hydrateUserFromToken() {
  const token = await getAccessToken();
  if (!token) return null;
  const payload = parseJwt(token);
  if (!payload?.sub) return null;

  const existing = await getStoredUser();
  const user = {
    userId: payload.sub,
    email: payload.email || existing?.email || "",
    role: payload.role || existing?.role || "CITIZEN",
    alias: existing?.alias || "",
    rut: existing?.rut || "",
  };
  await storeUser(user);
  return user;
}
