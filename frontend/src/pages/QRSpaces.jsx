import { Copy, Eye, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { currentUser, deleteQRSpace, listQRSpaces } from "../lib/api";
import { useLanguage } from "../lib/i18n";

function qrSpaceStatus(space, t) {
  if (space.disabledAt || space.deletedAt) return t("qrSpaces.statusDisabled");
  if (space.expiresAt && new Date(space.expiresAt) <= new Date()) return t("qrSpaces.statusExpired");
  return t("qrSpaces.statusActive");
}

function qrVisibilityLabel(value, t) {
  return {
    public: t("qrSpaces.visibilityPublic"),
    unlisted: t("qrSpaces.visibilityUnlisted"),
    private: t("qrSpaces.visibilityPrivate")
  }[value] || value;
}

function qrTargetLabel(value, t) {
  return {
    general: t("qrSpaces.targetGeneral"),
    event: t("qrSpaces.targetEvent"),
    trip: t("qrSpaces.targetTrip"),
    location: t("qrSpaces.targetLocation"),
    album: t("qrSpaces.targetAlbum")
  }[value] || value;
}

function formatDate(value, t) {
  if (!value) return t("qrSpaces.noExpiration");
  return new Date(value).toLocaleString();
}

export default function QRSpaces() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const user = currentUser();
  const [qrSpaces, setQrSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [busyId, setBusyId] = useState("");

  const isGuest = user?.role === "guest";

  useEffect(() => {
    let active = true;
    if (isGuest) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    listQRSpaces()
      .then((data) => {
        if (!active) return;
        setQrSpaces(data.qrSpaces || []);
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
  }, [isGuest, t]);

  const sortedSpaces = useMemo(() => qrSpaces || [], [qrSpaces]);

  async function copyLink(space) {
    const link = space.uploadUrl || space.publicUrl || `/qr/${space.token}/upload`;
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopiedId(space.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    }
  }

  async function disableSpace(space) {
    setBusyId(space.id);
    setError("");
    try {
      const data = await deleteQRSpace(space.id);
      setQrSpaces((current) => current.map((item) => (item.id === space.id ? data.qrSpace : item)));
    } catch (err) {
      setError(err.message || t("qrSpaces.error"));
    } finally {
      setBusyId("");
    }
  }

  if (isGuest) {
    return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.manage")}</p>
          <h1 className="mt-3 text-4xl font-black font-serif">{t("qrSpaces.createAccountRequired")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("qrSpaces.guestCreateBlocked")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/signup">{t("guest.registerSignUp")}</Link>
            <Link className="btn-ghost" to="/dashboard">{t("qrSpaces.backToDashboard")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.manage")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("qrSpaces.title")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("qrSpaces.subtitle")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => navigate("/qr-spaces/new")}>
            <Plus size={18} />
            <span>{t("qrSpaces.create")}</span>
          </button>
        </div>
      </section>

      {error ? <div className="rounded-3xl border border-red-500 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

      {loading ? (
        <section className="card p-5 text-slatebody">{t("qrSpaces.loading")}</section>
      ) : sortedSpaces.length === 0 ? (
        <section className="card p-6 text-slatebody">{t("qrSpaces.empty")}</section>
      ) : (
        <section className="grid gap-4">
          {sortedSpaces.map((space) => (
            <article key={space.id} className="card p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{qrTargetLabel(space.targetType, t)}</p>
                  <h2 className="mt-2 text-2xl font-black">{space.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-2 text-sm text-slatebody">
                    <span className="rounded-full border border-borderline px-3 py-1">{qrVisibilityLabel(space.visibility, t)}</span>
                    <span className="rounded-full border border-borderline px-3 py-1">{qrSpaceStatus(space, t)}</span>
                    <span className="rounded-full border border-borderline px-3 py-1">
                      {space.requireApproval ? t("qrSpaces.requireApproval") : t("qrSpaces.approvalNotRequired")}
                    </span>
                    <span className="rounded-full border border-borderline px-3 py-1">{formatDate(space.expiresAt, t)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost inline-flex items-center gap-2" onClick={() => copyLink(space)}>
                    <Copy size={16} />
                    <span>{copiedId === space.id ? t("qrSpaces.linkCopied") : t("qrSpaces.copyLink")}</span>
                  </button>
                  <Link className="btn-primary inline-flex items-center gap-2" to={`/qr-spaces/${space.id}`}>
                    <Eye size={16} />
                    <span>{t("qrSpaces.details")}</span>
                  </Link>
                  <button
                    type="button"
                    className="btn-ghost inline-flex items-center gap-2"
                    disabled={Boolean(space.disabledAt || busyId === space.id)}
                    onClick={() => disableSpace(space)}
                  >
                    <Trash2 size={16} />
                    <span>{t("qrSpaces.disable")}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
