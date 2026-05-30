import { Check, Eye, Flag, Trash2, X } from "lucide-react";

export default function MediaCard({ upload, selected, onSelect, onApprove, onReject, onReport, onDelete }) {
  return (
    <article className="card min-w-0 overflow-hidden">
      <div className="aspect-[4/3] w-full overflow-hidden bg-skysoft">
        {upload.fileType === "video" ? (
          <video src={upload.fileUrl} controls className="h-full w-full object-cover" />
        ) : (
          <img src={upload.fileUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
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
          <a className="btn-ghost" href={upload.fileUrl} target="_blank" rel="noreferrer">
            <Eye size={17} /> View full
          </a>
          {onApprove && <button className="btn-green" onClick={() => onApprove(upload.id)}><Check size={17} /> Approve & Save</button>}
          {onReject && <button className="btn-danger" onClick={() => onReject(upload.id)}><X size={17} /> Reject</button>}
          {onReport && <button className="btn-ghost" onClick={() => onReport(upload.id)}><Flag size={17} /> Report</button>}
          {onDelete && <button className="btn-ghost" onClick={() => onDelete(upload.id)}><Trash2 size={17} /> Delete</button>}
        </div>
      </div>
    </article>
  );
}
