import { Copy, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

export default function SharedAlbums() {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [details, setDetails] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");

  function load() {
    setLoading(true);
    setError("");
    api("/api/trips")
      .then(async (data) => {
        const tripList = Array.isArray(data.trips) ? data.trips : [];
        setTrips(tripList);
        setSelectedTripId((current) => current || tripList[0]?.id || "");
        const fullTrips = await Promise.all(
          tripList.map((trip) => api(`/api/trips/${trip.id}`).then((detail) => detail.trip).catch(() => trip))
        );
        setDetails(fullTrips.filter(Boolean));
      })
      .catch((err) => setError(err.message || t("sharedAlbums.error", "Unable to load shared albums.")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const shareLinks = useMemo(() => {
    return details.flatMap((trip) => (trip.shareLinks || []).map((shareLink) => ({ ...shareLink, trip })));
  }, [details]);

  async function createShareLink() {
    if (!selectedTripId) return;
    setCreating(true);
    setError("");
    try {
      await api(`/api/trips/${selectedTripId}/share-links`, { method: "POST", body: JSON.stringify({}) });
      load();
    } catch (err) {
      setError(err.message || t("sharedAlbums.createError", "Unable to create share link."));
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(item) {
    const ok = await copyToClipboard(`${window.location.origin}/share/${item.token}`);
    if (ok) {
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("sharedAlbums.badge", "Sharing")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("sharedAlbums.title", "Shared Albums")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("sharedAlbums.description", "Create and manage public share links for trip albums.")}</p>
      </section>

      <section className="card p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="form-label">{t("sharedAlbums.selectTrip", "Select trip")}</span>
            <select className="field" value={selectedTripId} onChange={(event) => setSelectedTripId(event.target.value)}>
              {trips.length === 0 ? <option value="">{t("trips.emptyTitle", "No trips yet.")}</option> : null}
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>{trip.title || t("trips.untitled", "Untitled trip")}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary inline-flex items-center gap-2" type="button" disabled={creating || !selectedTripId} onClick={createShareLink}>
            <Plus size={18} />
            <span>{creating ? t("sharedAlbums.creating", "Creating...") : t("sharedAlbums.createLink", "Create share link")}</span>
          </button>
        </div>
      </section>

      {error ? <section className="card p-5 text-red-400">{error}</section> : null}

      {loading ? (
        <section className="card p-5 text-slatebody">{t("sharedAlbums.loading", "Loading shared albums...")}</section>
      ) : shareLinks.length === 0 ? (
        <section className="card p-6 text-slatebody">
          <p className="font-semibold">{t("sharedAlbums.emptyTitle", "No shared albums yet.")}</p>
          <p className="mt-2">{t("sharedAlbums.emptyDescription", "Create a share link for a trip to see it here.")}</p>
        </section>
      ) : (
        <section className="grid gap-4">
          {shareLinks.map((item) => (
            <article key={item.id} className="card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{item.active ? t("sharedAlbums.active", "Active") : t("sharedAlbums.inactive", "Inactive")}</p>
                  <h2 className="mt-2 text-2xl font-black">{item.trip?.title || t("trips.untitled", "Untitled trip")}</h2>
                  <p className="mt-3 break-all text-sm text-slatebody">{`${window.location.origin}/share/${item.token}`}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-ghost inline-flex items-center gap-2" type="button" onClick={() => copyLink(item)}>
                    <Copy size={16} />
                    <span>{copiedId === item.id ? t("qrSpaces.linkCopied", "Link copied") : t("qrSpaces.copyLink", "Copy link")}</span>
                  </button>
                  <Link className="btn-primary" to={`/share/${item.token}`}>{t("sharedAlbums.openPublic", "Open public album")}</Link>
                  {item.tripId ? <Link className="btn-ghost" to={`/trips/${item.tripId}`}>{t("trips.openTrip", "Open trip")}</Link> : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
