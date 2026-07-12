import { useEffect, useState } from "react";
import AppTopbar from "../components/AppTopbar";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, currentUser, getToken, getGuestToken, setSession } from "../lib/api";
import { useLanguage } from "../lib/i18n";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function AuthPage({ mode }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [errorKey, setErrorKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    setErrorKey("");
    try {
      const payload = { ...form };
      if (isSignup) {
        const guestToken = getGuestToken();
        if (guestToken) payload.guestToken = guestToken;
      }
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, { method: "POST", body: JSON.stringify(payload) });
      setSession(data);
      const fallback = ["admin", "platform_admin"].includes(data.user?.role) ? "/admin" : data.user?.role === "organizer" ? "/events" : "/dashboard";
      const intended = location.state?.from?.pathname;
      if (intended && intended !== "/login" && intended !== "/signup") {
        navigate(intended, { replace: true });
      } else {
        navigate(fallback, { replace: true });
      }
    } catch (err) {
      setErrorKey("submit");
    }
  }

  useEffect(() => {
    if (getToken() && currentUser()) {
      const role = currentUser()?.role;
      const redirect = ["admin", "platform_admin"].includes(role) ? "/admin" : role === "organizer" ? "/events" : "/dashboard";
      navigate(redirect, { replace: true });
    }
  }, [navigate]);

  async function oauth(provider) {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  }

  return (
    <>
      <AppTopbar variant="public" />
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="font-serif text-3xl font-black">{isSignup ? t("authPage.createAccountTitle") : t("authPage.welcomeBack")}</h1>
          
          {isSignup && (
            <input 
              className="field" 
              placeholder={t("authPage.namePlaceholder")} 
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
            />
          )}
          
            <input 
              className="field" 
              type="email" 
              placeholder={t("authPage.emailPlaceholder")} 
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
            />
          
          <div className="relative">
            <input 
              className="field pr-14" 
              type={showPassword ? "text" : "password"} 
              placeholder={t("authPage.passwordPlaceholder")} 
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
            />
            <button 
              type="button" 
              aria-label={showPassword ? t("authPage.hidePassword") : t("authPage.showPassword")} 
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-report hover:bg-skysoft" 
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          
          {errorKey && (
            <p className="break-words rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{t("authPage.error")}</p>
          )}
          
            <button className="btn-primary w-full" type="submit">
              {isSignup ? t("authPage.signUpButton") : t("authPage.loginButton")}
            </button>
          
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-ghost" onClick={() => oauth("google")}> 
              {t("authPage.google")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => oauth("microsoft")}> 
              {t("authPage.microsoft")}
            </button>
          </div>
          
          {!isSignup && (
            <Link className="block text-center text-sm font-bold text-primary" to="/forgot-password">
              {t("authPage.forgotPassword")}
            </Link>
          )}
          
          <div className="border-t border-borderline pt-4 text-center">
            <Link to={isSignup ? "/login" : "/signup"} className="text-sm font-bold text-primary">
              {isSignup ? t("authPage.alreadyHaveAccount") : t("authPage.newToTravelShare")}
            </Link>
          </div>
          
          <Link to="/guest" className="block">
            <button type="button" className="btn-secondary w-full">
              {t("authPage.continueAsGuest")}
            </button>
          </Link>
          
          <div className="border-t border-borderline pt-4 text-center text-sm text-slatebody">
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/privacy" className="text-primary hover:underline font-bold">
                {t("authPage.privacy")}
              </Link>
              <span>•</span>
              <Link to="/terms" className="text-primary hover:underline font-bold">
                {t("authPage.terms")}
              </Link>
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
