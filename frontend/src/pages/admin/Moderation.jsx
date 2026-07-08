import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n.js";
import { Link } from "react-router-dom";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api } from "../../lib/api.js";

export default function AdminModeration() {
  const { t } = useLanguage();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api("/api/admin/moderation");
        if (!mounted) return;
        setUploads(Array.isArray(data.uploads) ? data.uploads : []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load moderation items.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.moderation.badge", "Admin moderation")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.moderation.title", "Review flagged activity")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t("admin.moderation.description", "See uploads that need review and verify that reported content is handled correctly.")}
          </p>
        </section>

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.moderation.loading", "Loading moderation items…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">Error: {error}</div>
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
                    <p className="mt-2 text-white">{upload.locationName || "Unknown location"}</p>
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
                </div>
                <div className="mt-4 flex gap-2">
                   <button className="btn-primary" onClick={async () => {
                    try {
                      const resp = await api(`/api/uploads/${upload.id}/approve`, { method: 'PATCH' });
                      setUploads((prev) => prev.map((u) => u.id === upload.id ? resp.upload : u));
                      } catch (err) { alert(err.message || t('admin.moderation.genericFailed', 'Failed')); }
                   }}>{t("admin.moderation.approve", "Approve")}</button>
                   <button className="btn-ghost" onClick={async () => {
                    if (!confirm(t("admin.moderation.confirmReject", "Reject this upload?"))) return;
                    try {
                      const resp = await api(`/api/uploads/${upload.id}/reject`, { method: 'PATCH' });
                      setUploads((prev) => prev.map((u) => u.id === upload.id ? resp.upload : u));
                      } catch (err) { alert(err.message || t('admin.moderation.genericFailed', 'Failed')); }
                   }}>{t("admin.moderation.reject", "Reject")}</button>
                   <button className="btn-ghost" onClick={async () => {
                    try {
                      await api(`/api/admin/map/uploads/${upload.id}/moderation`, { method: 'PATCH', body: JSON.stringify({ action: 'hide' }) });
                      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
                      } catch (err) { alert(err.message || t('admin.moderation.genericFailed', 'Failed')); }
                   }}>{t("admin.moderation.hide", "Hide")}</button>
                   <button className="btn-ghost" onClick={async () => {
                    try {
                      await api(`/api/admin/map/uploads/${upload.id}/moderation`, { method: 'PATCH', body: JSON.stringify({ action: 'unhide' }) });
                      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
                      } catch (err) { alert(err.message || t('admin.moderation.genericFailed', 'Failed')); }
                   }}>{t("admin.moderation.unhide", "Unhide")}</button>
                   <button className="btn-ghost" onClick={async () => {
                    if (!confirm(t("admin.moderation.confirmDeleteUpload", "Delete this upload permanently?"))) return;
                    try {
                      await api(`/api/uploads/${upload.id}`, { method: 'DELETE' });
                      setUploads((prev) => prev.filter((u) => u.id !== upload.id));
                      } catch (err) { alert(err.message || t('admin.moderation.genericFailed', 'Failed')); }
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
