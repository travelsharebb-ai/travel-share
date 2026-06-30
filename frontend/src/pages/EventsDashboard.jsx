import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function EventsDashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api("/api/events")
      .then((data) => {
        if (!active) return;
        setEvents(data.events || []);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setEvents([]);
        setError(err.message || "Unable to load events.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const eventCount = events.length;
    const uploadCount = events.reduce((total, event) => total + (event._count?.uploads || 0), 0);
    const zoneCount = events.reduce((total, event) => total + (event._count?.zones || 0), 0);
    const liveCount = events.filter((event) => event.status === "live").length;
    return { eventCount, uploadCount, zoneCount, liveCount };
  }, [events]);

  const upcoming = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0))
      .slice(0, 4);
  }, [events]);

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <div className="font-serif">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Organizer dashboard</p>
          <h1 className="mt-3 text-4xl font-black">Events & guest journeys</h1>
          <p className="mt-4 max-w-2xl text-slatebody leading-7">
            Manage your upcoming gatherings, scan guest QR codes, and keep every event feeling premium and polished.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_auto]">
          <button
            type="button"
            className="btn-primary"
            onClick={() => window.alert("Event creation is not available in this version yet.")}
          >
            Create Event
          </button>
          <Link className="btn-ghost" to="/scan">
            Scan QR
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Events</p>
          <p className="mt-2 text-3xl font-black">{loading ? "..." : stats.eventCount}</p>
          <p className="mt-2 text-slatebody">Organized events on this account.</p>
        </div>

        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Uploads</p>
          <p className="mt-2 text-3xl font-black">{loading ? "..." : stats.uploadCount}</p>
          <p className="mt-2 text-slatebody">Memories collected across your events.</p>
        </div>

        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Zones</p>
          <p className="mt-2 text-3xl font-black">{loading ? "..." : stats.zoneCount}</p>
          <p className="mt-2 text-slatebody">Active map zones ready for guest uploads.</p>
        </div>

        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Live events</p>
          <p className="mt-2 text-3xl font-black">{loading ? "..." : stats.liveCount}</p>
          <p className="mt-2 text-slatebody">Events currently set to live status.</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-primary">Upcoming events</p>
              <h2 className="mt-3 text-2xl font-black">Your next gatherings</h2>
            </div>
              <button
                type="button"
                className="btn-indigo"
                onClick={() => window.alert("All events are shown on this page.")}
              >
                View all
              </button>
          </div>

          <div className="mt-6 space-y-4">
            {loading && <p className="text-slatebody">Loading your events…</p>}
            {error && <p className="text-slatebody">{error}</p>}
            {!loading && !events.length && (
              <div className="rounded-3xl border border-borderline p-6 text-slatebody">
                <p className="font-semibold">No events found yet.</p>
                <p className="mt-2 text-sm text-slatebody">Start by planning your first event and inviting guests with a QR code.</p>
              </div>
            )}
            {!loading && upcoming.map((event) => (
              <article key={event.id} className="rounded-[1.25rem] border border-borderline bg-slate-950/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-primary">{event.category || "Event"}</p>
                    <h3 className="mt-2 text-2xl font-black font-serif leading-tight">{event.title}</h3>
                    <p className="mt-2 text-slatebody">{event.location || "Private location"}</p>
                  </div>
                  <span className="text-sm text-slatebody">
                    {event.startDate ? new Date(event.startDate).toLocaleDateString() : "Scheduled"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-sm text-slatebody">
                  <span>{event.status?.toUpperCase() || "DRAFT"}</span>
                  <span>Uploads: {event._count?.uploads || 0}</span>
                  <span>Zones: {event._count?.zones || 0}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="btn-ghost" to={`/events/${event.id}`}>
                    Open event
                  </Link>
                  <Link className="btn-ghost" to="/scan">
                    Scan attendee QR
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Organizer notes</p>
          <div className="mt-4 space-y-4 text-slatebody text-sm">
            <p>
              Events are displayed by upcoming start date. If you need a dedicated management page for each event, open the organizer event details.
            </p>
            <p>
              Scan guest QR codes from the top action or use the event links to preview the public QR route for each event.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}