import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Globe2, ArrowLeft, Camera } from "lucide-react";
import { LANGUAGES, useLanguage } from "../lib/i18n";
import { getTheme, setTheme } from "../lib/theme";
import ThemeToggleButton from "./ThemeToggleButton";
import { APP_NAME } from "../lib/appConfig.js";

export default function AppTopbar({ variant = "public" }) {
  const { t, language, setLanguage } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const [theme, setThemeState] = useState(getTheme() || "light");
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function onThemeChanged(e) {
      setThemeState(e?.detail?.theme || getTheme() || "light");
    }
    window.addEventListener("travelShareThemeChanged", onThemeChanged);
    return () => window.removeEventListener("travelShareThemeChanged", onThemeChanged);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <header className="app-topbar app-topbar-public sticky top-0 z-40 border-b border-borderline bg-sand">
      <div className="page-shell flex items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {location.pathname !== "/" && !location.pathname.startsWith("/dashboard") && (
            <button className="btn-ghost shrink-0" onClick={() => navigate(-1)} aria-label={t('shell.goBack', 'Go back')}>
              <ArrowLeft size={17} /> {t('shell.back', 'Back')}
            </button>
          )}
          <Link to={variant === 'public' ? '/' : '/dashboard'} className="flex min-w-0 items-center gap-2 font-serif text-xl font-black text-primary">
            <Camera size={22} />
            <span className="truncate">{APP_NAME}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggleButton />

          {/* language globe dropdown */}
          <div className="relative">
            <button className="btn-ghost topbar-icon-button language-trigger h-10 w-10 flex items-center justify-center rounded-xl" aria-haspopup="menu" aria-expanded={langOpen} onClick={() => setLangOpen((s) => !s)} aria-label={t('shell.changeLanguage', 'Change language')} title={t('shell.changeLanguage', 'Change language')}>
              <Globe2 className="topbar-globe-icon" size={18} strokeWidth={2.25} aria-hidden="true" />
            </button>
            {langOpen && (
              <div className="lang-menu">
                {LANGUAGES.map(([code, label]) => (
                  <button
                    key={code}
                    className={`lang-option ${language === code ? 'lang-option-active' : ''}`}
                    onClick={() => { setLanguage(code); setLangOpen(false); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* auth CTAs for public variant */}
          {variant === 'public' ? (
            <>
              <Link className="btn-ghost" to="/login">{t('shell.login', 'Login')}</Link>
              <Link className="btn-primary btn-signup" to="/signup">
                {t('shell.signUp', 'Sign up')}
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
