import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Shell from "../components/Shell";
import { api } from "../lib/api";

function HeaderBlock({ eyebrow, title, copy }) {
  return (
    <section>
      <p className="text-sm font-black uppercase text-primary">{eyebrow}</p>
      <h1 className="mt-2 break-words font-serif text-4xl font-black">{title}</h1>
      {copy && <p className="mt-2 max-w-3xl text-slatebody">{copy}</p>}
    </section>
  );
}

export default function DiscoverEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api("/api/public/events")
      .then((data) => {
        if (!mounted) return;
        setEvents(data.events || []);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <HeaderBlock 
            eyebrow="Discover" 
            title="Public Events" 
            copy="Browse upcoming and recent public events and open their QR pages to contribute memories." 
          />
        </section>

        <section className="grid gap-4">
          {loading ? (
            <div className="card p-5">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="card p-5">No public events found.</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="card p-5">
                {ev.qrToken ? (
                  <Link to={`/qr/${ev.qrToken}`} className="block">
                    <p className="font-serif text-2xl font-black">{ev.title}</p>
                    <p className="text-slatebody">{ev.location || "Public event"} • {ev._count?.uploads || 0} memories</p>
                    <p className="mt-2 text-primary">Open event QR page</p>
                  </Link>
                ) : (
                  <div className="opacity-60">
                    <p className="font-serif text-2xl font-black">{ev.title}</p>
                    <p className="text-slatebody">{ev.location || "Public event"} • {ev._count?.uploads || 0} memories</p>
                    <p className="mt-2 text-slatebody">Event QR not available</p>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
    </Shell>
  );
}