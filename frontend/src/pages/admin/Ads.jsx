import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../lib/i18n.js";
import { api } from "../../lib/api.js";

const placements = ["global", "tourist", "event", "guest", "map", "upload_success"];
const mediaTypes = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" }
];

function placementLabel(value, t) {
  return {
    global: t("admin.ads.placementGlobal", "Global"),
    tourist: t("admin.ads.placementTourist", "Tourist"),
    event: t("admin.ads.placementEvent", "Event"),
    guest: t("admin.ads.placementGuest", "Guest"),
    map: t("admin.ads.placementMap", "Map"),
    upload_success: t("admin.ads.placementUploadSuccess", "Upload success")
  }[value] || value;
}

function mediaTypeLabel(value, t) {
  return value === "video" ? t("admin.ads.videoAd", "Video ad") : t("admin.ads.imageAd", "Image ad");
}

function statusLabel(ad, t) {
  const status = getStatus(ad);
  return status === "active" ? t("admin.ads.active", "Active")
    : status === "scheduled" ? t("admin.ads.scheduled", "Scheduled")
    : status === "expired" ? t("admin.ads.expired", "Expired")
    : t("admin.ads.inactive", "Inactive");
}

function formatDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function parseDateTimeLocal(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function humanFileSize(bytes) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}

function getStatus(ad) {
  const now = new Date();
  if (!ad.active) return "inactive";
  if (ad.startsAt && new Date(ad.startsAt) > now) return "scheduled";
  if (ad.endsAt && new Date(ad.endsAt) < now) return "expired";
  return "active";
}

export default function AdminAds() {
  const { t } = useLanguage();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedAd, setSelectedAd] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    mediaUrl: "",
    mediaType: "image",
    linkUrl: "",
    placement: "global",
    priority: 0,
    displaySeconds: 15,
    startsAt: "",
    endsAt: "",
    active: true
  });
  const [fileInfo, setFileInfo] = useState(null);

  const loadAds = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api("/api/admin/ads");
      setAds(Array.isArray(response.ads) ? response.ads : []);
    } catch (err) {
      setError(err.message || t("admin.ads.loadError", "Unable to load ads."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  const resetForm = useCallback(() => {
    setSelectedAd(null);
    setForm({
      title: "",
      description: "",
      mediaUrl: "",
      mediaType: "image",
      linkUrl: "",
      placement: "global",
      priority: 0,
      displaySeconds: 15,
      startsAt: "",
      endsAt: "",
      active: true
    });
    setFileInfo(null);
    setError("");
    setSuccess("");
  }, []);

  const uploadFile = useCallback(async (file) => {
    if (!file) return null;
    const allowed = file.type.startsWith("image/") || file.type.startsWith("video/");
    if (!allowed) {
      throw new Error(t("admin.ads.invalidFileType", "Only image and video files are allowed."));
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const response = await api("/api/admin/ads/media", { method: "POST", body: formData });
      if (!response.media?.fileUrl) throw new Error(t("admin.ads.uploadFailed", "Upload failed. Please try again."));
      return response.media.fileUrl;
    } finally {
      setUploading(false);
    }
  }, [t]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccess("");
    setFileInfo({ name: file.name, size: humanFileSize(file.size) });
    try {
      const url = await uploadFile(file);
      setForm((current) => ({
        ...current,
        mediaUrl: url,
        mediaType: file.type.startsWith("video/") ? "video" : "image"
      }));
    } catch (err) {
      setError(err.message || t("admin.ads.uploadFailed", "Upload failed. Please try again."));
      setFileInfo(null);
    }
  }, [uploadFile, t]);

  const handleInput = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const selectAd = useCallback((ad) => {
    setSelectedAd(ad);
    setError("");
    setSuccess("");
    setFileInfo(null);
    setForm({
      title: ad.title || "",
      description: ad.description || "",
      mediaUrl: ad.mediaUrl || "",
      mediaType: ad.mediaType || "image",
      linkUrl: ad.linkUrl || "",
      placement: ad.placement || "global",
      priority: ad.priority ?? 0,
      displaySeconds: ad.displaySeconds ?? 15,
      startsAt: ad.startsAt ? formatDateTimeLocal(ad.startsAt) : "",
      endsAt: ad.endsAt ? formatDateTimeLocal(ad.endsAt) : "",
      active: ad.active
    });
  }, []);

  const handleSave = useCallback(async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        mediaUrl: form.mediaUrl,
        mediaType: form.mediaType,
        linkUrl: form.linkUrl || null,
        placement: form.placement,
        priority: Number(form.priority || 0),
        displaySeconds: form.displaySeconds ? Number(form.displaySeconds) : null,
        startsAt: parseDateTimeLocal(form.startsAt),
        endsAt: parseDateTimeLocal(form.endsAt),
        active: Boolean(form.active)
      };
      const response = selectedAd
        ? await api(`/api/admin/ads/${selectedAd.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api("/api/admin/ads", { method: "POST", body: JSON.stringify(payload) });
      const saved = selectedAd ? response.ad : response.ad;
      if (!saved) throw new Error(t("admin.ads.saveFailed", "Ad save failed."));
      await loadAds();
      setSuccess(selectedAd ? t("admin.ads.updated", "Ad updated.") : t("admin.ads.saved", "Ad saved."));
      if (!selectedAd) resetForm();
      if (selectedAd) setSelectedAd(saved);
    } catch (err) {
      setError(err.message || t("admin.ads.saveFailed", "Ad save failed."));
    } finally {
      setSaving(false);
    }
  }, [form, loadAds, resetForm, selectedAd, t]);

  const handleDelete = useCallback(async (ad) => {
    if (!window.confirm(t("admin.ads.deleteConfirmation", "Permanently delete this ad?"))) return;
    setError("");
    setSuccess("");
    try {
      await api(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
      setAds((current) => current.filter((entry) => entry.id !== ad.id));
      if (selectedAd?.id === ad.id) resetForm();
      setSuccess(t("admin.ads.deleted", "Ad deleted."));
    } catch (err) {
      setError(err.message || t("admin.ads.deleteFailed", "Could not delete ad."));
    }
  }, [resetForm, selectedAd, t]);

  const handleToggleActive = useCallback(async (ad) => {
    setError("");
    setSuccess("");
    try {
      const response = await api(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !ad.active })
      });
      setAds((current) => current.map((entry) => entry.id === ad.id ? response.ad : entry));
      setSuccess(t("admin.ads.updated", "Ad updated."));
      if (selectedAd?.id === ad.id) setSelectedAd(response.ad);
    } catch (err) {
      setError(err.message || t("admin.ads.saveFailed", "Ad save failed."));
    }
  }, [selectedAd, t]);

  const preview = useMemo(() => {
    if (!form.mediaUrl) return null;
    if (form.mediaType === "video") {
      return (
        <video className="h-full w-full rounded-3xl object-cover" src={form.mediaUrl} muted playsInline loop preload="metadata" />
      );
    }
    return (
      <img className="h-full w-full rounded-3xl object-cover" src={form.mediaUrl} alt={form.title || t("admin.ads.imageAd", "Image ad")} />
    );
  }, [form.mediaType, form.mediaUrl, form.title, t]);

  const statusText = useMemo(() => {
    const state = getStatus(form);
    return state === "active" ? t("admin.ads.active", "Active")
      : state === "scheduled" ? t("admin.ads.scheduled", "Scheduled")
      : state === "expired" ? t("admin.ads.expired", "Expired")
      : t("admin.ads.inactive", "Inactive");
  }, [form, t]);

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.ads.badge", "Admin ads")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("admin.ads.title", "Ad Management")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("admin.ads.description", "Create and manage internal ads, upload media, schedule display dates, and preview live placement behavior.")}</p>
      </section>

      {error ? <div className="card border border-rose-500 p-4 text-rose-200" role="alert">{error}</div> : null}
      {success ? <div className="card border border-emerald-500 p-4 text-emerald-200" role="status">{success}</div> : null}

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-black font-serif">{selectedAd ? t("admin.ads.editAd", "Edit ad") : t("admin.ads.createAd", "Create ad")}</h2>
              <p className="mt-2 text-sm text-slatebody">{t("admin.ads.formHelp", "Upload or link an image/video, set placement and timing, then save to make this ad available.")}</p>
            </div>
            <button className="btn-ghost" type="button" onClick={resetForm}>{t("admin.ads.newAd", "New ad")}</button>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slatebody">
                {t("admin.ads.titleLabel", "Title")}
                <input required className="input mt-2 w-full" value={form.title} onChange={(event) => handleInput("title", event.target.value)} />
              </label>
              <label className="block text-sm text-slatebody">
                {t("admin.ads.placement", "Placement")}
                <select required className="input mt-2 w-full" value={form.placement} onChange={(event) => handleInput("placement", event.target.value)}>
                  {placements.map((placement) => (
                    <option key={placement} value={placement}>{placementLabel(placement, t)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slatebody">
                {t("admin.ads.linkUrl", "Link URL")}
                <input type="url" className="input mt-2 w-full" value={form.linkUrl} onChange={(event) => handleInput("linkUrl", event.target.value)} placeholder="https://" />
              </label>
              <label className="block text-sm text-slatebody">
                {t("admin.ads.mediaType", "Media type")}
                <select required className="input mt-2 w-full" value={form.mediaType} onChange={(event) => handleInput("mediaType", event.target.value)}>
                  {mediaTypes.map((type) => <option key={type.value} value={type.value}>{t(`admin.ads.${type.value}Ad`, type.label)}</option>)}
                </select>
              </label>
            </div>

            <label className="block text-sm text-slatebody">
              {t("admin.ads.description", "Description")}
              <textarea className="input mt-2 min-h-[110px] w-full" value={form.description} onChange={(event) => handleInput("description", event.target.value)} maxLength={240} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slatebody">
                {t("admin.ads.displaySeconds", "Display seconds")}
                <input type="number" min={5} max={60} className="input mt-2 w-full" value={form.displaySeconds} onChange={(event) => handleInput("displaySeconds", event.target.value)} />
              </label>
              <label className="block text-sm text-slatebody">
                {t("admin.ads.priority", "Priority")}
                <input type="number" min={0} max={1000} className="input mt-2 w-full" value={form.priority} onChange={(event) => handleInput("priority", event.target.value)} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slatebody">
                {t("admin.ads.startsAt", "Starts at")}
                <input type="datetime-local" className="input mt-2 w-full" value={form.startsAt} onChange={(event) => handleInput("startsAt", event.target.value)} />
              </label>
              <label className="block text-sm text-slatebody">
                {t("admin.ads.endsAt", "Ends at")}
                <input type="datetime-local" className="input mt-2 w-full" value={form.endsAt} onChange={(event) => handleInput("endsAt", event.target.value)} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-3 text-sm text-slatebody">
                <input type="checkbox" checked={form.active} onChange={(event) => handleInput("active", event.target.checked)} />
                {t("admin.ads.active", "Active")}
              </label>
              <label className="block text-sm text-slatebody">
                {t("admin.ads.mediaUrl", "External media URL")}
                <input type="url" className="input mt-2 w-full" value={form.mediaUrl} onChange={(event) => handleInput("mediaUrl", event.target.value)} placeholder="https://" />
              </label>
            </div>

            <div className="rounded-3xl border border-borderline bg-slate-900 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">{t("admin.ads.uploadMedia", "Upload image or video")}</p>
              <p className="mt-2 text-sm text-slatebody">{t("admin.ads.uploadHelp", "Choose a local image or video file to upload and store it for this ad.")}</p>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <label className="btn-ghost cursor-pointer">
                  {uploading ? t("admin.ads.uploading", "Uploading…") : t("admin.ads.chooseFile", "Choose file")}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
                </label>
                {fileInfo ? <span className="text-sm text-slatebody">{fileInfo.name} · {fileInfo.size}</span> : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <button className="btn-primary w-full" type="submit" disabled={saving}>{saving ? t("admin.ads.saving", "Saving…") : selectedAd ? t("admin.ads.saveAd", "Save ad") : t("admin.ads.createAd", "Create ad")}</button>
              <button className="btn-ghost w-full" type="button" onClick={resetForm}>{t("admin.ads.clearForm", "Clear form")}</button>
              {selectedAd ? (
                <button className="btn-danger w-full" type="button" onClick={() => handleDelete(selectedAd)}>{t("admin.ads.delete", "Delete ad")}</button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="space-y-5">
          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <h2 className="text-2xl font-black font-serif">{t("admin.ads.preview", "Preview")}</h2>
            <p className="mt-2 text-sm text-slatebody">{t("admin.ads.previewHelp", "Review the chosen media, title, and description before saving.")}</p>
            <div className="mt-4 rounded-3xl border border-borderline bg-slate-900 p-4">
              <div className="relative overflow-hidden rounded-3xl bg-slate-950" style={{ minHeight: 220 }}>
                {preview ? preview : <div className="flex h-full items-center justify-center p-6 text-sm text-slatebody">{t("admin.ads.previewPlaceholder", "Preview will appear once media is selected or a URL is entered.")}</div>}
              </div>
              <div className="mt-4 text-sm text-slatebody">
                <p>{t("admin.ads.status", "Status")}: <span className="font-semibold text-white">{statusText}</span></p>
                <p>{t("admin.ads.createdUpdated", "Created/updated info is shown after saving.")}</p>
              </div>
            </div>
          </div>

          <div className="card p-5 bg-slate-950/90 border border-white/10">
            <h2 className="text-2xl font-black font-serif">{t("admin.ads.existingAds", "Existing ads")}</h2>
            {loading ? <p className="mt-4 text-slatebody">{t("admin.ads.loading", "Loading ads…")}</p> : null}
            {!loading && ads.length === 0 ? <p className="mt-4 text-slatebody">{t("admin.ads.noAds", "No ads yet.")}</p> : null}
            <div className="mt-4 space-y-3">
              {ads.map((ad) => (
                <div key={ad.id} className="rounded-3xl border border-borderline bg-slate-900 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-white">{ad.title}</p>
                      <p className="mt-1 text-sm text-slatebody">{placementLabel(ad.placement, t)} · {mediaTypeLabel(ad.mediaType, t)} · {statusLabel(ad, t)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn-ghost" type="button" onClick={() => selectAd(ad)}>{t("admin.ads.editAd", "Edit ad")}</button>
                      <button className="btn-ghost" type="button" onClick={() => handleToggleActive(ad)}>{ad.active ? t("admin.ads.deactivate", "Deactivate") : t("admin.ads.activate", "Activate")}</button>
                      <button className="btn-danger" type="button" onClick={() => handleDelete(ad)}>{t("admin.ads.delete", "Delete ad")}</button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl border border-borderline bg-slate-950/80 p-3 text-sm text-slatebody">
                      <p className="text-xs uppercase tracking-[0.28em] text-primary">{t("admin.ads.linkUrl", "Link URL")}</p>
                      <p className="mt-2 truncate break-words">{ad.linkUrl || t("admin.ads.none", "None")}</p>
                    </div>
                    <div className="rounded-2xl border border-borderline bg-slate-950/80 p-3 text-sm text-slatebody">
                      <p className="text-xs uppercase tracking-[0.28em] text-primary">{t("admin.ads.schedule", "Schedule")}</p>
                      <p className="mt-2">{ad.startsAt ? new Date(ad.startsAt).toLocaleString() : t("admin.ads.startUnset", "No start date")}</p>
                      <p>{ad.endsAt ? new Date(ad.endsAt).toLocaleString() : t("admin.ads.endUnset", "No end date")}</p>
                    </div>
                    <div className="rounded-2xl border border-borderline bg-slate-950/80 p-3 text-sm text-slatebody">
                      <p className="text-xs uppercase tracking-[0.28em] text-primary">{t("admin.ads.timestamps", "Created / updated")}</p>
                      <p className="mt-2">{ad.createdAt ? new Date(ad.createdAt).toLocaleString() : t("admin.ads.notAvailable", "N/A")}</p>
                      <p>{ad.updatedAt ? new Date(ad.updatedAt).toLocaleString() : t("admin.ads.notAvailable", "N/A")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link className="btn-ghost w-full" to="/admin/tools">{t("admin.tools.backToAdmin", "Back to admin dashboard")}</Link>
        <Link className="btn-primary w-full" to="/admin/management">{t("admin.ads.backToManagement", "Back to admin management")}</Link>
      </div>
    </main>
  );
}
