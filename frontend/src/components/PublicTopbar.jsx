import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { getTheme, setTheme } from "../lib/theme";
import { useLanguage } from "../lib/i18n";

export default function PublicTopbar({ showBack }) {
  const { t, language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = typeof window !== "undefined" ? getTheme() : "light";

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  function onChangeLanguage(e) {
    setLanguage(e.target.value);
  }

  const onBack = () => {
    if (showBack) navigate(-1);
  };

  const onLogin = () => navigate("/login");
  const onSignup = () => navigate("/signup");

  const isLogin = location.pathname === "/login";
  const isSignup = location.pathname === "/signup";

  return (
    <header className="w-full border-b border-borderline bg-transparent">
      <div className="container mx-auto flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-4">
          {showBack ? (
            <button className="btn-ghost p-2" onClick={onBack} aria-label={t("shell.goBack", t("common.back"))}>{t("common.back")}</button>
          ) : null}
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className={`rounded-full p-2 ${theme === "dark" ? "bg-purple-700 text-white" : "bg-aqua-50 text-teal-700"}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <span className={`font-bold text-lg ${theme === "dark" ? "text-white" : "text-navy-900"}`}>TravelShare</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <select aria-label={t("shell.changeLanguage", "Change language")} value={language} onChange={onChangeLanguage} className="field h-9">
            <option value="en">EN</option>
            <option value="es">ES</option>
            <option value="fr">FR</option>
            <option value="pt">PT</option>
            <option value="de">DE</option>
            <option value="it">IT</option>
            <option value="nl">NL</option>
            <option value="ar">AR</option>
            <option value="hi">HI</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
          </select>

          <button className="btn-ghost p-2" onClick={toggleTheme} aria-label={t("shell.toggleTheme", "Toggle theme")}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {!isLogin && (
            <button className="btn-ghost" onClick={onLogin}>{t("shell.login", "Login")}</button>
          )}

          {!isSignup && (
            <button className="btn-primary" onClick={onSignup}>{t("shell.signUp", "Sign up")}</button>
          )}
        </div>
      </div>
    </header>
  );
}
