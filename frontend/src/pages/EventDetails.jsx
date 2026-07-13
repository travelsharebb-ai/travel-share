import { useLanguage } from "../lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../lib/api.js";

export default function EventDetails() {
  const { t, language } = useLanguage();
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api(`/api/events/${eventId}`)
      .then((data) => {
        if (!active) return;
        setEvent(data.event || null);
        setError(null);
      })
      .catch(() => {
        if (!active) return;
        setEvent(null);
        setError(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId]);

  const stats = useMemo(() => {
    if (!event) return { guests: 0, uploads: 0, scans: 0, zones: 0 };
    const guests = new Set(event.uploads.map((upload) => upload.guestSessionId || upload.uploaderAnonId || upload.uploaderFingerprint)).size;
    const uploads = event._count?.uploads || event.uploads.length || 0;
    const zones = event._count?.zones || event.zones?.length || 0;
    const scans = uploads;
    return { guests, uploads, scans, zones };
  }, [event]);

  const heroSubtitle = event?.description || t("eventDetails.defaultDescription", "Manage checklist, QR access and gallery previews for your event.");
  const publicUploadPath = event?.qrToken ? `/qr/${event.qrToken}/upload` : null;
  const formatDateTime = (value) => value ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : null;
  const statusLabel = (value) => value === "live" ? t("eventDetails.statusLive", "Live") : value === "ended" ? t("eventDetails.statusEnded", "Ended") : value === "archived" ? t("eventDetails.statusArchived", "Archived") : t("eventDetails.statusDraft", "Draft");
  const visibilityLabel = (value) => value === "public" ? t("eventDetails.visibilityPublic", "Public") : value === "unlisted" ? t("eventDetails.visibilityUnlisted", "Unlisted") : t("eventDetails.visibilityPrivate", "Private");

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/events">
          <ArrowLeft size={16} />
          <span>{t("events.backToEvents", "Back to events")}</span>
        </Link>
        {loading ? (
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.eventManagement")}</p>
            <h1 className="mt-3 text-4xl font-black">{t("hardcoded.loadingEvent")}</h1>
          </div>
        ) : error ? (
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.eventManagement")}</p>
            <h1 className="mt-3 text-4xl font-black">{t("hardcoded.eventUnavailable")}</h1>
            <p className="mt-4 text-slatebody">{t("eventDetails.loadError", "Unable to load event details.")}</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.eventManagement")}</p>
              <h1 className="mt-3 text-4xl font-black font-serif">{event.title}</h1>
              <p className="mt-4 max-w-2xl text-slatebody leading-7">{heroSubtitle}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm uppercase tracking-[0.32em] text-primary">
                  {statusLabel(event.status)}
                </span>
                <span className="rounded-full border border-slate-700 bg-white/5 px-4 py-2 text-sm text-slatebody">
                  {visibilityLabel(event.visibility)}
                </span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="card p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.eventDetails")}</p>
                <p className="mt-3 text-xl font-black">{event.location || t("eventDetails.locationNotSet", "Location not set")}</p>
                <p className="mt-2 text-slatebody">{event.category || t("eventDetails.generalEvent", "General event")}</p>
                <div className="mt-4 space-y-2 text-sm text-slatebody">
                  <p>{t("eventDetails.starts", "Starts")}: {formatDateTime(event.startDate) || t("eventDetails.tbd", "TBD")}</p>
                  <p>{t("eventDetails.ends", "Ends")}: {formatDateTime(event.endDate) || t("eventDetails.openEnded", "Open ended")}</p>
                </div>
              </div>
              <div className="card p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.quickActionsBadge")}</p>
                <div className="mt-4 grid gap-3">
                  <Link className="btn-indigo" to="/scan">{t("events.dashboard.scanAttendeeQr")}</Link>
                  {publicUploadPath ? (
                    <Link className="btn-ghost" to={publicUploadPath}>{t("hardcoded.openPublicQrPage")}</Link>
                  ) : (
                    <button type="button" className="btn-ghost" disabled>{t("hardcoded.openPublicQrPage")}</button>
                  )}
                  <Link className="btn-primary" to={`/qr-spaces/new?targetType=event&targetId=${encodeURIComponent(event.id)}`}>
                    {t("qrSpaces.createForEvent")}
                  </Link>
                  {["ended", "archived"].includes(event.status) ? (
                    <Link className="btn-ghost" to={`/events/${event.id}/souvenir`}>{t("souvenir.open")}</Link>
                  ) : null}
                  <p className="text-sm text-slatebody">{t("qrSpaces.createForEventHelp")}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {!loading && event && (
        <section className="grid gap-4 lg:grid-cols-4">
          {[
            { label: t("eventDetails.guests", "Guests"), value: stats.guests, detail: t("eventDetails.uniqueGuestSessions", "Unique guest sessions") },
            { label: t("dashboard.stats.uploads"), value: stats.uploads, detail: t("eventDetails.totalMediaSubmissions", "Total media submissions") },
            { label: t("eventDetails.scans", "Scans"), value: stats.scans, detail: t("eventDetails.qrCheckIns", "QR check-ins") },
            { label: t("eventDetails.zones", "Zones"), value: stats.zones, detail: t("eventDetails.activeEventZones", "Active event zones") }
          ].map((item) => (
            <div key={item.label} className="card p-5">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{item.label}</p>
              <p className="mt-3 text-3xl font-black">{item.value}</p>
              <p className="mt-2 text-slatebody text-sm">{item.detail}</p>
            </div>
          ))}
        </section>
      )}

      {!loading && event && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.eventManagement")}</p>
            <h2 className="mt-3 text-2xl font-black">{t("hardcoded.galleryUploadSummary")}</h2>
            <p className="mt-3 text-slatebody">{t("hardcoded.aQuickPreviewOfTheLatestUploadActivity")}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {event.uploads.length ? (
                event.uploads.slice(0, 4).map((upload) => (
                  <div key={upload.id} className="rounded-3xl border border-borderline bg-slate-950/70 overflow-hidden">
                    {upload.fileType?.startsWith("image") ? (
                      <img src={upload.fileUrl} alt={upload.caption || t("eventDetails.uploadAlt", "Event upload")} className="h-36 w-full object-cover" />
                    ) : (
                      <div className="flex h-36 items-center justify-center bg-slate-900 text-slatebody">{t("hardcoded.video")}</div>
                    )}
                    <div className="p-3 text-sm text-slatebody">
                      <p className="font-semibold truncate">{upload.caption || t("eventDetails.guestMemory", "Guest memory")}</p>
                      <p className="mt-1">{new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(upload.createdAt))}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-borderline bg-slate-950/70 p-6 text-slatebody">{t("hardcoded.noUploadsHaveBeenAddedYet")}</div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.managementCards")}</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.details")}</p>
                <p className="mt-3 text-slatebody">{t("hardcoded.reviewEventMetadataAdjustVisibilityOrSetEvent")}</p>
              </div>
              <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.qrAccess")}</p>
                <p className="mt-3 text-slatebody">{t("hardcoded.shareThisEventQrPageSecurelyViaThe")}</p>
              </div>
              <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("dashboard.stats.uploads")}</p>
                <p className="mt-3 text-slatebody">{t("hardcoded.approveGuestMediaModerateUploadsAndKeepThe")}</p>
              </div>
              <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5">
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.activity")}</p>
                <p className="mt-3 text-slatebody">{t("hardcoded.monitorRecentGuestSubmissionsAndZoneEngagementIn")}</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
