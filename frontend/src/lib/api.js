const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

export function getToken() {
  return localStorage.getItem("travelShareToken");
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

export async function api(path, options = {}) {
  const token = getToken();
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || "Request failed.");
  return data;
}

export { API_URL };
