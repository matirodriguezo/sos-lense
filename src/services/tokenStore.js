import * as SecureStore from "expo-secure-store";

const KEYS = {
  accessToken: "sos_access_token",
  refreshToken: "sos_refresh_token",
  user: "sos_user",
};

export async function setTokens(accessToken, refreshToken) {
  await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(KEYS.accessToken);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(KEYS.refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(KEYS.accessToken);
  await SecureStore.deleteItemAsync(KEYS.refreshToken);
}

export async function setStoredUser(user) {
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
}

export async function getStoredUser() {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearStoredUser() {
  await SecureStore.deleteItemAsync(KEYS.user);
}
