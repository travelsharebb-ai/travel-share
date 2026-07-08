import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api, currentUser } from "../lib/api";

function detectMediaType(value, fallback = "video") {
  if (!value || typeof value !== "string") return fallback;
  const normalizedValue = value.toLowerCase();
  const extension = normalizedValue.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/)?.[1];
  if (["mp4", "webm", "mov", "m4v"].includes(extension)) return "video";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension)) return "image";
  return fallback;
}

export default function AppBackground() {
  const [media, setMedia] = useState({ mediaUrl: "/videos/come-to-barbados.mp4", mediaType: "video" });
  const user = currentUser();
  const location = useLocation();
  const videoPaths = new Set(["/", "/login", "/signup", "/discover", "/privacy", "/terms"]);

  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const isVideoOnlyPath = videoPaths.has(normalizedPath);

  useEffect(() => {
    api("/api/public/appearance")
      .then((data) => {
        const appearance = data.appearance || {};
        const defaultVideo = "/videos/come-to-barbados.mp4";
        const appearanceVideoUrl = appearance.backgroundVideoUrl || appearance.backgroundMediaUrl;
        const mediaUrl = isVideoOnlyPath
          ? appearance.backgroundVideoUrl || (detectMediaType(appearanceVideoUrl, "image") === "video" ? appearanceVideoUrl : defaultVideo)
          : appearance.backgroundMediaUrl || appearance.backgroundVideoUrl || defaultVideo;
        const mediaType = isVideoOnlyPath ? "video" : appearance.backgroundMediaType || detectMediaType(mediaUrl, "video");
        setMedia({ mediaUrl, mediaType });
      })
      .catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const element = document.documentElement;
    if (isVideoOnlyPath && !user) {
      element.classList.add("video-only-background");
    } else {
      element.classList.remove("video-only-background");
    }
    return () => {
      element.classList.remove("video-only-background");
    };
  }, [isVideoOnlyPath, user]);

  // Do not play the background video once a user is signed in — only show on public pages
  if (user || !media.mediaUrl || !videoPaths.has(location.pathname)) return null;

  if (media.mediaType === "image") {
    return <img className="app-bg-image" src={media.mediaUrl} alt="" aria-hidden="true" />;
  }
  
  return <video className="app-bg-video" src={media.mediaUrl} autoPlay muted loop playsInline aria-hidden="true" />;
}