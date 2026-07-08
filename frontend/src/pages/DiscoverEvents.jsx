import { useLanguage } from "../lib/i18n";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  const { t } = useLanguage();
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
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <HeaderBlock 
            eyebrow={t("hardcoded.discoverEvents")} 
            title={t("hardcoded.publicEvents")} 
            copy={t("hardcoded.browseUpcomingAndRecentPublicEvents")} 
          />
        </section>

        <section className="grid gap-4">
          {loading ? (
            <div className="card p-5">{t("hardcoded.loadingEvents")}</div>
          ) : events.length === 0 ? (
            <div className="card p-5">{t("hardcoded.noPublicEventsFound")}</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="card p-5">
                {ev.qrToken ? (
                  <Link to={`/qr/${ev.qrToken}`} className="block">
                    <p className="font-serif text-2xl font-black">{ev.title}</p>
                    <p className="text-slatebody">{ev.location || t("hardcoded.publicEvent")} • {t("hardcoded.memoriesCount", undefined, { count: ev._count?.uploads || 0 })}</p>
                    <p className="mt-2 text-primary">{t("hardcoded.openEventQrPage")}</p>
                  </Link>
                ) : (
                  <div className="opacity-60">
                    <p className="font-serif text-2xl font-black">{ev.title}</p>
                    <p className="text-slatebody">{ev.location || t("hardcoded.publicEvent")} • {t("hardcoded.memoriesCount", undefined, { count: ev._count?.uploads || 0 })}</p>
                    <p className="mt-2 text-slatebody">{t("hardcoded.eventQrNotAvailable")}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>
  );
}
