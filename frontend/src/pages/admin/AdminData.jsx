import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../lib/i18n.js";
import { api } from "../../lib/api.js";

export default function AdminData() {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreview, setImportPreview] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const downloadSiteExport = useCallback(async () => {
    setError("");
    try {
      const response = await api("/api/admin/export/site", { method: "POST" });
      const blob = new Blob([JSON.stringify(response)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `travelshare-site-export-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSuccess(t("admin.data.exported", "Site export downloaded."));
    } catch (err) {
      setError(err.message || t("admin.data.exportError", "Could not export site."));
    }
  }, [t]);

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setImportPreview(parsed);
        setImportResult(null);
        setError("");
      } catch (err) {
        setError(t("admin.data.invalidJson", "Selected file is not valid JSON."));
        setImportPreview(null);
      }
    };
    reader.readAsText(file);
  };

  const runDryRun = useCallback(async () => {
    if (!importPreview) return setError(t("admin.data.noFile", "No import file loaded."));
    setRunning(true);
    setError("");
    setImportResult(null);
    try {
      const response = await api(`/api/admin/import?dryRun=true`, { method: "POST", body: JSON.stringify(importPreview) });
      setImportResult(response);
    } catch (err) {
      setError(err.message || t("admin.data.importError", "Import dry-run failed."));
    } finally {
      setRunning(false);
    }
  }, [importPreview, t]);

  const runImport = useCallback(async () => {
    if (!importPreview) return setError(t("admin.data.noFile", "No import file loaded."));
    setShowImportModal(true);
  }, [importPreview, t]);

  const confirmImport = useCallback(async () => {
    setShowImportModal(false);
    setRunning(true);
    setError("");
    setImportResult(null);
    try {
      const response = await api(`/api/admin/import?dryRun=false`, { method: "POST", body: JSON.stringify(importPreview) });
      setImportResult(response);
      setSuccess(t("admin.data.importComplete", "Import request processed."));
    } catch (err) {
      setError(err.message || t("admin.data.importError", "Import failed."));
    } finally {
      setRunning(false);
    }
  }, [importPreview, t]);

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.data.badge", "Admin data")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.data.title", "Data export, import & backups")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("admin.data.description", "Export site/user data, validate import packages, and find backup/restore instructions for operators.")}</p>
      </section>

      {error ? <div className="card border border-rose-500 p-4 text-rose-200" role="alert">{error}</div> : null}
      {success ? <div className="card border border-emerald-500 p-4 text-emerald-200" role="status">{success}</div> : null}

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">{t("admin.data.exports", "Exports")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button className="btn-primary" onClick={downloadSiteExport}>{t("admin.data.downloadSite", "Download site export")}</button>
        </div>
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">{t("admin.data.imports", "Import package")}</h2>
        <p className="mt-2 text-sm text-slatebody">{t("admin.data.importHelp", "Upload a JSON export to validate (dry-run) or to request an import. Full restores should use DB backups where possible.")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2">
            <input type="file" accept="application/json" onChange={handleImportFile} />
            <span className="text-sm text-slatebody">{importFileName || t("admin.data.chooseFile", "Choose import JSON file")}</span>
          </label>
          <button className="btn-ghost" onClick={runDryRun} disabled={!importPreview || running}>{t("admin.data.runDryRun", "Run dry-run")}</button>
          <button className="btn-danger" onClick={runImport} disabled={!importPreview || running}>{t("admin.data.runImport", "Run import (request)")}</button>
        </div>

        {showImportModal && importPreview ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
              <h3 className="text-2xl font-black text-white">{t("admin.data.importReviewTitle", "Review import before running")}</h3>
              <p className="mt-3 text-sm text-slatebody">{t("admin.data.importReviewHelp", "This import will modify the database. Review the record counts below and confirm only if you have a backup.")}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-borderline p-4 bg-slate-900 text-sm text-slatebody">
                  <p className="font-semibold text-white">{t("admin.data.importCounts", "Import counts")}</p>
                  <ul className="mt-3 space-y-2">
                    <li>{t("admin.data.countUsers", "Users: {count}", { count: Array.isArray(importPreview?.users) ? importPreview.users.length : 0 })}</li>
                    <li>{t("admin.data.countTrips", "Trips: {count}", { count: Array.isArray(importPreview?.trips) ? importPreview.trips.length : 0 })}</li>
                    <li>{t("admin.data.countEvents", "Events: {count}", { count: Array.isArray(importPreview?.events) ? importPreview.events.length : 0 })}</li>
                    <li>{t("admin.data.countUploads", "Uploads: {count}", { count: Array.isArray(importPreview?.uploads) ? importPreview.uploads.length : 0 })}</li>
                    <li>{t("admin.data.countAds", "Ads: {count}", { count: Array.isArray(importPreview?.ads) ? importPreview.ads.length : 0 })}</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-borderline p-4 bg-slate-900 text-sm text-slatebody">
                  <p className="font-semibold text-white">{t("admin.data.importWarnings", "Import warnings")}</p>
                  <ul className="mt-3 space-y-2">
                    {Array.isArray(importPreview?.users) && importPreview.users.length === 0 ? (
                      <li>{t("admin.data.warningNoUsers", "No users in file; some imports may be assigned to placeholder accounts.")}</li>
                    ) : null}
                    {!(Array.isArray(importPreview?.trips) && importPreview.trips.length > 0) && !(Array.isArray(importPreview?.events) && importPreview.events.length > 0) ? (
                      <li>{t("admin.data.warningNoContent", "The package contains no trips or events.")}</li>
                    ) : null}
                    {Array.isArray(importPreview?.uploads) && importPreview.uploads.length === 0 ? (
                      <li>{t("admin.data.warningNoUploads", "Uploads cannot always be restored without storage metadata.")}</li>
                    ) : null}
                  </ul>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button className="btn-danger w-full sm:w-auto" onClick={confirmImport}>{running ? t("admin.data.importing", "Importing…") : t("admin.data.confirmImportAction", "Confirm import")}</button>
                <button className="btn-ghost w-full sm:w-auto" onClick={() => setShowImportModal(false)}>{t("admin.data.cancel", "Cancel")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {importResult ? <div className="mt-4 rounded-2xl border border-borderline p-4 bg-slate-900 text-sm text-slatebody"><pre className="whitespace-pre-wrap break-words">{JSON.stringify(importResult, null, 2)}</pre></div> : null}
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">{t("admin.data.backups", "Backup & restore")}</h2>
        <p className="mt-2 text-sm text-slatebody">{t("admin.data.backupHelp", "The repository includes `db-backup.sh` and `db-restore.sh` for operators. These scripts are the recommended mechanism for full database restores. Use import only for small-scale migrations or data recovery after careful validation.")}</p>
        <div className="mt-4 space-y-2 text-sm text-slatebody">
          <div>{t("admin.data.backupScript", "Backup script:")}: <code>/db-backup.sh</code></div>
          <div>{t("admin.data.restoreScript", "Restore script:")}: <code>/db-restore.sh</code></div>
          <div>{t("admin.data.retentionNote", "Retention: keep regular offsite backups and test restores on a staging environment before restoring production.")}</div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.tools.backToAdmin","Back to admin dashboard")}</Link>
      </div>
    </main>
  );
}
