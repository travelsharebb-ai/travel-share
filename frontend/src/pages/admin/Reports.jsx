import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api } from "../../lib/api.js";
import { useLanguage } from "../../lib/i18n";

export default function AdminReports() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api("/api/admin/analytics");
        if (!mounted) return;
        setAnalytics(data.analytics || {});
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Unable to load analytics.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.reports.badge", "Admin reports")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.reports.title", "Platform insights")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t("admin.reports.subtitle", "See recent analytics and activity trends across the Travel Share platform.")}
          </p>
        </section>

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.reports.loading", "Loading reports…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">{t("admin.reports.errorPrefix", "Error:")} {error}</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5 bg-slate-950/90 border border-white/10">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.reports.popularZones","Popular zones")}</p>
              <div className="mt-4 space-y-3">
                {(analytics.popularZones && analytics.popularZones.length > 0) ? analytics.popularZones.map((zone, index) => (
                  <div key={index} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                    <p className="font-semibold text-white">{zone.event}</p>
                    <p className="mt-1 text-slatebody text-sm">{zone.zone} • {zone.count} {t("admin.reports.uploads","uploads")}</p>
                  </div>
                )) : (
                  <p className="text-slatebody">{t("admin.reports.noAnalytics","No analytics available yet.")}</p>
                )}
              </div>
            </div>

            <div className="card p-5 bg-slate-950/90 border border-white/10">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.reports.mapHotspots","Map hotspots")}</p>
              <div className="mt-4 space-y-3">
                {(analytics.mapHotspots && analytics.mapHotspots.length > 0) ? analytics.mapHotspots.map((item, index) => (
                  <div key={index} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                    <p className="font-semibold text-white">{item.locationName}</p>
                    <p className="mt-1 text-slatebody text-sm">{item.count} {t("admin.reports.uploads","uploads")}</p>
                  </div>
                )) : (
                  <p className="text-slatebody">{t("admin.reports.noHotspots","No hotspot activity found.")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.reports.backToAdminTools", "Back to admin tools")}</Link>
          <Link className="btn-primary w-full" to="/admin/moderation">{t("admin.reports.openModeration", "Open moderation")}</Link>
        </div>
      </main>
  );
}
