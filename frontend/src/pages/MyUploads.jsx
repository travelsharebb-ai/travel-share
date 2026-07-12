import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import MediaCard from "../components/MediaCard";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

function uploadSource(upload, t) {
  if (upload.trip) return `${t("trips.badge", "Trips")}: ${upload.trip.title || t("trips.untitled", "Untitled trip")}`;
  if (upload.event) return `${t("nav.events", "Events")}: ${upload.event.title || t("events.untitled", "Untitled event")}`;
  return t("myUploads.noSource", "No linked album");
}

export default function MyUploads() {
  const { t } = useLanguage();
  const [uploads, setUploads] = useState([]);
  const [skinOptions, setSkinOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api("/api/uploads/mine")
      .then((data) => {
        if (!active) return;
        setUploads(Array.isArray(data.uploads) ? data.uploads : []);
      })
      .catch((err) => {
        if (!active) return;
        setError("load");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    api("/api/store")
      .then((data) => {
        if (!active) return;
        const unlockedSkins = (data.items || []).filter((item) => item.type === "image_skin" && item.owned);
        setSkinOptions(unlockedSkins);
      })
      .catch(() => {
        if (!active) return;
        setSkinOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleApplySkin(uploadId, skinId) {
    setFeedback("");
    try {
      const data = await api(`/api/uploads/${uploadId}/skin`, {
        method: "PATCH",
        body: JSON.stringify({ skinId })
      });
      setUploads((current) => current.map((upload) => (upload.id === uploadId ? { ...upload, ...data.upload } : upload)));
      setFeedback(skinId ? "applied" : "removed");
    } catch (err) {
      setFeedback("error");
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("myUploads.badge", "Memories")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("myUploads.title", "My Uploads / Memories")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("myUploads.description", "Review media collected across your trips and events.")}</p>
      </section>

      {error ? <section className="card p-5 text-red-400">{t("myUploads.error")}</section> : null}
      {feedback ? <section className="card p-4 text-sm font-semibold text-primary">{feedback === "applied" ? t("myUploads.frameApplied") : feedback === "removed" ? t("myUploads.frameRemoved") : t("myUploads.frameError")}</section> : null}

      {loading ? (
        <section className="card p-5 text-slatebody">{t("myUploads.loading", "Loading memories...")}</section>
      ) : uploads.length === 0 ? (
        <section className="card p-6 text-slatebody">
          <p className="font-semibold">{t("myUploads.emptyTitle", "No uploads yet.")}</p>
          <p className="mt-2">{t("myUploads.emptyDescription", "Uploads from your trips and events will appear here.")}</p>
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {uploads.map((upload) => (
            <div key={upload.id} className="space-y-3">
              <MediaCard upload={upload} skinOptions={skinOptions} onApplySkin={handleApplySkin} />
              <div className="card p-3 text-sm text-slatebody">
                <p className="font-semibold">{uploadSource(upload, t)}</p>
                <p className="mt-1">{t("myUploads.status", "Status")}: {upload.status === "approved" ? t("myUploads.statuses.approved") : upload.status === "rejected" ? t("myUploads.statuses.rejected") : t("myUploads.statuses.pending")}</p>
                {upload.tripId ? <Link className="mt-2 inline-flex text-primary" to={`/trips/${upload.tripId}`}>{t("trips.openTrip", "Open trip")}</Link> : null}
                {upload.eventId ? <Link className="mt-2 inline-flex text-primary" to={`/events/${upload.eventId}`}>{t("events.openEvent", "Open event")}</Link> : null}
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
