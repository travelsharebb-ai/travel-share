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

export function setGuestSession(guestSession = {}) {
  const user = {
    id: "guest",
    name: guestSession.displayName || "Guest",
    email: null,
    role: "guest",
    guestSession
  };
  localStorage.setItem("travelShareUser", JSON.stringify(user));
  try { window.dispatchEvent(new Event('travelShareUserChanged')); } catch (e) {}
}

export function clearGuestSession() {
  clearGuestToken();
  localStorage.removeItem("travelShareUser");
  try { window.dispatchEvent(new Event('travelShareUserChanged')); } catch (e) {}
}

export function hasGuestSession() {
  return Boolean(getGuestToken());
}

export async function validateGuestSession() {
  const guestToken = getGuestToken();
  if (!guestToken) {
    return { valid: false };
  }
  try {
    const data = await api("/api/public/guest/session");
    return data;
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

export async function createGuestSession() {
  try {
    const data = await api("/api/public/guest/session", { method: "POST" });
    return data;
  } catch (err) {
    throw err;
  }
}

export async function createGuestSessionProfile({ displayName, passcode } = {}) {
  try {
    const body = {};
    if (displayName) body.displayName = displayName;
    if (passcode) body.passcode = passcode;
    const data = await api("/api/public/guest/session", { method: "POST", body: JSON.stringify(body) });
    return data;
  } catch (err) {
    throw err;
  }
}

export async function resumeGuestSession({ resumeToken, passcode } = {}) {
  try {
    const data = await api("/api/public/guest/resume", { method: "POST", body: JSON.stringify({ resumeToken, passcode }) });
    return data;
  } catch (err) {
    throw err;
  }
}

export function setSession(data) {
  clearGuestToken();
  localStorage.setItem("travelShareToken", data.token);
  localStorage.setItem("travelShareUser", JSON.stringify(data.user));
}

export function clearSession() {
  localStorage.removeItem("travelShareToken");
  localStorage.removeItem("travelShareUser");
  localStorage.removeItem("travelShareGuestToken");
}

export function currentUser() {
  const raw = localStorage.getItem("travelShareUser");
  return raw ? JSON.parse(raw) : null;
}

export function updateStoredUser(user) {
  if (!user) return;
  localStorage.setItem("travelShareUser", JSON.stringify(user));
  try { window.dispatchEvent(new Event('travelShareUserChanged')); } catch (e) {}
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

export function listQRSpaces() {
  return api("/api/qr-spaces");
}

export function createQRSpace(payload) {
  return api("/api/qr-spaces", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getQRSpace(id) {
  return api(`/api/qr-spaces/${encodeURIComponent(id)}`);
}

export function updateQRSpace(id, payload) {
  return api(`/api/qr-spaces/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteQRSpace(id) {
  return api(`/api/qr-spaces/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export function getQRSpaceQRCode(id) {
  return api(`/api/qr-spaces/${encodeURIComponent(id)}/qr`);
}

export function getStoreItems() {
  return api("/api/store");
}

export function unlockFreeStoreItem(itemId) {
  return api(`/api/store/${encodeURIComponent(itemId)}/purchase`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function checkoutStoreItem(itemId, provider = "stripe") {
  return api(`/api/store/${encodeURIComponent(itemId)}/checkout`, {
    method: "POST",
    body: JSON.stringify({ provider })
  });
}

export function confirmStorePayment(transactionId) {
  return api(`/api/store/payments/${encodeURIComponent(transactionId)}/confirm`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export { API_URL };
