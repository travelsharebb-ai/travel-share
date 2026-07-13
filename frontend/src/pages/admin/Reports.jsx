import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
import { useLanguage } from "../../lib/i18n";

function MetricCard({ label, value, detail }) {
  return (
    <div className="card p-5">
      <p className="text-sm uppercase tracking-[0.24em] text-primary">{label}</p>
      <p className="mt-3 font-serif text-3xl font-black">{value ?? 0}</p>
      {detail ? <p className="mt-2 text-sm text-slatebody">{detail}</p> : null}
    </div>
  );
}

export default function AdminReports() {
  const { t } = useLanguage();
  const [days, setDays] = useState(30);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api(`/api/admin/analytics?days=${days}`);
        if (mounted) setAnalytics(data.analytics || null);
      } catch (err) {
        if (mounted) setError(err.message || t("admin.reports.loadError"));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [days]);

  const summary = analytics?.summary;
  const reporting = analytics?.reporting;
  const trend = analytics?.trend || [];
  const trendMaximum = useMemo(
    () => Math.max(1, ...trend.map((item) => item.users + item.guests + item.uploads)),
    [trend]
  );
  const rangeLabel = days === 7 ? t("admin.reports.last7Days") : t("admin.reports.last30Days");

  const activityLabel = (type) => {
    const keys = {
      user: "admin.reports.activity.user",
      guest: "admin.reports.activity.guest",
      trip: "admin.reports.activity.trip",
      event: "admin.reports.activity.event",
      upload: "admin.reports.activity.upload"
    };
    return t(keys[type] || "admin.reports.activity.unknown");
  };

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.reports.badge")}</p>
        <h1 className="mt-3 font-serif text-4xl font-black sm:text-5xl">{t("admin.reports.title")}</h1>
        <p className="mt-4 max-w-3xl leading-7 text-slatebody">{t("admin.reports.description")}</p>
        <label className="mt-5 block max-w-xs text-sm font-bold text-slatebody">
          <span className="mb-2 block">{t("admin.reports.rangeLabel")}</span>
          <select id="admin-reports-range" name="reportRangeDays" className="field" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>{t("admin.reports.last7Days")}</option>
            <option value={30}>{t("admin.reports.last30Days")}</option>
          </select>
        </label>
      </section>

      {loading ? (
        <div className="card p-5 text-center text-slatebody">{t("admin.reports.loading")}</div>
      ) : error ? (
        <div className="card border border-rose-300 bg-rose-50 p-5 text-sm text-reject">
          {t("admin.reports.errorPrefix")} {error}
        </div>
      ) : !summary ? (
        <div className="card p-5 text-center text-slatebody">{t("admin.reports.noAnalytics")}</div>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.summary")}</p>
              <h2 className="mt-2 font-serif text-3xl font-black">{rangeLabel}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label={t("admin.stats.users")} value={summary.users.total} detail={t("admin.stats.totalRegisteredUsers")} />
              <MetricCard label={t("admin.reports.newUsers")} value={summary.users.inRange} detail={rangeLabel} />
              <MetricCard label={t("admin.stats.guests")} value={summary.guests.total} detail={t("admin.stats.guestSessions")} />
              <MetricCard label={t("admin.reports.activeGuests")} value={summary.guests.active} detail={t("admin.reports.currentlyUnclaimed")} />
              <MetricCard label={t("admin.stats.uploads")} value={summary.content.uploads} detail={t("admin.stats.totalMediaUploads")} />
              <MetricCard label={t("admin.reports.newUploads")} value={summary.content.uploadsInRange} detail={rangeLabel} />
              <MetricCard label={t("admin.reports.photos")} value={summary.content.photos} />
              <MetricCard label={t("admin.reports.videos")} value={summary.content.videos} />
              <MetricCard label={t("admin.stats.reported")} value={summary.content.reported} detail={t("admin.stats.reportedUploads")} />
              <MetricCard label={t("admin.reports.pendingContent")} value={summary.content.pending} />
              <MetricCard label={t("admin.stats.trips")} value={summary.content.trips} />
              <MetricCard label={t("admin.stats.events")} value={summary.content.events} />
              <MetricCard label={t("admin.stats.storeItems")} value={summary.store.items} />
              <MetricCard label={t("admin.reports.activeStoreItems")} value={summary.store.activeItems} />
              <MetricCard label={t("admin.reports.purchases")} value={summary.store.purchases} />
              <MetricCard label={t("admin.reports.qrScans")} value={summary.qr.scans} detail={t("admin.reports.qrSpaces", "{count} active QR spaces", { count: summary.qr.activeSpaces })} />
            </div>
          </section>

          <section className="card p-5">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.activityTrend")}</p>
            <div className="mt-5 space-y-3">
              {trend.length ? trend.map((item) => {
                const total = item.users + item.guests + item.uploads;
                return (
                  <div key={item.date} className="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                    <time className="text-sm font-bold" dateTime={item.date}>{new Date(`${item.date}T00:00:00Z`).toLocaleDateString()}</time>
                    <div className="h-3 overflow-hidden rounded-full bg-skysoft">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(total / trendMaximum) * 100}%` }} />
                    </div>
                    <p className="text-xs text-slatebody">
                      {t("admin.stats.users")}: {item.users} · {t("admin.stats.guests")}: {item.guests} · {t("admin.stats.uploads")}: {item.uploads}
                    </p>
                  </div>
                );
              }) : <p className="text-slatebody">{t("admin.reports.noTrend")}</p>}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.ads.analytics")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MetricCard label={t("admin.ads.impressions")} value={reporting?.ads?.impressions || 0} />
                <MetricCard label={t("admin.ads.clicks")} value={reporting?.ads?.clicks || 0} />
                <MetricCard label={t("admin.ads.ctr")} value={`${reporting?.ads?.ctr || 0}%`} />
              </div>
            </div>
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.paymentReadiness")}</p>
              <div className="mt-4 space-y-2 text-sm text-slatebody">
                <p>{t("admin.reports.stripe")}: {reporting?.payments?.readiness?.stripeReady ? t("admin.reports.ready") : t("admin.reports.notReady")}</p>
                <p>{t("admin.reports.paypal")}: {reporting?.payments?.readiness?.paypalReady ? t("admin.reports.ready") : t("admin.reports.disabled")}</p>
                <p>{t("admin.reports.paidTransactions")}: {reporting?.payments?.statuses?.paid || 0}</p>
              </div>
            </div>
            <div className="card p-5 lg:col-span-2">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.topEvents")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {reporting?.topEvents?.length ? reporting.topEvents.map((event) => <div key={event.id} className="rounded-2xl border border-borderline p-4"><p className="font-bold">{event.title}</p><p className="mt-1 text-sm text-slatebody">{event.uploads} {t("admin.reports.uploads")}</p></div>) : <p className="text-slatebody">{t("admin.reports.noAnalytics")}</p>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.recentActivity")}</p>
              <div className="mt-4 space-y-3">
                {analytics.recentActivity?.length ? analytics.recentActivity.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-borderline p-4">
                    <p className="font-bold">{activityLabel(item.type)}</p>
                    <time className="mt-1 block text-sm text-slatebody" dateTime={item.createdAt}>
                      {new Date(item.createdAt).toLocaleString()}
                    </time>
                  </div>
                )) : <p className="text-slatebody">{t("admin.reports.noRecentActivity")}</p>}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.popularZones")}</p>
              <div className="mt-4 space-y-3">
                {analytics.popularZones?.length ? analytics.popularZones.map((zone) => (
                  <div key={zone.id} className="rounded-2xl border border-borderline p-4">
                    <p className="font-bold">{zone.event}</p>
                    <p className="mt-1 text-sm text-slatebody">{zone.zone} · {zone.count} {t("admin.reports.uploads")}</p>
                  </div>
                )) : <p className="text-slatebody">{t("admin.reports.noAnalytics")}</p>}
              </div>
            </div>

            <div className="card p-5 lg:col-span-2">
              <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.reports.mapHotspots")}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {analytics.mapHotspots?.length ? analytics.mapHotspots.map((item) => (
                  <div key={item.locationName} className="rounded-2xl border border-borderline p-4">
                    <p className="font-bold">{item.locationName}</p>
                    <p className="mt-1 text-sm text-slatebody">{item.count} {t("admin.reports.uploads")}</p>
                  </div>
                )) : <p className="text-slatebody">{t("admin.reports.noHotspots")}</p>}
              </div>
            </div>
          </section>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.reports.backToAdminTools")}</Link>
        <Link className="btn-primary w-full" to="/admin/moderation">{t("admin.reports.openModeration")}</Link>
      </div>
    </main>
  );
}
