import { useEffect } from "react";
import { getStoredThemeMode, applyThemeMode } from "../lib/theme.js";

export default function SessionSync() {
  useEffect(() => {
    // Ensure theme mode logic runs on app start (sun default if no stored mode)
    try {
      applyThemeMode(getStoredThemeMode());
    } catch (err) {
      // fallback: do nothing — theme helpers are best-effort
    }
  }, []);

  return null;
}