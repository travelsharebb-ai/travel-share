import { Fragment, useEffect, useState } from "react";
import { useLanguage } from "../../lib/i18n.js";
import { Link } from "react-router-dom";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api, currentUser } from "../../lib/api.js";

function roleLabel(role, t) {
  return {
    tourist: t("admin.users.roleTourist", "Tourist"),
    organizer: t("admin.users.roleOrganizer", "Organizer"),
    admin: t("admin.users.roleAdmin", "Admin"),
    platform_admin: t("admin.users.rolePlatformAdmin", "Platform admin"),
    guest: t("admin.users.roleGuest", "Guest")
  }[role] || role;
}

function guestStatusLabel(status, t) {
  return t(`security.resetRequests.guestStatuses.${status || "active"}`);
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [details, setDetails] = useState({});
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [guests, setGuests] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [guestDetails, setGuestDetails] = useState({});
  const [requestGuestSelections, setRequestGuestSelections] = useState({});
  const me = currentUser();
  const { t } = useLanguage();

  async function runSupportAction(user, action, destructive = false) {
    const reason = window.prompt(t("security.reasonPrompt"));
    if (!reason || reason.trim().length < 5) return;
    if (destructive && !window.confirm(t("security.destructiveConfirmation"))) return;
    try {
      const response = await api(`/api/admin/users/${user.id}/support`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), confirmation: destructive })
      });
      if (response.devResetUrl) window.alert(`${t("security.devResetUrl")} ${response.devResetUrl}`);
      setUsers((current) => current.map((entry) => entry.id === user.id ? {
        ...entry,
        accountStatus: response.accountStatus ?? entry.accountStatus,
        mustResetPassword: response.mustResetPassword ?? entry.mustResetPassword
      } : entry));
    } catch (requestError) {
      window.alert(requestError.message || t("security.supportActionFailed"));
    }
  }

  async function runGuestSupportAction(guest, action, destructive = false) {
    const reason = window.prompt(t("security.reasonPrompt"));
    if (!reason || reason.trim().length < 5) return;
    if (destructive && !window.confirm(t("security.destructiveConfirmation"))) return;
    try {
      const response = await api(`/api/admin/guests/${guest.id}/support`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), confirmation: destructive })
      });
      if (response.recoveryUrl) window.alert(`${t("security.resetRequests.oneTimeGuestLink")} ${response.recoveryUrl}`);
      setGuests((current) => current.map((entry) => entry.id === guest.id ? { ...entry, status: response.status } : entry));
    } catch (requestError) {
      window.alert(requestError.message || t("security.supportActionFailed"));
    }
  }

  async function runResetRequestAction(request, action) {
    const reason = window.prompt(t("security.reasonPrompt"));
    if (!reason || reason.trim().length < 5) return;
    const guestSessionId = action === "generate_guest_pin_reset"
      ? (requestGuestSelections[request.id] || request.guestSessionId || "")
      : undefined;
    if (action === "generate_guest_pin_reset" && !guestSessionId) {
      window.alert(t("security.resetRequests.selectGuestRequired"));
      return;
    }
    try {
      const response = await api(`/api/admin/reset-requests/${request.id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), ...(guestSessionId ? { guestSessionId } : {}) })
      });
      if (response.recoveryUrl) window.alert(`${t("security.resetRequests.oneTimeGuestLink")} ${response.recoveryUrl}`);
      setResetRequests((current) => current.filter((entry) => entry.id !== request.id));
      if (guestSessionId) {
        setGuests((current) => current.map((entry) => entry.id === guestSessionId ? { ...entry, status: "pin_reset_required", pinResetRequired: true } : entry));
      }
    } catch (requestError) {
      window.alert(requestError.message || t("security.supportActionFailed"));
    }
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [data, guestData, requestData] = await Promise.all([
          api("/api/admin/users"),
          api("/api/admin/guests"),
          api("/api/admin/reset-requests?status=pending")
        ]);
        if (!mounted) return;
        setUsers(Array.isArray(data.users) ? data.users : []);
        setGuests(Array.isArray(guestData.guests) ? guestData.guests : []);
        setResetRequests(Array.isArray(requestData.requests) ? requestData.requests : []);
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
          <h2 className="mt-3 text-2xl font-black">{t("security.adminSupportTitle")}</h2>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">
            {t("admin.users.description", "Review registered accounts, roles, and recent signups. Platform admins can verify access and audit active users.")}
          </p>
        </section>

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.users.loading", "Loading users…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">{t("common.error", "Error")}: {error}</div>
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
                    <th className="py-3 pr-4">{t("admin.users.table.actions", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <Fragment key={user.id}>
                    <tr className="border-b border-borderline hover:bg-white/5">
                      <td className="py-3 pr-4 font-semibold text-white">
                        {editingId === user.id ? (
                            <input id={`admin-user-name-${user.id}`} name={`userName-${user.id}`} aria-label={t("admin.users.table.name", "Name")} className="input" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                        ) : (
                          user.name
                        )}
                      </td>
                      <td className="py-3 pr-4 text-slatebody">{user.email}</td>
                      <td className="py-3 pr-4 text-slatebody capitalize">
                          {editingId === user.id ? (
                            <select id={`admin-user-role-${user.id}`} name={`userRole-${user.id}`} aria-label={t("admin.users.table.role", "Role")} className="input" disabled={me?.role !== "platform_admin"} value={form.role || user.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                              <option value="tourist">{t("admin.users.roleTourist", "tourist")}</option>
                              <option value="organizer">{t("admin.users.roleOrganizer", "organizer")}</option>
                              <option value="admin">{t("admin.users.roleAdmin", "admin")}</option>
                              <option value="platform_admin">{t("admin.users.rolePlatformAdmin", "platform_admin")}</option>
                              <option value="guest">{t("admin.users.roleGuest", "guest")}</option>
                            </select>
                          ) : (
                            roleLabel(user.role, t)
                          )}
                      </td>
                      <td className="py-3 pr-4 text-slatebody">{user.createdAt ? new Date(user.createdAt).toLocaleString() : t("admin.users.noValue", "—")}</td>
                      <td className="py-3 pr-4">
                        {editingId === user.id ? (
                          <div className="flex flex-wrap gap-2">
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
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary" onClick={() => { setEditingId(user.id); setForm({ name: user.name, role: user.role }); }}>{t("admin.users.edit", "Edit")}</button>
                            <button className="btn-ghost" onClick={async () => {
                              if (details[user.id]) {
                                setDetails((current) => ({ ...current, [user.id]: null }));
                                return;
                              }
                              setDetailsLoadingId(user.id);
                              try {
                                const response = await api(`/api/admin/users/${user.id}`);
                                setDetails((current) => ({ ...current, [user.id]: response.user }));
                              } catch (err) {
                                alert(err.message || t("admin.users.detailsFailed", "Unable to load user details."));
                              } finally {
                                setDetailsLoadingId(null);
                              }
                            }}>{detailsLoadingId === user.id ? t("common.loading", "Loading…") : details[user.id] ? t("admin.users.hideDetails", "Hide details") : t("admin.users.viewDetails", "View details")}</button>
                            <button className="btn-ghost" onClick={() => runSupportAction(user, "send_password_reset")}>{t("security.sendPasswordReset")}</button>
                            <button className="btn-ghost" onClick={() => runSupportAction(user, "expire_password_resets")}>{t("security.expireResetLinks")}</button>
                            <button className="btn-ghost" onClick={() => runSupportAction(user, "force_password_reset")}>{t("security.forcePasswordReset")}</button>
                            {user.accountStatus === "active" ? <button className="btn-ghost" onClick={() => runSupportAction(user, "suspend")}>{t("security.suspendAccount")}</button> : <button className="btn-ghost" onClick={() => runSupportAction(user, "reactivate")}>{t("security.reactivateAccount")}</button>}
                            <button className="btn-ghost" onClick={() => runSupportAction(user, "close")}>{t("security.closeAccount")}</button>
                            {me?.role === "platform_admin" ? <button className="btn-danger" onClick={() => runSupportAction(user, "anonymize", true)}>{t("security.anonymizeAccount")}</button> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                    {details[user.id] ? (
                      <tr className="border-b border-borderline bg-white/[0.03]">
                        <td colSpan={5} className="p-4">
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm text-slatebody">
                            <div><strong className="block text-white">{t("admin.users.verified", "Email verified")}</strong>{details[user.id].emailVerifiedAt ? t("common.yes", "Yes") : t("common.no", "No")}</div>
                            <div><strong className="block text-white">{t("admin.stats.trips", "Trips")}</strong>{details[user.id]._count?.trips || 0}</div>
                            <div><strong className="block text-white">{t("admin.stats.events", "Events")}</strong>{details[user.id]._count?.organizedEvents || 0}</div>
                            <div><strong className="block text-white">{t("admin.management.guests", "Guest sessions")}</strong>{details[user.id]._count?.claimedGuestSessions || 0}</div>
                            <div><strong className="block text-white">{t("admin.management.purchases", "Purchases")}</strong>{details[user.id]._count?.purchases || 0}</div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <section className="card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.resetRequests.supportQueueEyebrow")}</p>
              <h2 className="mt-2 text-3xl font-black font-serif">{t("security.resetRequests.pendingTitle")}</h2>
            </div>
            <span className="rounded-full border border-borderline px-3 py-1 text-sm text-slatebody">{resetRequests.length}</span>
          </div>
          {resetRequests.length === 0 ? <p className="mt-4 text-slatebody">{t("security.resetRequests.nonePending")}</p> : (
            <div className="mt-4 grid gap-4">
              {resetRequests.map((request) => (
                <article key={request.id} className="rounded-3xl border border-borderline p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{request.requestType === "password_reset" ? t("security.resetRequests.passwordRequest") : t("security.resetRequests.guestRequest")}</p>
                      <p className="mt-1 text-sm text-slatebody">
                        {request.user?.name || request.guestName || t("admin.users.noValue", "—")}
                        {request.user?.email || request.contactEmail ? ` · ${request.user?.email || request.contactEmail}` : ""}
                      </p>
                    </div>
                    <time className="text-sm text-slatebody">{new Date(request.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm">{request.message}</p>
                  {request.contactNote ? <p className="mt-2 text-sm text-slatebody"><strong>{t("security.resetRequests.contactNoteLabel")}:</strong> {request.contactNote}</p> : null}
                  {request.contextNote ? <p className="mt-2 text-sm text-slatebody"><strong>{t("security.resetRequests.contextNoteLabel")}:</strong> {request.contextNote}</p> : null}
                  {request.requestType === "guest_pin_reset" ? (
                    <select className="field mt-3 w-full max-w-xl" aria-label={t("security.resetRequests.selectVerifiedGuest")} value={requestGuestSelections[request.id] || request.guestSessionId || ""} onChange={(event) => setRequestGuestSelections((current) => ({ ...current, [request.id]: event.target.value }))}>
                      <option value="">{t("security.resetRequests.selectVerifiedGuest")}</option>
                      {guests.filter((guest) => !guest.deletedAt && !guest.claimedById).map((guest) => (
                        <option key={guest.id} value={guest.id}>{guest.displayName || t("admin.users.noValue", "—")} · {guestStatusLabel(guest.status, t)}</option>
                      ))}
                    </select>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {request.requestType === "password_reset" ? <button className="btn-primary" onClick={() => runResetRequestAction(request, "send_password_reset")}>{t("security.sendPasswordReset")}</button> : null}
                    {request.requestType === "guest_pin_reset" ? <button className="btn-primary" onClick={() => runResetRequestAction(request, "generate_guest_pin_reset")}>{t("security.generateGuestPinReset")}</button> : null}
                    <button className="btn-ghost" onClick={() => runResetRequestAction(request, "resolve")}>{t("security.resetRequests.resolve")}</button>
                    <button className="btn-ghost" onClick={() => runResetRequestAction(request, "dismiss")}>{t("security.resetRequests.dismiss")}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="card overflow-x-auto p-5">
          <div className="mb-4">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.resetRequests.guestAccountsEyebrow")}</p>
            <h2 className="mt-2 text-3xl font-black font-serif">{t("security.resetRequests.guestAccountsTitle")}</h2>
            <p className="mt-2 text-slatebody">{t("security.resetRequests.guestAccountsHelp")}</p>
          </div>
          {guests.length === 0 ? <p className="text-slatebody">{t("security.resetRequests.noGuests")}</p> : (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-borderline text-slatebody">
                  <th className="py-3 pr-4">{t("admin.users.table.name", "Name")}</th>
                  <th className="py-3 pr-4">{t("security.resetRequests.status")}</th>
                  <th className="py-3 pr-4">{t("admin.users.table.created", "Created")}</th>
                  <th className="py-3 pr-4">{t("security.resetRequests.lastActive")}</th>
                  <th className="py-3 pr-4">{t("security.resetRequests.linkedActivity")}</th>
                  <th className="py-3 pr-4">{t("admin.users.table.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((guest) => (
                  <Fragment key={guest.id}>
                    <tr className="border-b border-borderline">
                      <td className="py-3 pr-4 font-semibold">{guest.displayName || t("admin.users.noValue", "—")}</td>
                      <td className="py-3 pr-4 text-slatebody">{guestStatusLabel(guest.status, t)}</td>
                      <td className="py-3 pr-4 text-slatebody">{new Date(guest.createdAt).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-slatebody">{guest.lastGuestAccessAt ? new Date(guest.lastGuestAccessAt).toLocaleString() : t("admin.users.noValue", "—")}</td>
                      <td className="py-3 pr-4 text-slatebody">{(guest._count?.trips || 0) + (guest._count?.uploads || 0)}</td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-ghost" onClick={() => setGuestDetails((current) => ({ ...current, [guest.id]: !current[guest.id] }))}>{guestDetails[guest.id] ? t("admin.users.hideDetails", "Hide details") : t("admin.users.viewDetails", "View details")}</button>
                          <button className="btn-ghost" onClick={() => runGuestSupportAction(guest, "generate_pin_reset")}>{t("security.generateGuestPinReset")}</button>
                          <button className="btn-ghost" onClick={() => runGuestSupportAction(guest, "revoke_links")}>{t("security.revokeGuestLinks")}</button>
                          <button className="btn-ghost" onClick={() => runGuestSupportAction(guest, "force_pin_reset")}>{t("security.forceGuestPin")}</button>
                          <button className="btn-ghost" onClick={() => runGuestSupportAction(guest, "revoke_access")}>{t("security.revokeGuestAccess")}</button>
                          <button className="btn-danger" onClick={() => runGuestSupportAction(guest, "delete_session", true)}>{t("security.deleteGuestSession")}</button>
                        </div>
                      </td>
                    </tr>
                    {guestDetails[guest.id] ? (
                      <tr className="border-b border-borderline bg-white/[0.03]">
                        <td colSpan={6} className="p-4 text-sm text-slatebody">
                          <div className="grid gap-3 sm:grid-cols-4">
                            <span>{t("admin.stats.trips", "Trips")}: {guest._count?.trips || 0}</span>
                            <span>{t("admin.stats.uploads", "Uploads")}: {guest._count?.uploads || 0}</span>
                            <span>{t("admin.stats.events", "Events")}: {guest._count?.events || 0}</span>
                            <span>{t("qrSpaces.title", "QR spaces")}: {guest._count?.qrUploadSpaces || 0}</span>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.tools.backToAdminDashboard", "Back to admin dashboard")}</Link>
          <Link className="btn-primary w-full" to="/admin/moderation">{t("admin.moderation.title", "Review flagged activity")}</Link>
        </div>
      </main>
  );
}
