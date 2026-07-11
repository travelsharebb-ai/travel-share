import { Copy, Download, ExternalLink, Save, Trash2 } from "lucide-react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { deleteQRSpace, getQRSpace, getQRSpaceQRCode, updateQRSpace } from "../lib/api";
import { useLanguage } from "../lib/i18n";

function safeFilename(title) {
  const cleaned = String(title || "qr-upload-space").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${cleaned || "qr-upload-space"}.png`;
}

function statusFor(space, t) {
  if (space?.disabledAt || space?.deletedAt) return t("qrSpaces.statusDisabled");
  if (space?.expiresAt && new Date(space.expiresAt) <= new Date()) return t("qrSpaces.statusExpired");
  return t("qrSpaces.statusActive");
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function QRSpaceDetails() {
  const { t } = useLanguage();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [qrSpace, setQrSpace] = useState(location.state?.qrSpace || null);
  const [qrDataUrl, setQrDataUrl] = useState(location.state?.qrDataUrl || "");
  const [loading, setLoading] = useState(!location.state?.qrSpace);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    title: "",
    visibility: "unlisted",
    expiresAt: "",
    allowGuests: true,
    allowRegisteredUsers: true,
    requireApproval: true
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      getQRSpace(id),
      getQRSpaceQRCode(id)
    ])
      .then(([spaceData, qrData]) => {
        if (!active) return;
        const nextSpace = qrData.qrSpace || spaceData.qrSpace;
        setQrSpace(nextSpace);
        setQrDataUrl(qrData.qrDataUrl || "");
        setForm({
          title: nextSpace?.title || "",
          visibility: nextSpace?.visibility || "unlisted",
          expiresAt: toDatetimeLocal(nextSpace?.expiresAt),
          allowGuests: nextSpace?.allowGuests ?? true,
          allowRegisteredUsers: nextSpace?.allowRegisteredUsers ?? true,
          requireApproval: nextSpace?.requireApproval ?? true
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || t("qrSpaces.error"));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, t]);

  const link = useMemo(() => qrSpace?.uploadUrl || qrSpace?.publicUrl || (qrSpace?.token ? `/qr/${qrSpace.token}/upload` : ""), [qrSpace]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function copyLink() {
    if (!link) return;
    const ok = await copyToClipboard(link);
    if (ok) {
      setNotice(t("qrSpaces.linkCopied"));
      window.setTimeout(() => setNotice(""), 1800);
    }
  }

  function downloadQR() {
    if (!qrDataUrl || !qrSpace) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = safeFilename(qrSpace.title);
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }

  async function saveChanges(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        visibility: form.visibility,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        allowGuests: form.allowGuests,
        allowRegisteredUsers: form.allowRegisteredUsers,
        requireApproval: form.requireApproval
      };
      const data = await updateQRSpace(id, payload);
      setQrSpace(data.qrSpace);
      setNotice(t("qrSpaces.created"));
      window.setTimeout(() => setNotice(""), 1800);
    } catch (err) {
      setError(err.message || t("qrSpaces.error"));
    } finally {
      setSaving(false);
    }
  }

  async function disableSpace() {
    setSaving(true);
    setError("");
    try {
      const data = await deleteQRSpace(id);
      setQrSpace(data.qrSpace);
    } catch (err) {
      setError(err.message || t("qrSpaces.error"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="page-shell"><section className="card p-5 text-slatebody">{t("qrSpaces.loading")}</section></main>;
  }

  if (error && !qrSpace) {
    return <main className="page-shell"><section className="card p-5 text-red-200">{error}</section></main>;
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <Link className="btn-ghost" to="/qr-spaces">{t("common.back")}</Link>
        <p className="mt-5 text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.details")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{qrSpace?.title}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("qrSpaces.subtitle")}</p>
      </section>

      {error ? <div className="rounded-3xl border border-red-500 bg-red-500/10 p-4 text-red-200">{error}</div> : null}
      {notice ? <div className="rounded-3xl border border-emerald-500 bg-emerald-500/10 p-4 text-emerald-200">{notice}</div> : null}

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card p-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{statusFor(qrSpace, t)}</p>
          <div className="mt-5 overflow-hidden rounded-3xl border border-borderline bg-white p-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={t("qrSpaces.qrImageAlt")} className="mx-auto aspect-square w-full max-w-sm object-contain" />
            ) : (
              <div className="grid aspect-square place-items-center text-slate-900">{t("qrSpaces.loading")}</div>
            )}
          </div>
          <div className="mt-5 grid gap-2">
            <button type="button" className="btn-primary inline-flex items-center justify-center gap-2" onClick={copyLink}>
              <Copy size={16} />
              <span>{t("qrSpaces.copyLink")}</span>
            </button>
            <button type="button" className="btn-ghost inline-flex items-center justify-center gap-2" onClick={downloadQR} disabled={!qrDataUrl}>
              <Download size={16} />
              <span>{t("qrSpaces.downloadQr")}</span>
            </button>
            <button type="button" className="btn-ghost inline-flex items-center justify-center gap-2" onClick={() => window.open(link, "_blank", "noopener,noreferrer")} disabled={!link}>
              <ExternalLink size={16} />
              <span>{t("qrSpaces.openUploadPage")}</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <section className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.publicLink")}</p>
            <p className="mt-3 break-all text-slatebody">{link}</p>
          </section>

          <section className="card p-5">
            <dl className="grid gap-3 text-sm text-slatebody sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.targetType")}</dt>
                <dd>{qrSpace?.targetType}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.targetId")}</dt>
                <dd>{qrSpace?.targetId || t("common.noValue")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.visibility")}</dt>
                <dd>{qrSpace?.visibility}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.expiresAt")}</dt>
                <dd>{qrSpace?.expiresAt ? new Date(qrSpace.expiresAt).toLocaleString() : t("qrSpaces.noExpiration")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.allowGuests")}</dt>
                <dd>{qrSpace?.allowGuests ? t("qrSpaces.yes") : t("qrSpaces.no")}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">{t("qrSpaces.allowRegisteredUsers")}</dt>
                <dd>{qrSpace?.allowRegisteredUsers ? t("qrSpaces.yes") : t("qrSpaces.no")}</dd>
              </div>
            </dl>
          </section>

          <form onSubmit={saveChanges} className="card grid gap-4 p-5">
            <label className="grid gap-2">
              <span className="form-label">{t("qrSpaces.name")}</span>
              <input id="qr-space-details-title" name="title" className="field" value={form.title} onChange={(event) => update("title", event.target.value)} required />
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="grid gap-2">
                <span className="form-label">{t("qrSpaces.visibility")}</span>
                <select id="qr-space-details-visibility" name="visibility" className="field" value={form.visibility} onChange={(event) => update("visibility", event.target.value)}>
                  <option value="public">{t("qrSpaces.visibilityPublic")}</option>
                  <option value="unlisted">{t("qrSpaces.visibilityUnlisted")}</option>
                  <option value="private">{t("qrSpaces.visibilityPrivate")}</option>
                </select>
              </label>
              <label className="grid gap-2">
                <span className="form-label">{t("qrSpaces.expiresAt")}</span>
                <input id="qr-space-details-expires-at" name="expiresAt" className="field" type="datetime-local" value={form.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} />
              </label>
            </div>
            <div className="form-option-panel">
              <label className="flex items-center gap-3">
                <input id="qr-space-details-allow-guests" name="allowGuests" className="form-checkbox" type="checkbox" checked={form.allowGuests} onChange={(event) => update("allowGuests", event.target.checked)} />
                <span>{t("qrSpaces.allowGuests")}</span>
              </label>
              <label className="flex items-center gap-3">
                <input id="qr-space-details-allow-registered-users" name="allowRegisteredUsers" className="form-checkbox" type="checkbox" checked={form.allowRegisteredUsers} onChange={(event) => update("allowRegisteredUsers", event.target.checked)} />
                <span>{t("qrSpaces.allowRegisteredUsers")}</span>
              </label>
              <label className="flex items-center gap-3">
                <input id="qr-space-details-require-approval" name="requireApproval" className="form-checkbox" type="checkbox" checked={form.requireApproval} onChange={(event) => update("requireApproval", event.target.checked)} />
                <span>{t("qrSpaces.requireApproval")}</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                <Save size={16} />
                <span>{t("qrSpaces.saveChanges")}</span>
              </button>
              <button type="button" className="btn-ghost inline-flex items-center gap-2" disabled={saving || Boolean(qrSpace?.disabledAt)} onClick={disableSpace}>
                <Trash2 size={16} />
                <span>{t("qrSpaces.disable")}</span>
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
