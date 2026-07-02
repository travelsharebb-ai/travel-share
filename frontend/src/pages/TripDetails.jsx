import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MediaCard from "../components/MediaCard.jsx";
import { api, currentUser, getToken } from "../lib/api.js";

export default function TripDetails() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [skinOptions, setSkinOptions] = useState([]);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    api(`/api/trips/${tripId}`)
      .then((data) => {
        if (!active) return;
        setTrip(data.trip || null);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setTrip(null);
        setError(err.message || "Unable to load trip details.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tripId]);

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
  }, [tripId]);

  async function handleApplySkin(uploadId, skinId) {
    setFeedback("");
    try {
      const data = await api(`/api/uploads/${uploadId}/skin`, {
        method: "PATCH",
        body: JSON.stringify({ skinId })
      });
      setTrip((current) => {
        if (!current) return current;
        return {
          ...current,
          uploads: current.uploads.map((upload) => (upload.id === uploadId ? { ...upload, ...data.upload } : upload))
        };
      });
      setFeedback(skinId ? "Frame applied to this upload." : "Frame removed from this upload.");
    } catch (err) {
      setFeedback(err.message || "Unable to update frame.");
    }
  }

  const stats = useMemo(() => {
    if (!trip) return { uploads: 0, chapters: 0, locations: 0, shares: 0 };
    const locations = trip.uploads.filter((upload) => upload.latitude || upload.approximateLatitude).length;
    return {
      uploads: trip._count?.uploads || trip.uploads.length || 0,
      chapters: trip.chapters?.length || 0,
      locations,
      shares: trip.shareLinks?.length || 0
    };
  }, [trip]);

  const gallery = trip?.uploads.slice(0, 4) || [];
  const timeline = trip?.chapters || [];
  const locationSample = trip?.uploads.find((upload) => upload.locationName || upload.region) || null;
  const shareLink = trip?.shareLinks?.[0] || null;
  const user = currentUser();
  const canApplySkin = Boolean(getToken()) && user?.role !== "guest";

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Trip album</p>
          <h1 className="mt-3 text-4xl font-black font-serif">{loading ? "Loading trip…" : trip?.title || "Trip details"}</h1>
          <p className="mt-4 max-w-2xl text-slatebody leading-7">
            {loading
              ? "Fetching moments and memory cards."
              : trip
              ? `Destination ${trip.destination || "unknown"} · ${stats.uploads} memories collected.`
              : error}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-primary" to={`/trips/${tripId}/upload`}>
            Upload Memory
          </Link>
          <Link className="btn-ghost" to="/scan">
            Scan QR
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Stats</p>
          <div className="mt-5 space-y-4">
            {[
              { label: "Memories", value: stats.uploads },
              { label: "Chapters", value: stats.chapters },
              { label: "Locations", value: stats.locations },
              { label: "Share links", value: stats.shares }
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{item.label}</p>
                <p className="mt-3 text-3xl font-black">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-3 grid gap-4">
          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Gallery preview</p>
            {feedback ? <p className="mt-3 text-sm text-emerald-300">{feedback}</p> : null}
            {loading ? (
              <p className="mt-4 text-slatebody">Loading gallery…</p>
            ) : gallery.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
                {gallery.map((upload) => (
                  <MediaCard
                    key={upload.id}
                    upload={upload}
                    skinOptions={skinOptions}
                    onApplySkin={handleApplySkin}
                    canApplySkin={canApplySkin}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-3xl border border-borderline bg-slate-950/70 p-6 text-slatebody">
                No memories have been added to this trip yet.
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">Timeline</p>
              {loading ? (
                <p className="mt-4 text-slatebody">Loading timeline…</p>
              ) : timeline.length ? (
                <div className="mt-5 space-y-3">
                  {timeline.map((chapter) => (
                    <div key={chapter.id} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                      <p className="font-semibold">{chapter.title}</p>
                      {chapter.note && <p className="mt-2 text-slatebody text-sm">{chapter.note}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-slatebody">No timeline chapters are available yet.</p>
              )}
            </div>

            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">Map & location</p>
              <div className="mt-5 space-y-3 text-slatebody">
                {loading ? (
                  <p>Loading location details…</p>
                ) : locationSample ? (
                  <>
                    <p className="font-semibold">{locationSample.locationName || locationSample.region || "Travel memory"}</p>
                    <p>{locationSample.latitude || locationSample.approximateLatitude ? "Location data is available." : "Location is hidden."}</p>
                  </>
                ) : (
                  <p>No visible locations were recorded for this trip yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">Share album</p>
            <div className="mt-5 rounded-3xl border border-borderline bg-slate-950/70 p-5 text-slatebody">
              {loading ? (
                <p>Loading share links…</p>
              ) : shareLink ? (
                <>
                  <p className="font-semibold">Share link ready</p>
                  <p className="mt-3 break-all text-sm">{`${window.location.origin}/share/${shareLink.token}`}</p>
                </>
              ) : (
                <>
                  <p>No album share links created yet.</p>
                  <p className="mt-3 text-sm">Use the backend share link API to create an album share link when ready.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// No additional helper components needed for this page.