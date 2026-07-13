import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n";

export default function Admin() {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function fetchStats() {
    setLoading(true);
    setError(null);
    try {
      const data = await api("/api/admin/stats");
      // endpoint returns { stats: { users, organizers, guests, trips, events, uploads, reported, ads, storeItems } }
      setStats(data.stats || null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || t("admin.error.loadStats", "Failed to load stats."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const cards = [
    { id: "users", to: "/admin/users", title: t("admin.stats.users", "Users"), copy: t("admin.usersBody", "Manage accounts and roles") },
    { id: "events", to: "/events", title: t("admin.stats.events", "Events"), copy: t("admin.actions.reviewActivity", "Review platform events") },
    { id: "map", to: "/map", title: t("nav.map", "Map"), copy: t("admin.mapHelper", "View pins, uploads, locations, and public travel activity") },
    { id: "uploads", to: "/admin/moderation", title: t("admin.stats.uploads", "Uploads"), copy: t("admin.actions.moderateUploads", "Moderate guest content") },
    { id: "store", to: "/admin/management", title: t("nav.store", "Store"), copy: t("admin.actions.manageStore", "Manage premium items") },
    { id: "ads", to: "/admin/ads", title: t("admin.stats.ads", "Ads"), copy: t("admin.actions.manageAds", "Manage internal advertisements") },
    { id: "settings", to: "/admin/settings", title: t("nav.settings", "Settings"), copy: t("admin.actions.platformConfig", "Platform configuration") },
    { id: "reports", to: "/admin/reports", title: t("admin.reports.title", "Reports"), copy: t("admin.actions.reviewActivity", "Review flagged activity") }
  ];

  const defaultStats = [
    { label: t("admin.stats.users", "Users"), key: "users", value: "—", detail: t("admin.stats.totalRegisteredUsers", "Total registered users") },
    { label: t("admin.stats.organizers", "Organizers"), key: "organizers", value: "—", detail: t("admin.stats.registeredOrganizers", "Registered organizers") },
    { label: t("admin.stats.guests", "Guests"), key: "guests", value: "—", detail: t("admin.stats.guestSessions", "Guest sessions") },
    { label: t("admin.stats.trips", "Trips"), key: "trips", value: "—", detail: t("admin.stats.savedTrips", "Saved trips") },
    { label: t("admin.stats.events", "Events"), key: "events", value: "—", detail: t("admin.stats.platformEvents", "Platform events") },
    { label: t("admin.stats.uploads", "Uploads"), key: "uploads", value: "—", detail: t("admin.stats.totalMediaUploads", "Total media uploads") },
    { label: t("admin.stats.reported", "Reported"), key: "reported", value: "—", detail: t("admin.stats.reportedUploads", "Reported uploads") },
    { label: t("admin.stats.ads", "Ads"), key: "ads", value: "—", detail: t("admin.stats.internalAds", "Internal ads") },
    { label: t("admin.stats.storeItems", "Store items"), key: "storeItems", value: "—", detail: t("admin.stats.catalogItems", "Catalog items") }
  ];

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.platformAdmin", "Platform Admin")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.controlCenter", "Admin control center")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t(
          "admin.heroSubtitle",
          "Monitor platform health, moderate content, and make high-impact decisions across Travel Share from one polished dashboard."
        )}</p>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn-ghost" onClick={() => fetchStats()} disabled={loading}>
            {loading ? t("common.refreshing", "Refreshing…") : t("admin.refreshStats", "Refresh stats")}
          </button>
          {lastUpdated && <div className="text-sm text-slatebody">{t("admin.lastUpdated", "Last updated")}: {lastUpdated.toLocaleString()}</div>}
        </div>

        {error && <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-red-600">{t("admin.hero.errorLoadingStats", "Error loading stats")}:{" "}{error}</div>}
      </section>

      <section className="grid gap-5 sm:grid-cols-3">
        {(defaultStats || []).map((stat) => (
          <div key={stat.label} className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{stat.label}</p>
            <p className="mt-3 text-3xl font-black font-serif">{loading ? t("common.loading", "Loading…") : (stats && stats[stat.key] !== undefined ? String(stats[stat.key]) : stat.value)}</p>
            <p className="mt-2 text-slatebody text-sm">{stat.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5">
          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.actions.title", "Actions")}</p>
            <h2 className="mt-3 text-3xl font-black font-serif">{t("admin.quickTools", "Quick admin tools")}</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <div key={card.id} className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                  <p className="text-sm uppercase tracking-[0.28em] text-primary">{card.title}</p>
                  <p className="mt-2 text-slatebody text-sm">{card.copy}</p>
                  <Link className="btn-secondary mt-4 w-full" to={card.to}>
                    {t("common.open", "Open")}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.moderation.badge", "Moderation")}</p>
            <h2 className="mt-3 text-3xl font-black font-serif">{t("admin.moderation.title", "Review activity")}</h2>
            <p className="mt-4 text-slatebody leading-7">{t(
              "admin.moderation.description",
              "Use this section to stay on top of flagged uploads, pending reports, and user feedback."
            )}</p>
            <div className="mt-5 space-y-3 text-slatebody text-sm">
              <p>• {loading ? t("common.loading", "Loading…") : t("admin.reports.reportedUploadsSummary", "{count} reported uploads", { count: stats?.reported ?? "—" })}</p>
              <p>• {loading ? t("common.loading", "Loading…") : t("admin.reports.totalUploadsSummary", "{count} total uploads", { count: stats?.uploads ?? "—" })}</p>
            </div>
            <Link className="btn-primary mt-5 w-full" to="/admin/moderation">{t("admin.viewModeration", "View moderation")}</Link>
          </div>

          {/* Platform health card removed — Admin Control Center / Quick Admin Tools already provides these controls */}
        </aside>
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.reports.badge", "Reports")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.stats.reported", "Reported")}</p>
            <p className="mt-2 text-2xl font-black text-white">{loading ? t("common.loading", "Loading…") : stats?.reported ?? "—"}</p>
            <p className="mt-2 text-slatebody text-sm">{loading ? t("common.loading", "Loading…") : t("admin.reports.reportedUploadsSummary", "{count} reported uploads", { count: stats?.reported ?? "—" })}</p>
          </div>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.stats.uploads", "Uploads")}</p>
            <p className="mt-2 text-2xl font-black text-white">{loading ? t("common.loading", "Loading…") : stats?.uploads ?? "—"}</p>
            <p className="mt-2 text-slatebody text-sm">{loading ? t("common.loading", "Loading…") : t("admin.reports.totalUploadsSummary", "{count} total uploads", { count: stats?.uploads ?? "—" })}</p>
          </div>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
            <p className="text-sm uppercase tracking-[0.28em] text-primary">{t("admin.stats.guests", "Guests")}</p>
            <p className="mt-2 text-2xl font-black text-white">{loading ? t("common.loading", "Loading…") : stats?.guests ?? "—"}</p>
            <p className="mt-2 text-slatebody text-sm">{loading ? t("common.loading", "Loading…") : t("admin.reports.guestSessionsSummary", "{count} guest sessions", { count: stats?.guests ?? "—" })}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
