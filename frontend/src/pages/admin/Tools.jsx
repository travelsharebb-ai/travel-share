import { Link } from "react-router-dom";
import { useLanguage } from "../../lib/i18n";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping

export default function AdminTools() {
  const { t } = useLanguage();

  const cards = [
    { id: 'users', title: t('admin.tools.users','Users'), description: t('admin.tools.usersDescription','Manage accounts and roles.'), to: "/admin/users" },
    { id: 'moderation', title: t('admin.tools.moderation','Moderation'), description: t('admin.tools.moderationDescription','Review reported uploads and activity.'), to: "/admin/moderation" },
    { id: 'reports', title: t('admin.tools.reports','Reports'), description: t('admin.tools.reportsDescription','View analytics and platform insights.'), to: "/admin/reports" },
    { id: 'map', title: t('admin.tools.map','Map'), description: t('admin.tools.mapDescription','Open the admin map workflow.'), to: "/map" },
    { id: 'settings', title: t('admin.tools.settings','Settings'), description: t('admin.tools.settingsDescription','Review platform configuration settings.'), to: "/admin/settings" },
    { id: 'events', title: t('admin.tools.events','Events'), description: t('admin.tools.eventsDescription','Open the event dashboard.'), to: "/events" },
    { id: 'store', title: t('admin.tools.store','Store'), description: t('admin.tools.storeDescription','Open the store for premium items.'), to: "/store" }
  ];

  return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('admin.tools.badge','Admin tools')}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t('admin.tools.title','Platform tools')}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t('admin.tools.description','Navigate directly to key admin workflows and platform controls from one centralized toolset.')}
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link key={card.id} to={card.to} className="rounded-3xl border border-borderline bg-slate-950/90 p-5 transition hover:border-white/20">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{card.title}</p>
              <p className="mt-3 text-white font-semibold">{card.description}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm text-primary">{t('admin.tools.open','Open')}</div>
            </Link>
          ))}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin">{t('admin.tools.backToAdmin','Back to admin dashboard')}</Link>
          <Link className="btn-primary w-full" to="/admin/users">{t('admin.tools.viewAllUsers','View all users')}</Link>
        </div>
      </main>
  );
}
