import { Check, Eye, Flag, Lock, Trash2, X } from "lucide-react";
import { API_URL } from "../lib/api";

function assetUrl(url) {
  return url && url.startsWith("/") ? `${API_URL}${url}` : url;
}

export default function MediaCard({ upload, selected, onSelect, onApprove, onReject, onReport, onDelete, downloadOptions, currentDownloadItemId, onChangeDownloadItem, skinOptions = [], onApplySkin }) {
  const overlayRaw = upload.frameAssetUrl || upload.skinFrameUrl;
  const overlayUrl = assetUrl(overlayRaw);

  return (
    <article className="card min-w-0 overflow-hidden">
      <div className="watermarked-media relative aspect-[4/3] w-full overflow-hidden bg-skysoft" data-watermark="TravelShare">
        {upload.fileType === "video" ? (
          <video src={upload.fileUrl} controls className="h-full w-full object-cover" />
        ) : (
          <img src={upload.fileUrl} alt="" className="h-full w-full object-cover" />
        )}
        {overlayUrl ? (
          <img src={overlayUrl} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {onChangeDownloadItem && (
              <div className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${currentDownloadItemId ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                {currentDownloadItemId ? "Download gated" : "No download asset"}
              </div>
            )}
            <p className="break-words text-sm font-black">{upload.uploaderAnonId}</p>
            <p className="text-xs text-slatebody">{new Date(upload.createdAt).toLocaleString()}</p>
            <p className="text-xs font-bold uppercase tracking-wide text-report">{upload.fileType} • AI check: {upload.aiFlagged ? "Flagged" : "Clear"}</p>
          </div>
          {onSelect && (
            <input
              aria-label="Select upload"
              type="checkbox"
              checked={selected}
              onChange={(event) => onSelect(upload.id, event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a className="btn-ghost" href={upload.id ? `${API_URL}/api/downloads/${upload.id}` : upload.fileUrl} target="_blank" rel="noreferrer">
            <Eye size={17} /> View full
          </a>
          {onApprove && <button className="btn-green" onClick={() => onApprove(upload.id)}><Check size={17} /> Approve & Save</button>}
          {onReject && <button className="btn-danger" onClick={() => onReject(upload.id)}><X size={17} /> Reject</button>}
          {onReport && <button className="btn-ghost" onClick={() => onReport(upload.id)}><Flag size={17} /> Report</button>}
          {onDelete && <button className="btn-ghost" onClick={() => onDelete(upload.id)}><Trash2 size={17} /> Delete</button>}
        </div>
        {onChangeDownloadItem ? (
          <div className="rounded-lg border border-borderline bg-slate-50 p-3 text-sm">
            <label className="mb-2 block font-semibold">Download access</label>
            <select className="field" value={currentDownloadItemId || ""} onChange={(event) => onChangeDownloadItem(upload.id, event.target.value || null)}>
              <option value="">No download asset assigned</option>
              {downloadOptions?.map((item) => (
                <option key={item.id} value={item.id}>{item.name} - ${((item.priceCents || 0) / 100).toFixed(2)}</option>
              ))}
            </select>
            <p className="mt-2 text-xs text-slatebody">Assigned download assets gate the full view to buyers and the uploader.</p>
          </div>
        ) : null}
        {onApplySkin && upload.fileType !== "video" ? (
          <div className="space-y-2 rounded-lg border border-borderline bg-skysoft p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">Photo frame</p>
              <button className={!upload.skinId ? "btn-primary" : "btn-ghost"} type="button" onClick={() => onApplySkin(upload.id, null)} aria-label="Remove photo frame" disabled={!upload.skinId}>
                None
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Available photo frames">
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
            {skinOptions.length === 0 && <p className="text-xs text-slatebody">Unlock basic or premium frames in the store to apply them here.</p>}
          </div>
        ) : null}
      </div>
    </article>
  );
}
