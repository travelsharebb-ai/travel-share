import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../lib/i18n";
// Shell is provided by PrivateRoute at the route level — avoid double-wrapping
import { api } from "../../lib/api.js";

function detectMediaType(value, fallback = "video") {
  if (!value || typeof value !== "string") return fallback;
  const normalizedValue = value.toLowerCase();
  const extension = normalizedValue.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/)?.[1];
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  return fallback;
}

export default function AdminSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMediaType, setPreviewMediaType] = useState("video");
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api("/api/admin/settings");
        if (!mounted) return;
        setSettings(data.settings || {});
      } catch (err) {
        if (!mounted) return;
        setError(err.message || t("admin.settings.error", "Unable to load settings."));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedFile) return undefined;
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setPreviewMediaType(selectedFile.type?.startsWith("video/") ? "video" : "image");
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  async function uploadBackgroundMedia() {
    if (!selectedFile) {
      setUploadError("Choose an image or video file first.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const data = await api("/api/admin/settings/background-media", { method: "POST", body: formData });
      const mediaUrl = data.mediaUrl || "";
      const mediaType = data.mediaType || detectMediaType(mediaUrl, "video");
      setForm((current) => ({
        ...current,
        backgroundVideoUrl: mediaUrl,
        backgroundMediaUrl: mediaUrl,
        backgroundMediaType: mediaType
      }));
      setPreviewUrl(mediaUrl);
      setPreviewMediaType(mediaType);
      setUploadSuccess(t("admin.settings.uploadSuccess", "Background media uploaded successfully."));
    } catch (err) {
      setUploadError(err.message || t("admin.settings.uploadError", "Background media upload failed."));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const payload = {
        guestAccessDays: form.guestAccessDays,
        guestDeletionDays: form.guestDeletionDays,
        maxUploadSizeMb: form.maxUploadSizeMb,
        defaultPrivacy: form.defaultPrivacy,
        moderationProvider: form.moderationProvider,
        mapProvider: form.mapProvider,
        paymentProvider: form.paymentProvider,
        backgroundVideoUrl: form.backgroundVideoUrl || form.backgroundMediaUrl || "/videos/come-to-barbados.mp4",
        backgroundMediaUrl: form.backgroundMediaUrl || form.backgroundVideoUrl || "/videos/come-to-barbados.mp4",
        backgroundMediaType: form.backgroundMediaType || detectMediaType(form.backgroundMediaUrl || form.backgroundVideoUrl || "/videos/come-to-barbados.mp4")
      };
      const data = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(payload) });
      setSettings(data.settings || {});
      setEditing(false);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message || t("admin.settings.saveError", "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    const currentMediaUrl = settings?.backgroundMediaUrl || settings?.backgroundVideoUrl || "/videos/come-to-barbados.mp4";
    const currentMediaType = settings?.backgroundMediaType || detectMediaType(currentMediaUrl, "video");
    setForm({
      guestAccessDays: settings.guestAccessDays,
      guestDeletionDays: settings.guestDeletionDays,
      maxUploadSizeMb: settings.maxUploadSizeMb,
      defaultPrivacy: settings.defaultPrivacy,
      moderationProvider: settings.moderationProvider,
      mapProvider: settings.mapProvider,
      paymentProvider: settings.paymentProvider,
      backgroundVideoUrl: currentMediaUrl,
      backgroundMediaUrl: currentMediaUrl,
      backgroundMediaType: currentMediaType
    });
    setSelectedFile(null);
    setUploadError(null);
    setUploadSuccess(null);
    setPreviewUrl(currentMediaUrl);
    setPreviewMediaType(currentMediaType);
  }

  const currentMediaUrl = settings?.backgroundMediaUrl || settings?.backgroundVideoUrl || "/videos/come-to-barbados.mp4";
  const currentMediaType = settings?.backgroundMediaType || detectMediaType(currentMediaUrl, "video");

  return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.settings.badge", "Platform configuration")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.settings.title", "Admin platform settings")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("admin.settings.description", "Review and edit core application settings. Only non-secret, whitelisted fields are editable here.")}</p>
        </section>

        {loading ? (
          <div className="card p-5 text-center text-slatebody">{t("admin.settings.loading", "Loading settings…")}</div>
        ) : error ? (
          <div className="card rounded-3xl border border-rose-500 bg-rose-950/10 p-5 text-sm text-rose-200">Error: {error}</div>
        ) : (
          <div className="card p-5">
            {!editing ? (
              <div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.guestAccessDays", "Guest access days")}</p>
                    <p className="mt-2 text-white">{settings.guestAccessDays}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.guestDeletionDays", "Guest deletion days")}</p>
                    <p className="mt-2 text-white">{settings.guestDeletionDays}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.maxUploadSizeMb", "Max upload size (MB)")}</p>
                    <p className="mt-2 text-white">{settings.maxUploadSizeMb}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.defaultPrivacy", "Default location privacy")}</p>
                    <p className="mt-2 text-white">{settings.defaultPrivacy}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.moderationProvider", "Moderation provider")}</p>
                    <p className="mt-2 text-white">{settings.moderationProvider}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.mapProvider", "Map provider")}</p>
                    <p className="mt-2 text-white">{settings.mapProvider}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.paymentProvider", "Payment provider")}</p>
                    <p className="mt-2 text-white">{settings.paymentProvider}</p>
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.32em] text-slatebody/70">{t("admin.settings.backgroundMedia", "Background media")}</p>
                    <p className="mt-2 break-words text-white">{currentMediaUrl || t("admin.settings.none", "None")}</p>
                    <div className="mt-3 overflow-hidden rounded-3xl border border-borderline bg-slate-950/60 p-4">
                      {currentMediaType === "image" ? (
                        <img className="h-48 w-full rounded-2xl object-cover" src={currentMediaUrl} alt={t("hardcoded.currentBackgroundPreview")} />
                      ) : (
                        <video className="h-48 w-full rounded-2xl object-cover" src={currentMediaUrl} autoPlay muted loop playsInline />
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="btn-primary" onClick={() => { setEditing(true); resetForm(); }}>{t("admin.settings.edit", "Edit")}</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-4 lg:grid-cols-2">
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.guestAccessDays", "Guest access days")}</div>
                    <input type="number" className="input mt-2" value={form.guestAccessDays || 0} onChange={(e) => setForm((f) => ({ ...f, guestAccessDays: Number(e.target.value) }))} />
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.guestDeletionDays", "Guest deletion days")}</div>
                    <input type="number" className="input mt-2" value={form.guestDeletionDays || 0} onChange={(e) => setForm((f) => ({ ...f, guestDeletionDays: Number(e.target.value) }))} />
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.maxUploadSizeMb", "Max upload size (MB)")}</div>
                    <input type="number" className="input mt-2" value={form.maxUploadSizeMb || 0} onChange={(e) => setForm((f) => ({ ...f, maxUploadSizeMb: Number(e.target.value) }))} />
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.defaultPrivacy", "Default privacy")}</div>
                    <select className="input mt-2" value={form.defaultPrivacy} onChange={(e) => setForm((f) => ({ ...f, defaultPrivacy: e.target.value }))}>
                      <option value="exact">exact</option>
                      <option value="approximate">approximate</option>
                      <option value="city">city</option>
                      <option value="hidden">hidden</option>
                    </select>
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.moderationProvider", "Moderation provider")}</div>
                    <input className="input mt-2" value={form.moderationProvider || ''} onChange={(e) => setForm((f) => ({ ...f, moderationProvider: e.target.value }))} />
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.mapProvider", "Map provider")}</div>
                    <input className="input mt-2" value={form.mapProvider || ''} onChange={(e) => setForm((f) => ({ ...f, mapProvider: e.target.value }))} />
                  </label>
                  <label>
                    <div className="text-sm text-slatebody">{t("admin.settings.paymentProvider", "Payment provider")}</div>
                    <input className="input mt-2" value={form.paymentProvider || ''} onChange={(e) => setForm((f) => ({ ...f, paymentProvider: e.target.value }))} />
                  </label>
                </div>

                <div className="mt-4 rounded-3xl border border-borderline bg-slate-950/40 p-4 lg:col-span-2 background-media-panel">
                    <div className="text-sm font-semibold text-slatebody background-media-heading">{t("admin.settings.backgroundMedia", "Background media")}</div>
                    <p className="mt-2 text-sm text-slatebody background-media-description">{t("admin.settings.backgroundMediaDescription", "Paste a URL or upload a JPG/PNG/WEBP image or MP4/WEBM video. The uploaded asset will be previewed and saved as the public background.")}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <label>
                      <div className="text-sm text-slatebody background-media-label">{t("admin.settings.currentMediaUrl", "Current media URL")}</div>
                      <input
                        className="input mt-2"
                        value={form.backgroundMediaUrl || ''}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          const nextType = detectMediaType(nextValue, form.backgroundMediaType || 'video');
                          setForm((f) => ({ ...f, backgroundVideoUrl: nextValue, backgroundMediaUrl: nextValue, backgroundMediaType: nextType }));
                          setPreviewUrl(nextValue);
                          setPreviewMediaType(nextType);
                          setSelectedFile(null);
                          setUploadError(null);
                          setUploadSuccess(null);
                        }}
                      />
                    </label>
                    <div>
                      <div className="text-sm text-slatebody background-media-label">{t("admin.settings.uploadFile", "Upload file")}</div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
                        className="mt-2 block w-full rounded-2xl border border-borderline bg-slate-950/60 p-3 text-sm text-slatebody background-media-file-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setSelectedFile(file);
                          setUploadError(null);
                          setUploadSuccess(null);
                        }}
                      />
                    </div>
                  </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="btn-primary" onClick={uploadBackgroundMedia} disabled={uploading || !selectedFile}>{uploading ? t("admin.settings.uploading", "Uploading…") : t("admin.settings.uploadMedia", "Upload media")}</button>
                      <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>{t("admin.settings.chooseFile", "Choose file")}</button>
                  </div>
                  {uploadError ? <div className="mt-3 text-sm text-rose-400">{uploadError}</div> : null}
                  {uploadSuccess ? <div className="mt-3 text-sm text-emerald-400">{uploadSuccess}</div> : null}
                  <div className="mt-4 overflow-hidden rounded-3xl border border-borderline bg-slate-950/60 p-4 background-media-preview-card">
                    <div className="text-sm text-slatebody background-media-preview-label">{t("admin.settings.preview", "Preview")}</div>
                    {previewUrl ? (
                      previewMediaType === "image" ? (
                        <img className="mt-3 h-56 w-full rounded-2xl object-cover" src={previewUrl} alt={t("hardcoded.backgroundMediaPreview")} />
                      ) : (
                        <video className="mt-3 h-56 w-full rounded-2xl object-cover" src={previewUrl} autoPlay muted loop playsInline />
                      )
                    ) : (
                      <div className="mt-3 text-sm text-slatebody">{t("admin.settings.previewHelp", "Enter a URL or upload a file to preview the public background.")}</div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="btn-primary" onClick={save} disabled={saving}>{saving ? t("admin.settings.saving", "Saving…") : t("admin.settings.saveChanges", "Save changes")}</button>
                  <button className="btn-ghost" onClick={() => { setEditing(false); setForm({}); setSelectedFile(null); setUploadError(null); setUploadSuccess(null); setPreviewUrl(""); setPreviewMediaType("video"); }}>{t("admin.settings.cancel", "Cancel")}</button>
                </div>
                {error && <div className="text-rose-400">{error}</div>}
              </div>
            )}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.reports.backToAdminTools")}</Link>
          <Link className="btn-primary w-full" to="/admin/users">{t("hardcoded.viewUsers")}</Link>
        </div>
      </main>
  );
}
