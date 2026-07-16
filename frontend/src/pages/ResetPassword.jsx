import { useLanguage } from "../lib/i18n";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppTopbar from "../components/AppTopbar";
import { api } from "../lib/api.js";

export default function ResetPassword() {
  const { t } = useLanguage();
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const strongPassword = password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  const canSubmit = strongPassword && password === confirm;

  async function submit(event) {
    event.preventDefault();
    setStatus({ loading: true, error: "", success: false });
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword: confirm })
      });
      setPassword("");
      setConfirm("");
      setStatus({ loading: false, error: "", success: true });
    } catch (error) {
      setStatus({ loading: false, error: error.message || t("security.passwordChangeFailed"), success: false });
    }
  }

  return (
    <>
      <AppTopbar variant="public" />
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="card w-full max-w-md p-6 bg-slate-950/90 border border-white/10 space-y-5">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.resetPassword")}</p>
          <h1 className="mt-3 text-4xl font-black font-serif">{t("hardcoded.createANewPassword")}</h1>
          <p className="mt-3 text-slatebody">{t("hardcoded.secureYourAccountAndSignInWithYour")}</p>
        </div>

        <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-3">
          <label htmlFor="reset-password-new" className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t("hardcoded.newPassword")}</label>
          <input
            id="reset-password-new"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>

        <div className="space-y-3">
          <label htmlFor="reset-password-confirm" className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t("hardcoded.confirmPassword")}</label>
          <input
            id="reset-password-confirm"
            name="confirmPassword"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field w-full"
            autoComplete="new-password"
            minLength={10}
            required
          />
        </div>

        {password && !strongPassword && <p className="text-sm text-red-400">{t("security.passwordRequirements")}</p>}
        {confirm && password !== confirm && <p className="text-sm text-red-400">{t("hardcoded.passwordsDoNotMatch")}</p>}
        {status.error ? <p className="text-sm text-red-400" role="alert">{status.error}</p> : null}
        {status.success ? <p className="text-sm text-green-400" role="status">{t("security.passwordChanged")}</p> : null}

        <button type="submit" disabled={!canSubmit || status.loading} className="btn-primary w-full">{status.loading ? t("common.loading") : t("hardcoded.resetPassword")}</button>
        </form>

        <Link to="/login" className="btn-ghost w-full text-center">{t("hardcoded.backToLogin")}</Link>
      </section>
    </main>
    </>
  );
}

// Styles are handled by the old Travel Share CSS classes.
