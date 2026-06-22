const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

export function getToken() {
  return localStorage.getItem("travelShareToken");
}

export function getGuestToken() {
  return localStorage.getItem("travelShareGuestToken");
}

export function setGuestToken(token) {
  if (!token) return localStorage.removeItem("travelShareGuestToken");
  localStorage.setItem("travelShareGuestToken", token);
}

export function clearGuestToken() {
  localStorage.removeItem("travelShareGuestToken");
}

export function setSession(data) {
  localStorage.setItem("travelShareToken", data.token);
  localStorage.setItem("travelShareUser", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem("travelShareToken");
  localStorage.removeItem("travelShareUser");
}

export function currentUser() {
  const raw = localStorage.getItem("travelShareUser");
  return raw ? JSON.parse(raw) : null;
}

export function updateStoredUser(user) {
  if (!user) return;
  localStorage.setItem("travelShareUser", JSON.stringify(user));
}

export async function api(path, options = {}) {
  const token = getToken();
  const guestToken = getGuestToken();
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  // If a guest token exists and caller didn't already set an explicit x-guest-token header, include it
  if (guestToken && !(options.headers && options.headers["x-guest-token"])) {
    headers["x-guest-token"] = guestToken;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  const res = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", signal: controller.signal, headers: { ...headers, ...options.headers } }).finally(() => window.clearTimeout(timeout));
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || "Request failed.");
  return data;
}

export { API_URL };
