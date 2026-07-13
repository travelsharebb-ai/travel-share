import { useEffect, useState } from "react";
import { useLanguage } from "../lib/i18n.js";
import { useLocation } from "react-router-dom";
import { api } from "../lib/api.js";

const SESSION_KEY_PREFIX = "travelShareAdSeen:";
const HIDE_DURATION_MS = 500;
const DEFAULT_DISPLAY_SECONDS = 15;
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

export default function AdBanner() {
  const { t } = useLanguage();
  const location = useLocation();
  const [placement, setPlacement] = useState(() => determinePlacement(location.pathname));
  const [ad, setAd] = useState(null);
  const [visibleState, setVisibleState] = useState("hidden");
  const [impressionLogged, setImpressionLogged] = useState(false);
  const [sessionDisabled, setSessionDisabled] = useState(false);

  useEffect(() => {
    const nextPlacement = determinePlacement(location.pathname);
    setPlacement(nextPlacement);
    setAd(null);
    setVisibleState("hidden");
    setImpressionLogged(false);
    setSessionDisabled(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!placement) return undefined;
    let mounted = true;
    api(`/api/ads?placement=${encodeURIComponent(placement)}`)
      .then((data) => {
        if (!mounted) return;
        if (!Array.isArray(data.ads) || data.ads.length === 0) return;
        const candidate = data.ads[0];
        if (sessionStorage.getItem(`${SESSION_KEY_PREFIX}${candidate.id}`)) {
          setSessionDisabled(true);
          return;
        }
        setAd(candidate);
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [placement]);

  useEffect(() => {
    if (!ad) return undefined;
    setVisibleState("entering");
    const enter = window.setTimeout(() => setVisibleState("visible"), 50);
    const displayMs = ((ad.displaySeconds || DEFAULT_DISPLAY_SECONDS) * 1000) + 50;
    const hideTimer = window.setTimeout(() => setVisibleState("exiting"), displayMs);
    const cleanup = window.setTimeout(() => setVisibleState("hidden"), displayMs + HIDE_DURATION_MS);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(hideTimer);
      window.clearTimeout(cleanup);
    };
  }, [ad]);

  useEffect(() => {
    if (!ad || visibleState !== "visible" || impressionLogged) return undefined;
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${ad.id}`, "1");
    setImpressionLogged(true);
  }, [ad, visibleState, impressionLogged]);

  if (!ad || visibleState === "hidden" || sessionDisabled) return null;

  const isVideo = ad.mediaType === "video";
  const handleClose = () => setVisibleState("exiting");
  const handleClick = () => {
    if (!ad.linkUrl) return;
    window.open(ad.linkUrl, "_blank", "noopener,noreferrer");
  };

  const transform = visibleState === "entering" ? "translateX(120vw)" : visibleState === "visible" ? "translateX(0)" : "translateX(-120vw)";
  const opacity = visibleState === "visible" ? 1 : 0;

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto max-w-[720px] w-full rounded-3xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur"
        style={{ transform, opacity, transition: "transform 450ms ease, opacity 450ms ease" }}
      >
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="flex-shrink-0 w-24 h-24 overflow-hidden rounded-3xl bg-slate-900 sm:w-28 sm:h-28">
            {isVideo ? (
              <video className="h-full w-full object-cover" src={ad.mediaUrl} muted playsInline loop preload="metadata" />
            ) : (
              <img className="h-full w-full object-cover" src={ad.mediaUrl} alt={ad.title || "Sponsored"} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
                <span className="text-xs uppercase tracking-[0.28em] text-primary">{t("admin.ads.sponsored", "Sponsored")}</span>
                <button className="text-slatebody hover:text-white" onClick={handleClose} aria-label={t("admin.ads.closeAd", "Close ad")}>×</button>
            </div>
            <div className="mt-2 text-lg font-black text-white sm:text-xl">{ad.title}</div>
            {ad.description ? <p className="mt-2 text-sm text-slatebody sm:text-base">{ad.description}</p> : null}
            {ad.linkUrl ? (
              <button className="btn-primary mt-4" type="button" onClick={handleClick}>{t("admin.ads.openAd", "Open ad")}</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
