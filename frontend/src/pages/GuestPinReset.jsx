import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppTopbar from "../components/AppTopbar.jsx";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n.js";

export default function GuestPinReset() {
  const { token: routeToken } = useParams();
  const { t } = useLanguage();
  const [token, setToken] = useState(routeToken || "");
  const [form, setForm] = useState({ newPin: "", confirmPin: "" });
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  async function submit(event) {
    event.preventDefault();
    setStatus({ loading: true, error: "", success: false });
    if (!token.trim()) return setStatus({ loading: false, error: t("security.recoveryLinkRequired"), success: false });
    if (form.newPin !== form.confirmPin) return setStatus({ loading: false, error: t("security.pinMismatch"), success: false });
    try {
      await api("/api/public/guest/reset-pin", {
        method: "POST",
        body: JSON.stringify({ token: token.trim(), ...form })
      });
      setForm({ newPin: "", confirmPin: "" });
      setStatus({ loading: false, error: "", success: true });
    } catch (error) {
      setStatus({ loading: false, error: error.message || t("security.pinResetFailed"), success: false });
    }
  }

  return (
    <>
      <AppTopbar variant="public" />
      <main className="page-shell flex min-h-[80vh] items-center justify-center pb-10">
        <section className="card w-full max-w-xl p-6">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.guestSupport")}</p>
          <h1 className="mt-3 text-3xl font-black font-serif">{t("security.resetGuestPin")}</h1>
          <p className="mt-2 text-slatebody">{t("security.forgotPinExplanation")}</p>
          {status.success ? (
            <div className="mt-5">
              <p className="text-green-400" role="status">{t("security.pinResetComplete")}</p>
              <Link className="btn-primary mt-4" to="/guest">{t("hardcoded.resumeExistingGuestSession")}</Link>
            </div>
          ) : (
            <form className="mt-5 grid gap-3" onSubmit={submit}>
              {!routeToken ? <input className="field" name="recoveryToken" required placeholder={t("security.recoveryLinkOrToken")} value={token} onChange={(event) => setToken(event.target.value)} /> : null}
              <input className="field" name="newPin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder={t("security.newPin")} value={form.newPin} onChange={(event) => setForm((value) => ({ ...value, newPin: event.target.value }))} />
              <input className="field" name="confirmPin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder={t("security.confirmPin")} value={form.confirmPin} onChange={(event) => setForm((value) => ({ ...value, confirmPin: event.target.value }))} />
              {status.error ? <p className="text-red-400" role="alert">{status.error}</p> : null}
              <button className="btn-primary" disabled={status.loading}>{status.loading ? t("common.loading") : t("security.resetGuestPin")}</button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
