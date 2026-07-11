import { useLanguage } from "../lib/i18n";
import { useState } from "react";
import AppTopbar from "../components/AppTopbar";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <AppTopbar variant="public" />
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="font-serif text-3xl font-black">{t("hardcoded.resetYourPassword")}</h1>
          
          <input 
            className="field" 
            type="email" 
            placeholder={t("settingsPage.email")} 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          
          {message && (
            <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-trust">{message}</p>
          )}
          
          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>
          )}
          
          <button className="btn-primary w-full">{t("hardcoded.sendResetLink")}</button>
        </form>
      </main>
    </>
  );
}