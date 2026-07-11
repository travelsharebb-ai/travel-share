import { useState } from "react";
import { useLanguage } from "../lib/i18n";
import { Check, Download, Eye, Flag, Lock, Trash2, X } from "lucide-react";
import { API_URL, getToken } from "../lib/api";

function assetUrl(url) {
  return url && url.startsWith("/") ? `${API_URL}${url}` : url;
}

function downloadName(upload) {
  const title = String(upload.caption || upload.filePublicId || upload.id || "memory")
    .split("/")
    .pop()
    .replace(/\.[a-z0-9]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "memory";
  const date = upload.createdAt ? new Date(upload.createdAt).toISOString().slice(0, 10) : "";
  return ["travel-share", title, date].filter(Boolean).join("-");
}

export default function MediaCard({ upload, selected, onSelect, onApprove, onReject, onReport, onDelete, downloadOptions, currentDownloadItemId, onChangeDownloadItem, skinOptions = [], onApplySkin, canApplySkin = Boolean(onApplySkin) }) {
  const { t } = useLanguage();
  const overlayRaw = upload.frameAssetUrl || upload.skinFrameUrl;
  const overlayUrl = assetUrl(overlayRaw);
  const showSkinControls = Boolean(onApplySkin) && canApplySkin;
  const brandWatermark = t("common.poweredByTravelShare");
  const [previewUrl, setPreviewUrl] = useState("");

  async function getProtectedUploadUrl({ download = false } = {}) {
    if (!upload.id) return upload.fileUrl;
    const token = getToken();
    const response = await fetch(`${API_URL}/api/downloads/${upload.id}?format=json${download ? "&download=1" : ""}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.url) throw new Error(data.error || "Unable to open media.");
    return data.url;
  }

  async function viewFullUpload() {
    setPreviewUrl(upload.fileUrl);
    try {
      if (upload.id) setPreviewUrl(await getProtectedUploadUrl());
    } catch (error) {
      setPreviewUrl(upload.fileUrl);
    }
  }

  async function downloadUpload() {
    try {
      const url = await getProtectedUploadUrl({ download: true });
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = downloadName(upload);
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      window.open(upload.fileUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <>
    <article className="card min-w-0 overflow-hidden">
      <div className="watermarked-media relative aspect-[4/3] w-full overflow-hidden bg-skysoft" data-watermark={brandWatermark}>
        {upload.fileType === "video" ? (
          <video src={upload.fileUrl} controls className="h-full w-full object-cover" />
        ) : (
          <img src={upload.fileUrl} alt="" className="h-full w-full object-cover" />
        )}
        {overlayUrl ? (
          <img src={overlayUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        ) : null}
        {overlayUrl ? (
          <span className="pointer-events-none absolute bottom-2 right-2 z-10 font-sans text-sm font-bold leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] [text-shadow:_0_1px_3px_rgba(0,0,0,1)]">
            {brandWatermark}
          </span>
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {onChangeDownloadItem && (
              <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${currentDownloadItemId ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {currentDownloadItemId ? t("common.downloadGated") : t("common.noDownloadAsset")}
              </div>
            )}
            <p className="break-words text-sm font-black">{upload.uploaderAnonId}</p>
            <p className="text-xs text-slatebody">{new Date(upload.createdAt).toLocaleString()}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-report">{upload.fileType} • AI check: {upload.aiFlagged ? "Flagged" : "Clear"}</p>
          </div>
          {onSelect && (
            <input
              aria-label={t("hardcoded.selectUpload")}
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect(upload.id, event.target.checked)}
              className="form-checkbox mt-1 shrink-0"
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button className="btn-ghost" type="button" onClick={viewFullUpload}>
            <Eye size={17} />{t("common.viewFull")}
          </button>
          <button className="btn-ghost" type="button" onClick={downloadUpload}>
            <Download size={17} />{t("common.download")}
          </button>
          {onApprove && <button className="btn-green" onClick={() => onApprove(upload.id)}><Check size={17} />{t("common.approveAndSave")}</button>}
          {onReject && <button className="btn-danger" onClick={() => onReject(upload.id)}><X size={17} />{t("common.reject")}</button>}
          {onReport && <button className="btn-ghost" onClick={() => onReport(upload.id)}><Flag size={17} />{t("common.report")}</button>}
          {onDelete && <button className="btn-ghost" onClick={() => onDelete(upload.id)}><Trash2 size={17} />{t("common.delete")}</button>}
        </div>
        {onChangeDownloadItem ? (
          <div className="form-panel p-3 text-sm">
            <label className="mb-2 block font-semibold">{t("common.downloadAccess")}</label>
            <select className="field" value={currentDownloadItemId || ""} onChange={(event) => onChangeDownloadItem(upload.id, event.target.value || null)}>
              <option value="">{t("hardcoded.noDownloadAssetAssigned")}</option>
              {downloadOptions?.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - ${((item.priceCents || 0) / 100).toFixed(2)}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slatebody">{t("hardcoded.assignedDownloadAssetsGateTheFullViewTo")}</p>
          </div>
        ) : null}
        {showSkinControls && upload.fileType !== "video" ? (
          <div className="form-panel space-y-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{t("common.photoFrame")}</p>
              <button className={!upload.skinId ? "btn-primary" : "btn-ghost"} type="button" onClick={() => onApplySkin(upload.id, null)} aria-label={t("common.removePhotoFrame")} disabled={!upload.skinId}>{t("common.remove")}</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label={t("common.availablePhotoFrames")}>
              {skinOptions.map((skin) => {
                const metadata = skin.metadata && typeof skin.metadata === "object" ? skin.metadata : {};
                const frameUrl = assetUrl(metadata.frameAssetUrl || skin.previewUrl);
                const selectedSkin = upload.skinId === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    className={selectedSkin ? "btn-primary shrink-0" : "btn-ghost shrink-0"}
                    onClick={() => onApplySkin(upload.id, skin.id)}
                    aria-label={`Apply ${skin.name}`}
                    title={skin.name}
                  >
                    {frameUrl ? <img src={frameUrl} alt="" className="h-7 w-7 rounded object-cover" /> : <Lock size={16} />}
                    <span className="max-w-28 truncate">{skin.name}</span>
                  </button>
                );
              })}
            </div>
            {skinOptions.length === 0 && <p className="text-xs text-slatebody">{t("hardcoded.unlockBasicOrPremiumFramesInTheStore")}</p>}
          </div>
        ) : null}
      </div>
    </article>
    {previewUrl ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4" role="dialog" aria-modal="true">
        <button className="absolute inset-0 cursor-default" type="button" aria-label={t("common.close")} onClick={() => setPreviewUrl("")} />
        <div className="relative z-10 max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl">
          <div className="flex items-center justify-end border-b border-white/10 p-3">
            <button className="btn-ghost" type="button" onClick={() => setPreviewUrl("")}>
              <X size={17} />{t("common.close")}
            </button>
          </div>
          <div className="relative flex max-h-[82vh] items-center justify-center overflow-auto bg-black p-3">
            {upload.fileType === "video" ? (
              <video src={previewUrl} controls autoPlay className="max-h-[82vh] w-full object-contain" />
            ) : (
              <div className="relative inline-block max-h-[78vh] max-w-full overflow-hidden">
                <img src={previewUrl} alt="" className="block max-h-[78vh] max-w-full object-contain" />
                {overlayUrl ? (
                  <img src={overlayUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
                ) : null}
                {overlayUrl ? (
                  <span className="pointer-events-none absolute bottom-6 right-6 z-10 font-sans text-[clamp(1.1rem,2.5vw,2.5rem)] font-bold leading-none text-white drop-shadow-[0_3px_14px_rgba(0,0,0,1)] [text-shadow:_0_2px_5px_rgba(0,0,0,1)]">
                    {brandWatermark}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
