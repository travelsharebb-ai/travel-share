import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n.js";
import { Link } from "react-router-dom";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api } from "../../lib/api.js";

export default function AdminModeration() {
  const { t } = useLanguage();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState("");
  const [status, setStatus] = useState("reported");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/admin/moderation?status=${encodeURIComponent(status)}&limit=100`);
      setUploads(Array.isArray(data.uploads) ? data.uploads : []);
    } catch (err) {
      setError(err.message || t("admin.moderation.error", "Unable to load moderation items."));
    } finally {
      setLoading(false);
    }
  }, [status, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function moderate(upload, action) {
    if (["reject", "hide"].includes(action) && !window.confirm(t(`admin.moderation.confirm${action === "reject" ? "Reject" : "Hide"}`, action === "reject" ? "Reject this upload?" : "Hide this upload from the map?"))) return;
    try {
      await api(`/api/admin/map/uploads/${upload.id}/moderation`, { method: "PATCH", body: JSON.stringify({ action }) });
      setSuccess(t("admin.moderation.actionComplete", "Moderation action completed."));
      await load();
    } catch (err) {
      setError(err.message || t("admin.moderation.genericFailed", "Action failed."));
    }
  }

  return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.moderation.badge", "Admin moderation")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.moderation.title", "Review flagged activity")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t("admin.moderation.description", "See uploads that need review and verify that reported content is handled correctly.")}
          </p>
        </section>

        <section className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <label className="text-sm text-slatebody">{t("admin.moderation.filter", "Content status")}<select className="input mt-1 block min-w-48" value={status} onChange={(event) => setStatus(event.target.value)}><option value="reported">{t("admin.moderation.reported", "Reported")}</option><option value="pending">{t("admin.moderation.pending", "Pending")}</option><option value="approved">{t("admin.moderation.approved", "Approved")}</option><option value="rejected">{t("admin.moderation.rejected", "Rejected")}</option><option value="all">{t("admin.moderation.all", "All content")}</option></select></label>
          <button className="btn-ghost" onClick={load} disabled={loading}>{t("common.refresh", "Refresh")}</button>
        </section>
        {success ? <div className="card border border-emerald-500 p-4 text-emerald-200" role="status">{success}</div> : null}

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.moderation.loading", "Loading moderation items…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">{t("common.error", "Error")}: {error}</div>
        ) : uploads.length === 0 ? (
          <div className="card p-5 text-slatebody">{t("admin.moderation.empty", "No reported uploads found. The moderation queue is empty.")}</div>
        ) : (
          <div className="space-y-4">
            {uploads.map((upload) => (
              <div key={upload.id} className="card border border-borderline bg-slate-950/90 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.moderation.uploadLabel", "Upload")}</p>
                      <p className="mt-2 text-lg font-semibold text-white">{upload.caption || t("admin.moderation.untitledUpload", "Untitled upload")}</p>
                  </div>
                  <p className="rounded-full bg-skysoft px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-950">{upload.status}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                    <p className="text-sm uppercase tracking-[0.28em] text-slatebody">{t("admin.moderation.location", "Location")}</p>
                    <p className="mt-2 text-white">{upload.locationName || t("admin.moderation.unknown", "Unknown")}</p>
                  </div>
                  <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                    <p className="text-sm uppercase tracking-[0.28em] text-slatebody">{t("admin.moderation.trip", "Trip")}</p>
                    <p className="mt-2 text-white">{upload.trip?.title || t("admin.moderation.noTripDetails", "No trip details")}</p>
                    <p className="text-sm text-slatebody">{upload.trip?.destination || t("admin.moderation.noDestination", "No destination")}</p>
                  </div>
                </div>
                <div className="mt-4 text-slatebody text-sm">
                  <p><strong>{t("admin.moderation.uploaded", "Uploaded")}</strong>: {upload.createdAt ? new Date(upload.createdAt).toLocaleString() : t("admin.moderation.unknown", "Unknown")}</p>
                  <p><strong>{t("admin.moderation.moderationStatus", "Moderation status")}</strong>: {upload.moderationStatus || t("admin.moderation.pending", "Pending")}</p>
                  {upload.reportReason ? <p><strong>{t("admin.moderation.reportReason", "Report reason")}</strong>: {upload.reportReason}</p> : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                   <button className="btn-primary" onClick={() => moderate(upload, "approve")}>{t("admin.moderation.approve", "Approve")}</button>
                   <button className="btn-ghost" onClick={() => moderate(upload, "reject")}>{t("admin.moderation.reject", "Reject")}</button>
                   <button className="btn-ghost" onClick={() => moderate(upload, "hide")}>{t("admin.moderation.hide", "Hide")}</button>
                   <button className="btn-ghost" onClick={() => moderate(upload, "unhide")}>{t("admin.moderation.unhide", "Unhide")}</button>
                   <button className="btn-ghost" onClick={async () => {
                    if (!window.confirm(t("admin.moderation.confirmDeleteUpload", "Delete this upload permanently?"))) return;
                    try {
                      await api(`/api/admin/moderation/${upload.id}`, { method: 'DELETE' });
                      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
                      setSuccess(t("admin.moderation.deleted", "Upload deleted."));
                      } catch (err) { setError(err.message || t('admin.moderation.genericFailed', 'Action failed.')); }
                   }}>{t("admin.moderation.delete", "Delete")}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.moderation.backToAdminTools","Back to admin tools")}</Link>
          <Link className="btn-primary w-full" to="/admin/reports">{t("admin.moderation.openReports","Open reports")}</Link>
        </div>
      </main>
  );
}
