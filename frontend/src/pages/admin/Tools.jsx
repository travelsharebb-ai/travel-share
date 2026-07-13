import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, currentUser } from "../../lib/api.js";
import { useLanguage } from "../../lib/i18n";
const BACKUP_SCRIPT_PATH = "scripts/db-backup.sh";
const RESTORE_SCRIPT_PATH = "scripts/db-restore.sh";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping

export default function AdminTools() {
  const { t } = useLanguage();
  const me = currentUser();
  const isPlatformAdmin = me?.role === "platform_admin";

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState("");

  const [siteExportLoading, setSiteExportLoading] = useState(false);
  const [userExportLoading, setUserExportLoading] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importFileError, setImportFileError] = useState("");
  const [importSummary, setImportSummary] = useState(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [confirmationInput, setConfirmationInput] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const backupRetentionInfo = useMemo(() => [
    t("admin.tools.backupHistoryLatest", "Latest backup time"),
    t("admin.tools.backupHistoryLocation", "Storage location"),
    t("admin.tools.backupHistoryRetention", "Retention period"),
    t("admin.tools.backupHistoryRestoreTest", "Restore test date"),
    t("admin.tools.backupHistoryOperator", "Operator responsible")
  ], [t]);

  const loadAuditLogs = useCallback(async () => {
    setAuditError("");
    setAuditLoading(true);
    try {
      const data = await api("/api/admin/audit/moderation");
      setAuditLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (err) {
      setAuditError(err.message || t("admin.tools.auditLoadError", "Unable to load audit logs."));
    } finally {
      setAuditLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
  }

  async function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleSiteExport() {
    setActionMessage("");
    setActionError("");
    setSiteExportLoading(true);
    try {
      const payload = await api("/api/admin/export/site", { method: "POST" });
      await downloadJson(payload, "travelshare-site-export.json");
      setActionMessage(t("admin.tools.siteExportSuccess", "Site export downloaded."));
    } catch (err) {
      setActionError(err.message || t("admin.tools.siteExportError", "Site export failed."));
    } finally {
      setSiteExportLoading(false);
    }
  }

  async function handleUserExport() {
    setActionMessage("");
    setActionError("");
    setUserExportLoading(true);
    try {
      const payload = await api("/api/auth/export?format=json");
      await downloadJson(payload, `travelshare-user-export-${me?.id || "self"}.json`);
      setActionMessage(t("admin.tools.userExportSuccess", "User export downloaded."));
    } catch (err) {
      setActionError(err.message || t("admin.tools.userExportError", "User export failed."));
    } finally {
      setUserExportLoading(false);
    }
  }

  function validatePackageShape(value) {
    if (!value || typeof value !== "object") return false;
    return ["users", "trips", "events", "uploads", "storeItems"].some((key) => Array.isArray(value[key]));
  }

  async function handleImportFile(event) {
    setImportFile(null);
    setImportSummary(null);
    setDryRunResult(null);
    setActionMessage("");
    setActionError("");
    setConfirmationInput("");
    setImportFileError("");

    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension !== "json" && !file.type.includes("json")) {
      setImportFileError(t("admin.tools.importFileTypeError", "Only JSON import packages are accepted."));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setImportFileError(t("admin.tools.importFileSizeError", "File is too large. Maximum allowed size is 50 MB."));
      return;
    }
    try {
      const text = await file.text();
      const value = JSON.parse(text);
      if (!validatePackageShape(value)) {
        setImportFileError(t("admin.tools.importFileShapeError", "The JSON package does not contain the expected Travel Share export arrays."));
        return;
      }
      setImportFile(file);
      setImportSummary({
        users: Array.isArray(value.users) ? value.users.length : 0,
        trips: Array.isArray(value.trips) ? value.trips.length : 0,
        events: Array.isArray(value.events) ? value.events.length : 0,
        uploads: Array.isArray(value.uploads) ? value.uploads.length : 0,
        storeItems: Array.isArray(value.storeItems) ? value.storeItems.length : 0,
        raw: value
      });
    } catch (err) {
      setImportFileError(t("admin.tools.importFileParseError", "Unable to parse JSON. Please upload a valid JSON export package."));
    }
  }

  async function handleDryRun() {
    if (!importSummary?.raw) return;
    setDryRunLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const response = await api("/api/admin/import?dryRun=true", {
        method: "POST",
        body: JSON.stringify(importSummary.raw)
      });
      setDryRunResult(response);
      setActionMessage(t("admin.tools.dryRunSuccess", "Dry-run completed."));
    } catch (err) {
      setDryRunResult(null);
      setActionError(err.message || t("admin.tools.dryRunError", "Dry-run failed."));
    } finally {
      setDryRunLoading(false);
    }
  }

  async function handleActualImport() {
    if (!importSummary?.raw) return;
    if (confirmationInput !== "IMPORT CONFIRMED") return;
    setImportLoading(true);
    setActionMessage("");
    setActionError("");
    try {
      const response = await api("/api/admin/import?dryRun=false", {
        method: "POST",
        body: JSON.stringify(importSummary.raw)
      });
      setActionMessage(t("admin.tools.importSuccess", "Import request completed."));
      setDryRunResult(response);
    } catch (err) {
      setActionError(err.message || t("admin.tools.importError", "Import failed."));
    } finally {
      setImportLoading(false);
    }
  }

  const cards = [
    { id: 'users', title: t('admin.tools.users','Users'), description: t('admin.tools.usersDescription','Manage accounts and roles.'), to: "/admin/users" },
    { id: 'moderation', title: t('admin.tools.moderation','Moderation'), description: t('admin.tools.moderationDescription','Review reported uploads and activity.'), to: "/admin/moderation" },
    { id: 'management', title: t('admin.tools.management','Management'), description: t('admin.tools.managementDescription','Manage guest sessions, catalog visibility, ads, and notifications.'), to: "/admin/management" },
    { id: 'ads', title: t('admin.tools.ads','Ads'), description: t('admin.tools.adsDescription','Manage internal advertisements and media assets.'), to: "/admin/ads" },
    { id: 'reports', title: t('admin.tools.reports','Reports'), description: t('admin.tools.reportsDescription','View analytics and platform insights.'), to: "/admin/reports" },
    { id: 'data', title: t('admin.tools.data','Data'), description: t('admin.tools.dataDescription','Export, import, and backup tools.'), to: "/admin/data" },
    { id: 'map', title: t('admin.tools.map','Map'), description: t('admin.tools.mapDescription','Open the admin map workflow.'), to: "/map" },
    { id: 'qr-spaces', title: t('qrSpaces.manageAdmin'), description: t('qrSpaces.manageAdminHelp'), to: "/qr-spaces" },
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

        <section className="space-y-6">
          <h2 className="text-3xl font-black font-serif">{t("admin.tools.dataToolsTitle", "Backup, export, and import tools")}</h2>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="card border border-borderline bg-slate-950/90 p-5">
              <h3 className="text-2xl font-black font-serif">{t("admin.tools.exportImportTitle", "Export / import")}</h3>
              <p className="mt-2 text-slatebody text-sm">{t("admin.tools.exportImportDescription", "Download platform export packages, validate import data, and run safe admin import operations.")}</p>

              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button className="btn-primary w-full" onClick={handleSiteExport} disabled={siteExportLoading}>{siteExportLoading ? t("admin.tools.downloading","Downloading…") : t("admin.tools.downloadSiteExport","Download site export JSON")}</button>
                  <button className="btn-ghost w-full" onClick={handleUserExport} disabled={userExportLoading}>{userExportLoading ? t("admin.tools.downloading","Downloading…") : t("admin.tools.downloadUserExport","Download user export JSON")}</button>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4">
                  <label className="block text-sm text-slatebody">{t("admin.tools.importFileLabel","Import package")}</label>
                  <input id="admin-tools-import-file" name="importFile" className="input mt-2 w-full" type="file" accept="application/json,.json" onChange={handleImportFile} />
                  {importFile ? (
                    <p className="mt-2 text-sm text-slatebody">{t("admin.tools.importFileSelected","Selected file:")} <span className="font-medium text-white">{importFile.name}</span> · {formatBytes(importFile.size)}</p>
                  ) : null}
                  {importFileError ? <p className="mt-2 text-sm text-rose-300">{importFileError}</p> : null}
                  {importSummary ? (
                    <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-slatebody">
                      <p className="font-semibold text-white">{t("admin.tools.importPackageSummary","Package summary")}</p>
                      <p>{t("admin.tools.importSummaryUsers","Users")}: {importSummary.users}</p>
                      <p>{t("admin.tools.importSummaryTrips","Trips")}: {importSummary.trips}</p>
                      <p>{t("admin.tools.importSummaryEvents","Events")}: {importSummary.events}</p>
                      <p>{t("admin.tools.importSummaryUploads","Uploads")}: {importSummary.uploads}</p>
                      <p>{t("admin.tools.importSummaryStoreItems","Store items")}: {importSummary.storeItems}</p>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button className="btn-secondary w-full" onClick={handleDryRun} disabled={!importSummary || dryRunLoading || Boolean(importFileError)}>{dryRunLoading ? t("admin.tools.validating","Validating…") : t("admin.tools.runDryRun","Run import dry-run")}</button>
                  <button className="btn-danger w-full" onClick={handleActualImport} disabled={!importSummary || !dryRunResult?.valid || importLoading || !isPlatformAdmin || confirmationInput !== "IMPORT CONFIRMED"}>{importLoading ? t("admin.tools.importing","Importing…") : t("admin.tools.runActualImport","Run actual import")}</button>
                </div>

                <div className="space-y-3 rounded-3xl border border-borderline bg-slate-950/70 p-4 text-sm text-slatebody">
                  <p>{t("admin.tools.importWarning","Import operations are sensitive. Always dry-run first, confirm the exact phrase, and only platform admins may run actual imports.")}</p>
                  <p>{t("admin.tools.importNote","The current backend import endpoint validates packages and protects production data through review before actual changes.")}</p>
                  <label className="block">
                    <span className="text-sm text-slatebody">{t("admin.tools.confirmationLabel","Type IMPORT CONFIRMED to enable actual import")}</span>
                    <input id="admin-tools-import-confirmation" name="importConfirmation" className="input mt-2 w-full" value={confirmationInput} onChange={(event) => setConfirmationInput(event.target.value)} placeholder={t("admin.tools.confirmationPlaceholder","IMPORT CONFIRMED")} />
                  </label>
                  {!isPlatformAdmin ? <p className="text-sm text-amber-300">{t("admin.tools.platformAdminOnly","Actual import requires platform admin permissions.")}</p> : null}
                </div>

                {dryRunResult ? (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slatebody">
                    <p className="font-semibold text-white">{t("admin.tools.dryRunResultTitle","Dry-run result")}</p>
                    <p>{t("admin.tools.dryRunStatus","Status")}: <span className="font-medium text-white">{dryRunResult.valid ? t("admin.tools.valid","Valid") : t("admin.tools.invalid","Invalid")}</span></p>
                    <p>{t("admin.tools.dryRunMessage","Message")}: {dryRunResult.message || t("admin.tools.noMessage","No message provided.")}</p>
                    <p>{t("admin.tools.dryRunCounts","Records")}: {dryRunResult.counts ? `${dryRunResult.counts.users} users, ${dryRunResult.counts.trips} trips, ${dryRunResult.counts.events} events, ${dryRunResult.counts.uploads} uploads, ${dryRunResult.counts.storeItems} store items` : t("admin.tools.noCounts","No record counts available.")}</p>
                  </div>
                ) : null}

                {actionMessage ? <div className="rounded-3xl border border-emerald-500 bg-emerald-950/10 p-4 text-emerald-200" role="status">{actionMessage}</div> : null}
                {actionError ? <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-4 text-rose-200" role="alert">{actionError}</div> : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card border border-borderline bg-slate-950/90 p-5">
                <h3 className="text-2xl font-black font-serif">{t("admin.tools.backupRestoreTitle","Database backup and restore")}</h3>
                <p className="mt-2 text-slatebody text-sm">{t("admin.tools.backupRestoreDescription","Database backups and restores are operator-level tasks. Use the CLI scripts and environment settings rather than running unsafe restore actions from the browser.")}</p>
                <div className="mt-4 space-y-3 text-sm text-slatebody">
                  <p>{t("admin.tools.backupScript","Backup script")}: <code className="break-all">{BACKUP_SCRIPT_PATH}</code></p>
                  <p>{t("admin.tools.restoreScript","Restore script")}: <code className="break-all">{RESTORE_SCRIPT_PATH}</code></p>
                  <ul className="list-inside list-disc space-y-1 text-slatebody">
                    <li>{t("admin.tools.backupWarningVerifyEnv","Verify environment variables and target database before running a restore.")}</li>
                    <li>{t("admin.tools.backupWarningBackupFirst","Always take a backup before restoring.")}</li>
                    <li>{t("admin.tools.backupWarningDontRestoreProduction","Never restore production accidentally.")}</li>
                    <li>{t("admin.tools.backupWarningKeepSecrets","Keep secrets out of source control and repository logs.")}</li>
                  </ul>
                </div>
              </div>

              <div className="card border border-borderline bg-slate-950/90 p-5">
                <h3 className="text-2xl font-black font-serif">{t("admin.tools.backupHistoryTitle","Backup history and retention")}</h3>
                <p className="mt-2 text-slatebody text-sm">{t("admin.tools.backupHistoryDescription","Backup history is managed outside the app by hosting/storage providers or backup script logs. Track the fields below for audit readiness.")}</p>
                <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slatebody">
                  {backupRetentionInfo.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>

              <div className="card border border-borderline bg-slate-950/90 p-5">
                <h3 className="text-2xl font-black font-serif">{t("admin.tools.auditTitle","Admin audit activity")}</h3>
                <p className="mt-2 text-slatebody text-sm">{t("admin.tools.auditDescription","Recent moderation audit history is shown below. Audit support for export/import events is not yet available in the backend.")}</p>
                {auditLoading ? (
                  <p className="mt-4 text-slatebody">{t("admin.tools.auditLoading","Loading audit history…")}</p>
                ) : auditError ? (
                  <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-4 text-rose-200" role="alert">{auditError}</div>
                ) : auditLogs.length === 0 ? (
                  <p className="mt-4 text-slatebody">{t("admin.tools.auditEmpty","No moderation audit entries found.")}</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {auditLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slatebody">
                        <p className="font-semibold text-white">{log.action}</p>
                        <p>{t("admin.tools.auditActor","Actor")}: {log.admin?.name || log.admin?.email || log.admin?.id}</p>
                        <p>{t("admin.tools.auditTarget","Target upload")}: {log.upload?.caption || log.upload?.id}</p>
                        {log.notes ? <p>{t("admin.tools.auditNotes","Notes")}: {log.notes}</p> : null}
                        <p>{new Date(log.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin">{t('admin.tools.backToAdmin','Back to admin dashboard')}</Link>
          <Link className="btn-primary w-full" to="/admin/users">{t('admin.tools.viewAllUsers','View all users')}</Link>
        </div>
      </main>
  );
}
