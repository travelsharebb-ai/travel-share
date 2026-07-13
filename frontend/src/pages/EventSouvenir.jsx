import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api, currentUser } from "../lib/api.js";
import { useLanguage } from "../lib/i18n.js";

export default function EventSouvenir() {
  const { eventId } = useParams();
  const { t, language } = useLanguage();
  const viewer = currentUser();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        let data;
        try {
          data = await api(`/api/public/events/${encodeURIComponent(eventId)}/souvenir`);
        } catch (publicError) {
          if (!viewer) throw publicError;
          data = await api(`/api/events/${encodeURIComponent(eventId)}`);
        }
        if (active) setEvent(data.event || null);
      } catch {
        if (active) setError(true);
      }
    };
    load();
    return () => { active = false; };
  }, [eventId, viewer?.id]);

  const approved = useMemo(() => (event?.uploads || []).filter((upload) => upload.status === undefined || upload.status === "approved"), [event]);
  const isComplete = ["ended", "archived"].includes(event?.status);
  const date = (value) => value ? new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(value)) : t("souvenir.dateUnavailable");

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (error || (event && !isComplete)) return <main className="page-shell"><div className="card p-8"><h1 className="font-serif text-3xl font-black">{t("souvenir.unavailable")}</h1><p className="mt-3 text-slatebody">{t("souvenir.unavailableDescription")}</p></div></main>;
  if (!event) return <main className="page-shell"><div className="card p-8 text-slatebody">{t("souvenir.loading")}</div></main>;

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel overflow-hidden">
        {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" className="mb-6 h-56 w-full rounded-3xl object-cover" /> : null}
        <Link className="btn-ghost inline-flex items-center gap-2" to={viewer ? `/events/${event.id}` : "/discover"}><ArrowLeft size={17} />{t("souvenir.back")}</Link>
        <p className="mt-6 text-sm uppercase tracking-[0.32em] text-primary">{t("souvenir.badge")}</p>
        <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">{event.title}</h1>
        <p className="mt-4 max-w-3xl text-slatebody">{event.description || t("souvenir.defaultDescription")}</p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-slatebody">
          <span>{date(event.startDate)} – {date(event.endDate)}</span>
          {event.location ? <span className="inline-flex items-center gap-1"><MapPin size={16} />{event.location}</span> : null}
        </div>
        <button type="button" className="btn-primary mt-5" onClick={copyLink}><Copy size={17} />{copied ? t("souvenir.copied") : t("souvenir.copyLink")}</button>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><p className="text-sm text-slatebody">{t("souvenir.approvedMemories")}</p><p className="mt-2 text-3xl font-black">{approved.length}</p></div>
        <div className="card p-5"><p className="text-sm text-slatebody">{t("souvenir.zones")}</p><p className="mt-2 text-3xl font-black">{event.zones?.length || 0}</p></div>
        <div className="card p-5"><p className="text-sm text-slatebody">{t("souvenir.highlights")}</p><p className="mt-2 text-3xl font-black">{approved.filter((item) => item.fileType?.startsWith("image")).length}</p></div>
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-3xl font-black">{t("souvenir.gallery")}</h2>
        {approved.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{approved.map((upload) => (
          <article key={upload.id} className="overflow-hidden rounded-3xl border border-borderline">
            {upload.fileType?.startsWith("image") ? <img src={upload.fileUrl} alt={upload.caption || t("souvenir.memoryAlt")} className="h-56 w-full object-cover" /> : <video src={upload.fileUrl} controls preload="metadata" className="h-56 w-full bg-black object-contain" />}
            <p className="p-4 text-sm text-slatebody">{upload.caption || t("souvenir.memoryFallback")}</p>
          </article>
        ))}</div> : <p className="mt-4 text-slatebody">{t("souvenir.emptyGallery")}</p>}
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-3xl font-black">{t("souvenir.zoneSummary")}</h2>
        {event.zones?.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{event.zones.map((zone) => <div key={zone.id} className="rounded-2xl border border-borderline p-4"><p className="font-bold">{zone.name}</p><p className="mt-1 text-sm text-slatebody">{zone.description || zone.type}</p></div>)}</div> : <p className="mt-4 text-slatebody">{t("souvenir.noZones")}</p>}
      </section>
    </main>
  );
}
