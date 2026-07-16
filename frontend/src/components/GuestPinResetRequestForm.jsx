import { useState } from "react";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n.js";

export default function GuestPinResetRequestForm({ initialGuestName = "", compact = false }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    guestName: initialGuestName,
    contactEmail: "",
    contactNote: "",
    contextNote: "",
    message: ""
  });
  const [status, setStatus] = useState({ loading: false, error: "", success: "" });

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.contactEmail.trim() && !form.contactNote.trim()) {
      setStatus({ loading: false, error: t("security.resetRequests.contactRequired"), success: "" });
      return;
    }
    setStatus({ loading: true, error: "", success: "" });
    try {
      await api("/api/public/guest/pin-reset-requests", {
        method: "POST",
        body: JSON.stringify(form)
      });
      setForm((current) => ({ ...current, contactEmail: "", contactNote: "", contextNote: "", message: "" }));
      setStatus({ loading: false, error: "", success: t("security.resetRequests.guestSent") });
    } catch (error) {
      setStatus({ loading: false, error: error.message || t("security.resetRequests.failed"), success: "" });
    }
  }

  return (
    <form className={compact ? "grid gap-3" : "mt-4 grid max-w-2xl gap-3"} onSubmit={submit}>
      <input className="field" name="resetGuestName" autoComplete="name" minLength={2} maxLength={120} required placeholder={t("security.resetRequests.guestName")} value={form.guestName} onChange={(event) => update("guestName", event.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" name="resetContactEmail" type="email" autoComplete="email" maxLength={254} placeholder={t("security.resetRequests.contactEmail")} value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} />
        <input className="field" name="resetContactNote" maxLength={500} placeholder={t("security.resetRequests.contactNote")} value={form.contactNote} onChange={(event) => update("contactNote", event.target.value)} />
      </div>
      <input className="field" name="resetContextNote" maxLength={500} placeholder={t("security.resetRequests.contextNote")} value={form.contextNote} onChange={(event) => update("contextNote", event.target.value)} />
      <textarea className="field min-h-28" name="resetMessage" minLength={5} maxLength={1000} required placeholder={t("security.resetRequests.message")} value={form.message} onChange={(event) => update("message", event.target.value)} />
      <p className="text-sm text-slatebody">{t("security.resetRequests.guestHelp")}</p>
      {status.error ? <p className="text-sm text-red-400" role="alert">{status.error}</p> : null}
      {status.success ? <p className="text-sm text-green-400" role="status">{status.success}</p> : null}
      <button className="btn-primary justify-self-start" disabled={status.loading}>{status.loading ? t("common.loading") : t("security.resetRequests.submitGuest")}</button>
    </form>
  );
}
