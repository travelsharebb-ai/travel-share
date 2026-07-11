import { useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n.js";
import { Link } from "react-router-dom";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api, currentUser } from "../../lib/api.js";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const me = currentUser();
  const { t } = useLanguage();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api("/api/admin/users");
        if (!mounted) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
      } catch (err) {
        if (!mounted) return;
        setError(err.message || t("admin.users.errorLoad", "Unable to load users."));
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
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.users.badge", "Admin users")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.users.title", "Manage accounts")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t("admin.users.description", "Review registered accounts, roles, and recent signups. Platform admins can verify access and audit active users.")}
          </p>
        </section>

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.users.loading", "Loading users…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">Error: {error}</div>
        ) : (
          <div className="card overflow-x-auto p-5 bg-slate-950/90 border border-white/10">
              {users.length === 0 ? (
              <p className="text-slatebody">{t("admin.users.empty", "No users found yet.")}</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-borderline text-slatebody/80">
                    <th className="py-3 pr-4">{t("admin.users.table.name", "Name")}</th>
                    <th className="py-3 pr-4">{t("admin.users.table.email", "Email")}</th>
                    <th className="py-3 pr-4">{t("admin.users.table.role", "Role")}</th>
                    <th className="py-3 pr-4">{t("admin.users.table.created", "Created")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-borderline hover:bg-white/5">
                      <td className="py-3 pr-4 font-semibold text-white">
                        {editingId === user.id ? (
                            <input className="input" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        ) : (
                          user.name
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slatebody">{user.email}</td>
                      <td className="py-3 pr-4 text-slatebody capitalize">
                          {editingId === user.id ? (
                            <select className="input" value={form.role || user.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                              <option value="tourist">{t("admin.users.roleTourist", "tourist")}</option>
                              <option value="organizer">{t("admin.users.roleOrganizer", "organizer")}</option>
                              <option value="admin">{t("admin.users.roleAdmin", "admin")}</option>
                              <option value="platform_admin">{t("admin.users.rolePlatformAdmin", "platform_admin")}</option>
                              <option value="guest">{t("admin.users.roleGuest", "guest")}</option>
                            </select>
                          ) : (
                            user.role.replace("_", " ")
                          )}
                      </td>
                      <td className="py-3 pr-4 text-slatebody">{user.createdAt ? new Date(user.createdAt).toLocaleString() : t("admin.users.noValue", "—")}</td>
                      <td className="py-3 pr-4">
                        {editingId === user.id ? (
                          <div className="flex gap-2">
                            <button className="btn-primary" onClick={async () => {
                              // save
                              try {
                                // disallow demoting self
                                if (me?.id === user.id && form.role && form.role !== user.role && form.role !== 'platform_admin') {
                                  alert(t('admin.users.cannotDemoteSelf', 'You cannot demote yourself.'));
                                  return;
                                }
                                const resp = await api(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ name: form.name, role: form.role }) });
                                setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, ...resp.user } : u));
                                setEditingId(null);
                              } catch (err) {
                                alert(err.message || t('admin.users.updateFailed', 'Failed to update user'));
                              }
                            }}>{t("admin.users.save", "Save")}</button>
                            <button className="btn-ghost" onClick={() => { setEditingId(null); setForm({}); }}>{t("admin.users.cancel", "Cancel")}</button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button className="btn-secondary" onClick={() => { setEditingId(user.id); setForm({ name: user.name, role: user.role }); }}>{t("admin.users.edit", "Edit")}</button>
                            <button className="btn-danger" onClick={async () => {
                              if (me?.id === user.id) { alert(t('admin.users.cannotDeleteSelf', 'You cannot delete your own account here.')); return; }
                              if (!confirm(t('admin.users.confirmDelete', 'Are you sure you want to safely delete (anonymize) this user? This cannot be undone.')) ) return;
                              try {
                                await api(`/api/admin/users/${user.id}/safe-delete`, { method: 'POST' });
                                setUsers((prev) => prev.filter((u) => u.id !== user.id));
                              } catch (err) {
                                alert(err.message || t('admin.users.deleteFailed', 'Failed to delete user'));
                              }
                            }}>{t("admin.users.safeDelete", "Safe delete")}</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.tools.backToAdminDashboard", "Back to admin dashboard")}</Link>
          <Link className="btn-primary w-full" to="/admin/moderation">{t("admin.moderation.title", "Review flagged activity")}</Link>
        </div>
      </main>
  );
}
