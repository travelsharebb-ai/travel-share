import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getTheme, setTheme, setStoredThemeMode, applyThemeMode } from "../lib/theme";
import { useLanguage } from "../lib/i18n";

export default function ThemeToggleButton({ className = "btn-ghost topbar-icon-button h-10 w-10 flex items-center justify-center rounded-xl" }) {
  const { t } = useLanguage();
  const [theme, setThemeState] = useState(getTheme() || "light");
  const toggleLabel = theme === "dark" ? t("shell.switchToLightMode") : t("shell.switchToDarkMode");

  useEffect(() => {
    function onThemeChanged(e) {
      setThemeState(e?.detail?.theme || getTheme() || "light");
    }
    window.addEventListener("travelShareThemeChanged", onThemeChanged);
    return () => window.removeEventListener("travelShareThemeChanged", onThemeChanged);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    // user manually toggled theme -> persist as explicit preference and apply
    try { setStoredThemeMode(next); } catch (e) {}
    try { applyThemeMode(next); } catch (e) {}
    setThemeState(next);
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={toggleLabel}
      title={toggleLabel}
      onClick={toggleTheme}
    >
      {theme === "dark" ? (
        <Moon size={18} strokeWidth={2.25} aria-hidden="true" />
      ) : (
        <Sun size={18} strokeWidth={2.25} aria-hidden="true" />
      )}
    </button>
  );
}
