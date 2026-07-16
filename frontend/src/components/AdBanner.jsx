import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n.js";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api.js";

const LAST_AD_ID_KEY = "travelShareAdRotation:lastAdId";
const LAST_SHOWN_AT_KEY = "travelShareAdRotation:lastShownAt";
const HIDE_DURATION_MS = 500;
const DEFAULT_DISPLAY_SECONDS = 15;
const DEFAULT_ROTATION_MINUTES = 5;
const HIDE_EXCLUDED_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/oauth/callback",
  "/privacy",
  "/terms",
  "/scan",
  "/qr"
];

function pathMatches(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function determinePlacement(path) {
  if (pathMatches(path, "/admin")) return null;
  if (HIDE_EXCLUDED_PATHS.some((excluded) => pathMatches(path, excluded))) return null;
  if (pathMatches(path, "/map")) return "map";
  if (pathMatches(path, "/events")) return "event";
  if (pathMatches(path, "/guest")) return "guest";
  if (path.includes("/success")) return "upload_success";
  if (pathMatches(path, "/qr") || pathMatches(path, "/guest/access")) return null;
  if (pathMatches(path, "/dashboard") || pathMatches(path, "/tourist") || pathMatches(path, "/trips") || pathMatches(path, "/store") || pathMatches(path, "/approvals") || pathMatches(path, "/shared-albums") || pathMatches(path, "/settings") || pathMatches(path, "/discover") || pathMatches(path, "/share") || pathMatches(path, "/join")) {
    return "tourist";
  }
  return "global";
}

function trackInteraction(adId, type, placement, path) {
  api(`/api/ads/${encodeURIComponent(adId)}/interaction`, {
    method: "POST",
    body: JSON.stringify({ type, placement, path })
  }).catch((error) => {
    if (import.meta.env.DEV) console.debug("Ad analytics request failed", error);
  });
}

export default function AdBanner() {
  const { t } = useLanguage();
  const location = useLocation();
  const [placement, setPlacement] = useState(() => determinePlacement(location.pathname));
  const [ad, setAd] = useState(null);
  const [visibleState, setVisibleState] = useState("hidden");
  const [impressionLogged, setImpressionLogged] = useState(false);
  const [rotationMinutes, setRotationMinutes] = useState(DEFAULT_ROTATION_MINUTES);
  const [rotationCycle, setRotationCycle] = useState(0);

  useEffect(() => {
    const nextPlacement = determinePlacement(location.pathname);
    setPlacement(nextPlacement);
    setAd(null);
    setVisibleState("hidden");
    setImpressionLogged(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!placement) return undefined;
    let mounted = true;
    let showTimer;
    api(`/api/ads?placement=${encodeURIComponent(placement)}`)
      .then((data) => {
        if (!mounted) return;
        const candidates = Array.isArray(data.ads) ? data.ads : [];
        const configuredMinutes = Number(data.rotationMinutes);
        const nextRotationMinutes = Number.isInteger(configuredMinutes) && configuredMinutes >= 1 && configuredMinutes <= 1440
          ? configuredMinutes
          : DEFAULT_ROTATION_MINUTES;
        setRotationMinutes(nextRotationMinutes);

        if (candidates.length === 0) {
          showTimer = window.setTimeout(() => {
            if (mounted) setRotationCycle((current) => current + 1);
          }, nextRotationMinutes * 60 * 1000);
          return;
        }

        const lastShownAt = Number(sessionStorage.getItem(LAST_SHOWN_AT_KEY) || 0);
        const waitMs = Math.max(0, (nextRotationMinutes * 60 * 1000) - (Date.now() - lastShownAt));
        showTimer = window.setTimeout(() => {
          if (!mounted) return;
          const lastAdId = sessionStorage.getItem(LAST_AD_ID_KEY);
          const previousIndex = candidates.findIndex((candidate) => candidate.id === lastAdId);
          const nextIndex = previousIndex >= 0 ? (previousIndex + 1) % candidates.length : 0;
          setAd(candidates[nextIndex]);
          setVisibleState("hidden");
          setImpressionLogged(false);
        }, waitMs);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      if (showTimer) window.clearTimeout(showTimer);
    };
  }, [placement, location.pathname, rotationCycle]);

  useEffect(() => {
    if (!ad) return undefined;
    setVisibleState("entering");
    const enter = window.setTimeout(() => setVisibleState("visible"), 50);
    const displayMs = ((ad.displaySeconds || DEFAULT_DISPLAY_SECONDS) * 1000) + 50;
    const hideTimer = window.setTimeout(() => setVisibleState("exiting"), displayMs);
    const cleanup = window.setTimeout(() => setVisibleState("hidden"), displayMs + HIDE_DURATION_MS);
    const nextRotation = window.setTimeout(
      () => setRotationCycle((current) => current + 1),
      Math.max(rotationMinutes * 60 * 1000, displayMs + HIDE_DURATION_MS)
    );
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanup);
      window.clearTimeout(nextRotation);
    };
  }, [ad, rotationMinutes]);

  useEffect(() => {
    if (!ad || visibleState !== "visible" || impressionLogged) return undefined;
    sessionStorage.setItem(LAST_AD_ID_KEY, ad.id);
    sessionStorage.setItem(LAST_SHOWN_AT_KEY, String(Date.now()));
    setImpressionLogged(true);
    trackInteraction(ad.id, "impression", placement, location.pathname);
  }, [ad, visibleState, impressionLogged, placement, location.pathname]);

  if (!ad || visibleState === "hidden") return null;

  const isVideo = ad.mediaType === "video";
  const handleClose = () => setVisibleState("exiting");
  const handleClick = () => {
    if (!ad.linkUrl) return;
    window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
    trackInteraction(ad.id, "click", placement, location.pathname);
  };

  const transform = visibleState === "entering" ? "translateX(120vw)" : visibleState === "visible" ? "translateX(0)" : "translateX(-120vw)";
  const opacity = visibleState === "visible" ? 1 : 0;

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        className="ad-surface pointer-events-auto max-w-[720px] w-full rounded-3xl border p-4 shadow-2xl backdrop-blur"
        style={{ transform, opacity, transition: "transform 450ms ease, opacity 450ms ease" }}
      >
        <div className="flex items-start gap-4 sm:gap-5">
          {ad.mediaUrl ? (
            <div className="ad-media-surface flex-shrink-0 w-24 h-24 overflow-hidden rounded-3xl sm:w-28 sm:h-28">
              {isVideo ? (
                <video className="h-full w-full object-cover" src={ad.mediaUrl} autoPlay controls muted playsInline loop preload="metadata" />
              ) : (
                <img className="h-full w-full object-cover" src={ad.mediaUrl} alt={ad.title || t("admin.ads.sponsored", "Sponsored")} />
              )}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
                <span className="ad-sponsored text-xs uppercase tracking-[0.28em]">{t("admin.ads.sponsored", "Sponsored")}</span>
                <button className="ad-close" onClick={handleClose} aria-label={t("admin.ads.closeAd", "Close ad")}>×</button>
            </div>
            <div className="ad-title mt-2 text-lg font-black sm:text-xl">{ad.title}</div>
            {ad.description ? <p className="ad-copy mt-2 text-sm sm:text-base">{ad.description}</p> : null}
            {ad.linkUrl ? (
              <button className="btn-primary mt-4" type="button" onClick={handleClick}>{t("admin.ads.openAd", "Open ad")}</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
