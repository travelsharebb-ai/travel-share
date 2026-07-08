import { useLanguage } from "../lib/i18n";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppTopbar from "../components/AppTopbar";

export default function ResetPassword() {
  const { t } = useLanguage();
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const canSubmit = password.length >= 8 && password === confirm;

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

        <div className="space-y-3">
          <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t("hardcoded.newPassword")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field w-full bg-slate-950/70 text-white"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t("hardcoded.confirmPassword")}</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field w-full bg-slate-950/70 text-white"
          />
        </div>

        {password && password.length < 8 && <p className="text-sm text-red-400">{t("hardcoded.passwordMustBeAtLeast8Characters")}</p>}
        {confirm && password !== confirm && <p className="text-sm text-red-400">{t("hardcoded.passwordsDoNotMatch")}</p>}

        <button disabled={!canSubmit} className="btn-primary w-full">{t("hardcoded.resetPassword")}</button>

        <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody text-sm">
          <span className="font-semibold">{t("hardcoded.token")}</span>
          <p className="mt-2 break-words">{token}</p>
        </div>

        <Link to="/login" className="btn-ghost w-full text-center">{t("hardcoded.backToLogin")}</Link>
      </section>
    </main>
    </>
  );
}

// Styles are handled by the old Travel Share CSS classes.