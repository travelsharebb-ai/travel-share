import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import MediaCard from "../components/MediaCard";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

export default function Approvals() {
  const { language, t } = useLanguage();
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api("/api/uploads/pending-approvals")
      .then((data) => setUploads(Array.isArray(data.uploads) ? data.uploads : []))
      .catch(() => setError("load"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function moderate(uploadId, action) {
    setBusyId(uploadId);
    setError("");
    try {
      await api(`/api/uploads/${uploadId}/${action}`, { method: "PATCH" });
      setUploads((current) => current.filter((upload) => upload.id !== uploadId));
    } catch (err) {
      setError("moderate");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("approvals.badge", "Approvals")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("approvals.title", "Approvals / Pending Uploads")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("approvals.description", "Approve or reject guest uploads before they appear in public or shared spaces.")}</p>
      </section>

      {error ? <section className="card p-5 text-red-400">{error === "moderate" ? t("approvals.moderationError") : t("approvals.error")}</section> : null}

      {loading ? (
        <section className="card p-5 text-slatebody">{t("approvals.loading", "Loading pending uploads...")}</section>
      ) : uploads.length === 0 ? (
        <section className="card p-6 text-slatebody">
          <p className="font-semibold">{t("approvals.emptyTitle", "No pending uploads.")}</p>
          <p className="mt-2">{t("approvals.emptyDescription", "Uploads waiting for approval will appear here.")}</p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {uploads.map((upload) => (
            <article key={upload.id} className="space-y-3">
              <MediaCard upload={upload} />
              <div className="card p-4 text-sm text-slatebody">
                <p className="font-semibold">{upload.trip?.title || upload.event?.title || t("approvals.unlinked", "Unlinked upload")}</p>
                <p className="mt-1">{new Date(upload.createdAt).toLocaleString(language)}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button className="btn-primary" type="button" disabled={busyId === upload.id} onClick={() => moderate(upload.id, "approve")}>
                    <Check size={16} />
                    {t("common.approveAndSave", "Approve")}
                  </button>
                  <button className="btn-ghost" type="button" disabled={busyId === upload.id} onClick={() => moderate(upload.id, "reject")}>
                    <X size={16} />
                    {t("common.reject", "Reject")}
                  </button>
                </div>
                {upload.tripId ? <Link className="mt-3 inline-flex text-primary" to={`/trips/${upload.tripId}`}>{t("trips.openTrip", "Open trip")}</Link> : null}
                {upload.eventId ? <Link className="mt-3 inline-flex text-primary" to={`/events/${upload.eventId}`}>{t("events.openEvent", "Open event")}</Link> : null}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
