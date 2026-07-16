import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../lib/i18n.js";
import { api } from "../../lib/api.js";

export default function AdminManagement() {
  const { t } = useLanguage();
  const [data, setData] = useState({ guests: [], users: [], items: [], ads: [], notifications: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [notification, setNotification] = useState({ userId: "", title: "", message: "", type: "info", targetUrl: "" });
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importRunning, setImportRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [guests, users, store, ads, notifications] = await Promise.all([
        api("/api/admin/guests"),
        api("/api/admin/users"),
        api("/api/admin/store"),
        api("/api/admin/ads"),
        api("/api/admin/notifications?limit=30")
      ]);
      setData({
        guests: Array.isArray(guests.guests) ? guests.guests : [],
        users: Array.isArray(users.users) ? users.users : [],
        items: Array.isArray(store.items) ? store.items : [],
        ads: Array.isArray(ads.ads) ? ads.ads : [],
        notifications: Array.isArray(notifications.notifications) ? notifications.notifications : []
      });
    } catch (requestError) {
      setError(requestError.message || t("admin.management.loadError", "Unable to load management controls."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function runGuestSupport(guest, action, destructive = false) {
    const reason = window.prompt(t("security.reasonPrompt"));
    if (!reason || reason.trim().length < 5) return;
    if (destructive && !window.confirm(t("security.destructiveConfirmation"))) return;
    try {
      const response = await api(`/api/admin/guests/${guest.id}/support`, {
        method: "POST",
        body: JSON.stringify({ action, reason: reason.trim(), confirmation: destructive })
      });
      if (response.recoveryUrl) window.alert(`${t("security.guestRecoveryUrl")} ${response.recoveryUrl}`);
      setData((current) => ({
        ...current,
        guests: current.guests.map((entry) => entry.id === guest.id ? {
          ...entry,
          accessRevokedAt: response.status === "revoked" ? new Date().toISOString() : entry.accessRevokedAt,
          pinResetRequired: response.status === "pin_reset_required",
          deletedAt: response.status === "deleted" ? new Date().toISOString() : entry.deletedAt
        } : entry)
      }));
      setSuccess(t("security.supportActionComplete"));
    } catch (requestError) {
      setError(requestError.message || t("security.supportActionFailed"));
    }
  }

  async function toggleStoreItem(item) {
    const action = item.active ? t("admin.management.deactivate", "deactivate") : t("admin.management.activate", "activate");
    if (!window.confirm(t("admin.management.confirmStoreStatus", "Confirm {action} for this store item?", { action }))) return;
    try {
      const response = await api(`/api/admin/store/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active })
      });
      setData((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? response.item : entry) }));
      setSuccess(t("admin.management.saved", "Changes saved."));
    } catch (requestError) {
      setError(requestError.message || t("admin.management.actionError", "The action could not be completed."));
    }
  }

  async function toggleAd(ad) {
    const action = ad.active ? t("admin.management.deactivate", "deactivate") : t("admin.management.activate", "activate");
    if (!window.confirm(t("admin.management.confirmAdStatus", "Confirm {action} for this advertisement?", { action }))) return;
    try {
      const response = await api(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !ad.active })
      });
      setData((current) => ({ ...current, ads: current.ads.map((entry) => entry.id === ad.id ? response.ad : entry) }));
      setSuccess(t("admin.management.saved", "Changes saved."));
    } catch (requestError) {
      setError(requestError.message || t("admin.management.actionError", "The action could not be completed."));
    }
  }

  async function deleteAd(ad) {
    if (!window.confirm(t("admin.management.confirmDeleteAd", "Permanently delete this advertisement?"))) return;
    try {
      await api(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
      setData((current) => ({ ...current, ads: current.ads.filter((entry) => entry.id !== ad.id) }));
      setSuccess(t("admin.management.deleted", "Item deleted."));
    } catch (requestError) {
      setError(requestError.message || t("admin.management.actionError", "The action could not be completed."));
    }
  }

  async function sendNotification(event) {
    event.preventDefault();
    setSending(true);
    setError("");
    setSuccess("");
    try {
      const response = await api("/api/admin/notifications", {
        method: "POST",
        body: JSON.stringify({ ...notification, targetUrl: notification.targetUrl || null })
      });
      const recipient = data.users.find((user) => user.id === notification.userId);
      setData((current) => ({
        ...current,
        notifications: [{ ...response.notification, user: recipient || null }, ...current.notifications].slice(0, 30)
      }));
      setNotification({ userId: "", title: "", message: "", type: "info", targetUrl: "" });
      setSuccess(t("admin.management.notificationSent", "Notification sent."));
    } catch (requestError) {
      setError(requestError.message || t("admin.management.notificationError", "Notification could not be sent."));
    } finally {
      setSending(false);
    }
  }

  async function downloadSiteExport() {
    try {
      const response = await api("/api/admin/export/site", { method: "POST" });
      // Trigger download
      const blob = new Blob([JSON.stringify(response)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travelshare-site-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || t("admin.management.exportError", "Could not export site."));
    }
  }

  async function downloadMyExport() {
    try {
      // user-level export endpoint returns JSON directly
      const response = await fetch(`${import.meta.env.VITE_API_URL || ""}/api/export`, { credentials: "include" });
      if (!response.ok) throw new Error(`Export failed: ${response.statusText}`);
      const json = await response.json();
      const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travelshare-user-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || t("admin.management.userExportError", "Could not export user data."));
    }
  }

  function handleImportFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setImportPreview(parsed);
        setImportResult(null);
      } catch (err) {
        setError(t("admin.management.invalidJson", "Selected file is not valid JSON."));
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  }

  async function runImportDryRun() {
    if (!importPreview) return setError(t("admin.management.noImportFile", "No import file loaded."));
    setImportRunning(true);
    setError("");
    setImportResult(null);
    try {
      const response = await api(`/api/admin/import?dryRun=true`, { method: "POST", body: JSON.stringify(importPreview) });
      setImportResult(response);
    } catch (err) {
      setError(err.message || t("admin.management.importError", "Import dry-run failed."));
    } finally {
      setImportRunning(false);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.management.badge", "Admin management")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.management.title", "Platform resources")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("admin.management.description", "Review guest sessions, control catalog visibility, manage advertisements, and send account notifications.")}</p>
      </section>

      {error ? <div className="card border border-rose-500 p-4 text-rose-200" role="alert">{error}</div> : null}
      {success ? <div className="card border border-emerald-500 p-4 text-emerald-200" role="status">{success}</div> : null}
      {loading ? <div className="card p-5 text-center text-slatebody">{t("admin.management.loading", "Loading management controls…")}</div> : (
        <>
          <section className="card overflow-x-auto p-5 bg-slate-950/90 border border-white/10">
            <h2 className="text-2xl font-black font-serif">{t("admin.management.guests", "Guest sessions")}</h2>
            <h3 className="mt-2 text-xl font-black">{t("security.adminSupportTitle")}</h3>
            <p className="mt-2 text-sm text-slatebody">{t("admin.management.guestsHelp", "Credential fields are intentionally excluded from this admin view.")}</p>
            {data.guests.length === 0 ? <p className="mt-4 text-slatebody">{t("admin.management.noGuests", "No guest sessions found.")}</p> : (
              <table className="mt-4 w-full min-w-[720px] text-left text-sm">
                <thead><tr className="border-b border-borderline text-slatebody"><th className="py-3">{t("admin.management.guest", "Guest")}</th><th>{t("admin.management.scope", "Scope")}</th><th>{t("admin.management.uploads", "Uploads")}</th><th>{t("admin.management.expires", "Expires")}</th><th>{t("admin.management.claimedBy", "Claimed by")}</th><th>{t("security.accountControls")}</th></tr></thead>
                <tbody>{data.guests.map((guest) => <tr className="border-b border-borderline align-top" key={guest.id}><td className="py-3 text-white">{guest.displayName || t("admin.management.unnamedGuest", "Unnamed guest")}</td><td>{guest.scopeType || t("admin.management.general", "General")}</td><td>{guest._count?.uploads || 0}</td><td>{new Date(guest.expiresAt).toLocaleString()}</td><td>{guest.claimedBy?.email || t("admin.management.unclaimed", "Unclaimed")}</td><td><div className="flex max-w-xl flex-wrap gap-2"><button className="btn-ghost" onClick={() => runGuestSupport(guest, "generate_pin_reset")}>{t("security.generateGuestPinReset")}</button><button className="btn-ghost" onClick={() => runGuestSupport(guest, "revoke_links")}>{t("security.revokeGuestLinks")}</button><button className="btn-ghost" onClick={() => runGuestSupport(guest, "force_pin_reset")}>{t("security.forceGuestPin")}</button><button className="btn-ghost" onClick={() => runGuestSupport(guest, "revoke_access")}>{t("security.revokeGuestAccess")}</button><button className="btn-danger" onClick={() => runGuestSupport(guest, "delete_session", true)}>{t("security.deleteGuestSession")}</button></div></td></tr>)}</tbody>
              </table>
            )}
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <div className="card p-5 bg-slate-950/90 border border-white/10">
              <h2 className="text-2xl font-black font-serif">{t("admin.management.storeItems", "Store items")}</h2>
              {data.items.length === 0 ? <p className="mt-4 text-slatebody">{t("admin.management.noStoreItems", "No store items found.")}</p> : <div className="mt-4 space-y-3">{data.items.map((item) => <div className="rounded-2xl border border-borderline p-4" key={item.id}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-white">{item.name}</p><p className="text-sm text-slatebody">{item.type.replaceAll("_", " ")} · {(item.priceCents / 100).toFixed(2)} · {item._count?.purchases || 0} {t("admin.management.purchases", "purchases")}</p></div><button className="btn-ghost" onClick={() => toggleStoreItem(item)}>{item.active ? t("admin.management.deactivate", "Deactivate") : t("admin.management.activate", "Activate")}</button></div></div>)}</div>}
            </div>

            <div className="card p-5 bg-slate-950/90 border border-white/10">
              <h2 className="text-2xl font-black font-serif">{t("admin.management.ads", "Advertisements")}</h2>
              <p className="mt-2 text-sm text-slatebody">{t("admin.management.adsHelp", "Use this page for quick ad toggles, or open the full ad management page for detail edits.")}</p>
              {data.ads.length === 0 ? <p className="mt-4 text-slatebody">{t("admin.management.noAds", "No advertisements found.")}</p> : <div className="mt-4 space-y-3">{data.ads.map((ad) => <div className="rounded-2xl border border-borderline p-4" key={ad.id}><p className="font-semibold text-white">{ad.title}</p><p className="text-sm text-slatebody">{ad.placement} · {ad.mediaType}</p><div className="mt-3 flex flex-wrap gap-2"><button className="btn-ghost" onClick={() => toggleAd(ad)}>{ad.active ? t("admin.management.deactivate", "Deactivate") : t("admin.management.activate", "Activate")}</button><button className="btn-danger" onClick={() => deleteAd(ad)}>{t("admin.management.delete", "Delete")}</button></div></div>)}</div>}
              <div className="mt-4">
                <Link className="btn-ghost" to="/admin/ads">{t("admin.management.viewAllAds", "Manage all ads")}</Link>
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <form className="card p-5 bg-slate-950/90 border border-white/10" onSubmit={sendNotification}>
              <h2 className="text-2xl font-black font-serif">{t("admin.management.sendNotification", "Send notification")}</h2>
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-slatebody">{t("admin.management.recipient", "Recipient")}<select id="admin-notification-recipient" name="recipientId" required className="input mt-1 w-full" value={notification.userId} onChange={(event) => setNotification((current) => ({ ...current, userId: event.target.value }))}><option value="">{t("admin.management.chooseUser", "Choose a user")}</option>{data.users.map((user) => <option value={user.id} key={user.id}>{user.name} ({user.email})</option>)}</select></label>
                <label className="block text-sm text-slatebody">{t("admin.management.notificationTitle", "Title")}<input id="admin-notification-title" name="title" required maxLength={120} className="input mt-1 w-full" value={notification.title} onChange={(event) => setNotification((current) => ({ ...current, title: event.target.value }))} /></label>
                <label className="block text-sm text-slatebody">{t("admin.management.message", "Message")}<textarea id="admin-notification-message" name="message" required maxLength={500} className="input mt-1 min-h-28 w-full" value={notification.message} onChange={(event) => setNotification((current) => ({ ...current, message: event.target.value }))} /></label>
                <label className="block text-sm text-slatebody">{t("admin.management.internalTarget", "Internal target path (optional)")}<input id="admin-notification-target" name="targetUrl" placeholder="/dashboard" className="input mt-1 w-full" value={notification.targetUrl} onChange={(event) => setNotification((current) => ({ ...current, targetUrl: event.target.value }))} /></label>
                <button className="btn-primary w-full" disabled={sending}>{sending ? t("admin.management.sending", "Sending…") : t("admin.management.send", "Send")}</button>
              </div>
            </form>

            <div className="card p-5 bg-slate-950/90 border border-white/10">
              <h2 className="text-2xl font-black font-serif">{t("admin.management.recentNotifications", "Recent notifications")}</h2>
              {data.notifications.length === 0 ? <p className="mt-4 text-slatebody">{t("admin.management.noNotifications", "No notifications found.")}</p> : <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto">{data.notifications.map((entry) => <div className="rounded-2xl border border-borderline p-4" key={entry.id}><p className="font-semibold text-white">{entry.title}</p><p className="text-sm text-slatebody">{entry.user?.email || t("admin.management.unknownRecipient", "Unknown recipient")} · {new Date(entry.createdAt).toLocaleString()}</p><p className="mt-2 text-sm text-slatebody">{entry.message}</p></div>)}</div>}
            </div>
          </section>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.tools.backToAdmin", "Back to admin dashboard")}</Link>
        <button className="btn-primary w-full" onClick={load} disabled={loading}>{t("common.refresh", "Refresh")}</button>
      </div>
      
      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">{t("admin.management.dataExportImport", "Export / Import")}</h2>
        <p className="mt-2 text-sm text-slatebody">{t("admin.management.dataExportImportHelp", "Download a full site export, download your user export, or validate an import package (dry-run). For full restores use DB backup/restore scripts.")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button className="btn-ghost" onClick={downloadSiteExport}>{t("admin.management.downloadSiteExport", "Download site export")}</button>
          <button className="btn-ghost" onClick={downloadMyExport}>{t("admin.management.downloadUserExport", "Download my user export")}</button>
          <label className="inline-flex items-center gap-2">
            <input id="admin-management-import-file" name="importFile" type="file" accept="application/json" onChange={handleImportFile} />
            <span className="text-sm text-slatebody">{importFileName || t("admin.management.chooseImportFile", "Choose import JSON file")}</span>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className="btn-primary" onClick={runImportDryRun} disabled={!importPreview || importRunning}>{importRunning ? t("admin.management.running", "Running…") : t("admin.management.runDryRun", "Run import dry-run")}</button>
          <button className="btn-ghost" onClick={() => { setImportPreview(null); setImportFileName(""); setImportResult(null); }}>{t("admin.management.clearImport", "Clear import")}</button>
        </div>

        {importResult ? (
          <div className="mt-4 rounded-2xl border border-borderline p-4 bg-slate-900 text-sm text-slatebody">
            <pre className="whitespace-pre-wrap break-words">{JSON.stringify(importResult, null, 2)}</pre>
          </div>
        ) : importPreview ? (
          <div className="mt-4 rounded-2xl border border-borderline p-4 bg-slate-900 text-sm text-slatebody">
            <p className="font-semibold text-white">{t("admin.management.importPreview", "Import preview")}</p>
            <p className="mt-2 text-sm">{t("admin.management.previewCounts", "Users: {users}, Trips: {trips}, Events: {events}, Uploads: {uploads}", { users: Array.isArray(importPreview.users) ? importPreview.users.length : 0, trips: Array.isArray(importPreview.trips) ? importPreview.trips.length : 0, events: Array.isArray(importPreview.events) ? importPreview.events.length : 0, uploads: Array.isArray(importPreview.uploads) ? importPreview.uploads.length : 0 })}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
