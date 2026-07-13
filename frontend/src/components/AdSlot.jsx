import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n.js";
import { useLocation } from "react-router-dom";

const IMPRESSION_SESSION_KEY_PREFIX = "travelShareAdSlotImpression:";

function trackInteraction(adId, type, placement, path) {
  api(`/api/ads/${encodeURIComponent(adId)}/interaction`, {
    method: "POST",
    body: JSON.stringify({ type, placement, path })
  }).catch((error) => {
    if (import.meta.env.DEV) console.debug("Ad analytics request failed", error);
  });
}

export default function AdSlot({ placement = "global", variant = "inline", onClose } = {}) {
  const { t } = useLanguage();
  const location = useLocation();
  const [ad, setAd] = useState(null);
  const [visible, setVisible] = useState(false);
  const [impressionLogged, setImpressionLogged] = useState(false);

  useEffect(() => {
    let mounted = true;
    api(`/api/ads?placement=${encodeURIComponent(placement)}`)
      .then((data) => {
        if (!mounted) return;
        if (Array.isArray(data.ads) && data.ads.length > 0) {
          setAd(data.ads[0]);
          setVisible(true);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [placement]);

  useEffect(() => {
    if (!ad || impressionLogged) return;
    const sessionKey = `${IMPRESSION_SESSION_KEY_PREFIX}${placement}:${ad.id}`;
    setImpressionLogged(true);
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");
    trackInteraction(ad.id, "impression", placement, location.pathname);
  }, [ad, impressionLogged, placement, location.pathname]);

  if (!ad || !visible) return null;

  const handleClose = (event) => {
    event.stopPropagation();
    setVisible(false);
    if (typeof onClose === "function") onClose();
  };

  const handleClick = () => {
    if (ad.linkUrl) {
      window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
      trackInteraction(ad.id, "click", placement, location.pathname);
    }
  };

  const media = !ad.mediaUrl ? null : ad.mediaType === "video" ? (
    <video className="w-full rounded-3xl" src={ad.mediaUrl} autoPlay={variant === "banner"} controls muted playsInline loop preload="metadata" />
  ) : (
    <img className="w-full rounded-3xl object-cover" src={ad.mediaUrl} alt={ad.title || t("admin.ads.sponsored", "Sponsored")} />
  );

  if (variant === "modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="relative w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-4 shadow-xl">
          <button className="absolute right-4 top-4 text-slatebody hover:text-white" onClick={handleClose} aria-label={t("admin.ads.closeAd", "Close ad")}>×</button>
          <div className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.ads.sponsored", "Sponsored")}</div>
          <div className="mt-3 text-2xl font-black text-white">{ad.title}</div>
          {ad.description ? <p className="mt-2 text-sm text-slatebody">{ad.description}</p> : null}
          {media ? <div className="mt-4 cursor-pointer" onClick={handleClick}>{media}</div> : null}
          {ad.linkUrl ? <button className="btn-primary mt-4 w-full" onClick={handleClick}>{t("admin.ads.openAd", "Open ad")}</button> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={variant === "banner" ? "fixed bottom-4 left-4 right-4 z-40 rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl" : "rounded-3xl border border-white/10 bg-slate-950 p-4"}>
      {media ? <div className="mb-4 overflow-hidden rounded-3xl bg-slate-900">{media}</div> : null}
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm uppercase tracking-[0.32em] text-primary">{t("admin.ads.sponsored", "Sponsored")}</div>
          <div className="mt-2 text-lg font-black text-white">{ad.title}</div>
          {ad.description ? <p className="mt-2 text-sm text-slatebody">{ad.description}</p> : null}
          {ad.linkUrl ? <button className="btn-primary mt-3" onClick={handleClick}>{t("admin.ads.openAd", "Open ad")}</button> : null}
        </div>
        <button className="text-slatebody hover:text-white" onClick={handleClose} aria-label={t("admin.ads.closeAd", "Close ad")}>×</button>
      </div>
    </div>
  );
}
