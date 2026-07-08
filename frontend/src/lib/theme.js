import * as SunCalc from "suncalc";

export const THEME_KEY = "travelShareTheme";
export const MODE_KEY = "travelShareThemeMode"; // 'sun'|'light'|'dark'|'system'
export const SUN_LOCATION_KEY = "travelShareSunLocation"; // optional cached coords

let _sunInterval = null;
let _visibilityHandler = null;
let _systemMql = null;
let _systemListener = null;

const FALLBACK_COORDS = { latitude: 13.1939, longitude: -59.5432 };

export function getStoredThemeMode() {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    if (["sun", "light", "dark", "system"].includes(saved)) return saved;
  } catch (err) {}
  return "sun";
}

export function setStoredThemeMode(mode) {
  try {
    if (["sun", "light", "dark", "system"].includes(mode)) {
      localStorage.setItem(MODE_KEY, mode);
      return true;
    }
    localStorage.removeItem(MODE_KEY);
  } catch (err) {}
  return false;
}

export function getTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === null) return "light"; // keep compatibility
    return t || null;
  } catch (err) {
    return null;
  }
}

export function setTheme(theme) {
  try {
    if (theme) localStorage.setItem(THEME_KEY, theme);
    else localStorage.removeItem(THEME_KEY);
  } catch (err) {}
  applyTheme(theme);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("travelShareThemeChanged", { detail: { theme } }));
  }
}

export function applyTheme(theme) {
  const html = document.documentElement;
  if (!theme) {
    html.removeAttribute("data-theme");
    html.classList.remove("has-active-theme");
    return;
  }
  html.setAttribute("data-theme", theme);
  html.classList.add("has-active-theme");
}

function _safeGetStoredCoords() {
  try {
    const raw = localStorage.getItem(SUN_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") return parsed;
  } catch (err) {}
  return null;
}

function _safeSetStoredCoords(coords) {
  try {
    localStorage.setItem(SUN_LOCATION_KEY, JSON.stringify(coords));
  } catch (err) {}
}

function _getCoordsFromGeolocation(timeout = 5000) {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    let didFinish = false;
    const onSuccess = (pos) => {
      if (didFinish) return;
      didFinish = true;
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      try { _safeSetStoredCoords(coords); } catch (e) {}
      resolve(coords);
    };
    const onError = () => {
      if (didFinish) return;
      didFinish = true;
      resolve(null);
    };
    navigator.geolocation.getCurrentPosition(onSuccess, onError, { maximumAge: 1000 * 60 * 60, timeout });
    // As a safety, ensure resolve after timeout+100ms
    setTimeout(() => {
      if (!didFinish) {
        didFinish = true;
        resolve(null);
      }
    }, timeout + 100);
  });
}

export async function applySunTheme() {
  try {
    const stored = _safeGetStoredCoords();
    let coords = stored || null;
    const geo = await _getCoordsFromGeolocation(5000);
    if (geo) coords = geo;
    if (!coords) coords = FALLBACK_COORDS;

    const now = new Date();
    let times = null;
    try {
      times = SunCalc.getTimes(now, coords.latitude, coords.longitude);
    } catch (err) {
      times = SunCalc.getTimes(now, FALLBACK_COORDS.latitude, FALLBACK_COORDS.longitude);
    }
    const isDaytime = now >= times.sunrise && now < times.sunset;
    if (isDaytime) setTheme("light");
    else setTheme("dark");
  } catch (err) {
    // fallback: ensure theme remains whatever it was or default to light
    if (!getTheme()) setTheme("light");
  }
}

export function startThemeWatcher() {
  stopThemeWatcher();
  // run once immediately
  applySunTheme();
  // interval every 5 minutes
  _sunInterval = setInterval(() => applySunTheme(), 5 * 60 * 1000);

  // visibility change: when tab becomes visible, re-check
  _visibilityHandler = () => {
    if (document.visibilityState === "visible") applySunTheme();
  };
  document.addEventListener("visibilitychange", _visibilityHandler);
}

export function stopThemeWatcher() {
  if (_sunInterval) {
    clearInterval(_sunInterval);
    _sunInterval = null;
  }
  if (_visibilityHandler) {
    document.removeEventListener("visibilitychange", _visibilityHandler);
    _visibilityHandler = null;
  }
}

function _startSystemWatcher() {
  try {
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (_systemMql) {
      _systemMql.removeEventListener?.("change", _systemListener);
      _systemMql = null;
      _systemListener = null;
    }
    _systemMql = window.matchMedia("(prefers-color-scheme: dark)");
    _systemListener = (ev) => {
      setTheme(ev.matches ? "dark" : "light");
    };
    try {
      _systemMql.addEventListener("change", _systemListener);
    } catch (e) {
      // fallback
      _systemMql.addListener(_systemListener);
    }
    // apply immediately
    setTheme(_systemMql.matches ? "dark" : "light");
  } catch (err) {}
}

function _stopSystemWatcher() {
  try {
    if (_systemMql && _systemListener) {
      _systemMql.removeEventListener?.("change", _systemListener);
      try { _systemMql.removeEventListener("change", _systemListener); } catch (e) {}
      try { _systemMql.removeListener(_systemListener); } catch (e) {}
    }
    _systemMql = null;
    _systemListener = null;
  } catch (err) {}
}

export function applyThemeMode(mode) {
  if (!mode) mode = getStoredThemeMode();
  if (mode === "light") {
    stopThemeWatcher();
    _stopSystemWatcher();
    setTheme("light");
    try { setStoredThemeMode("light"); } catch (e) {}
    return;
  }
  if (mode === "dark") {
    stopThemeWatcher();
    _stopSystemWatcher();
    setTheme("dark");
    try { setStoredThemeMode("dark"); } catch (e) {}
    return;
  }
  if (mode === "system") {
    stopThemeWatcher();
    try { setStoredThemeMode("system"); } catch (e) {}
    _startSystemWatcher();
    return;
  }
  // mode === 'sun' (auto)
  try { setStoredThemeMode("sun"); } catch (e) {}
  _stopSystemWatcher();
  startThemeWatcher();
}

export function getResolvedThemeMode() {
  // returns currently applied resolved theme: 'light' or 'dark'
  const t = getTheme();
  if (t === "dark") return "dark";
  return "light";
}

// NOTE: Do not auto-apply theme here on module load. The app should call
// applyThemeMode(getStoredThemeMode()) on startup (SessionSync) so the
// user-mode resolution logic runs.

