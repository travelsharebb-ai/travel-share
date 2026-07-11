import { CalendarDays, MapPin, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

export default function Trips() {
  const { t } = useLanguage();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api("/api/trips")
      .then((data) => {
        if (!active) return;
        setTrips(Array.isArray(data.trips) ? data.trips : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || t("trips.error", "Unable to load trips."));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("trips.badge", "Trips")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("trips.title", "My Trips")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("trips.description", "Manage your trip albums, memories, dates, and share links from one place.")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn-primary inline-flex items-center gap-2" to="/trips/new">
            <Plus size={18} />
            <span>{t("dashboard.quickActions.createTrip", "Create Trip")}</span>
          </Link>
        </div>
      </section>

      {error ? <section className="card p-5 text-red-400">{error}</section> : null}

      {loading ? (
        <section className="card p-5 text-slatebody">{t("trips.loading", "Loading trips...")}</section>
      ) : trips.length === 0 ? (
        <section className="card p-6 text-slatebody">
          <p className="font-semibold">{t("trips.emptyTitle", "No trips yet.")}</p>
          <p className="mt-2">{t("trips.emptyDescription", "Create your first trip to start collecting memories.")}</p>
        </section>
      ) : (
        <section className="grid gap-4">
          {trips.map((trip) => (
            <article key={trip.id} className="card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("trips.tripAlbum", "Trip Album")}</p>
                  <h2 className="mt-2 text-2xl font-black">{trip.title || t("trips.untitled", "Untitled trip")}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slatebody">
                    <span className="inline-flex items-center gap-2 rounded-full border border-borderline px-3 py-1">
                      <MapPin size={14} />
                      {trip.destination || t("common.noValue", "No value")}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-borderline px-3 py-1">
                      <CalendarDays size={14} />
                      {trip.startDate ? new Date(trip.startDate).toLocaleDateString() : t("trips.noDate", "No date")}
                    </span>
                    <span className="rounded-full border border-borderline px-3 py-1">
                      {t("trips.uploadCount", "{count} uploads").replace("{count}", trip._count?.uploads || 0)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link className="btn-primary" to={`/trips/${trip.id}`}>{t("trips.openTrip", "Open trip")}</Link>
                  <Link className="btn-ghost" to="/shared-albums">{t("sharedAlbums.title", "Shared Albums")}</Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
