import {
  getAccessToken,
  setTokens,
  getRefreshToken,
  clearTokens,
  clearStoredUser,
} from "./tokenStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

const LOG = "[ApiClient]";

/**
 * @param {string} path
 * @param {RequestInit} options
 * @param {string | null} token
 */
export async function apiFetch(path, options = {}, token = null) {
  const authToken = token ?? (await getAccessToken());
  const response = await rawFetch(path, options, authToken);

  if (response.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = await getAccessToken();
      return rawFetch(path, options, newToken).then(handleResponse);
    }
    await clearTokens();
    await clearStoredUser();
    const error = new Error("Sesión expirada");
    error.status = 401;
    throw error;
  }

  return handleResponse(response);
}

async function rawFetch(path, options, token) {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

async function handleResponse(response) {
  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

let refreshPromise = null;

async function tryRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return false;

    try {
      const url = `${API_URL}/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await response.json();
      if (!response.ok || !data?.accessToken || !data?.refreshToken) {
        return false;
      }
      await setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (e) {
      console.warn(`${LOG} refresh failed:`, e.message);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export { API_URL };
