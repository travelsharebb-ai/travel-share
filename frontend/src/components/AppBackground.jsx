import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api, currentUser } from "../lib/api";

export default function AppBackground() {
  const [videoUrl, setVideoUrl] = useState("/videos/come-to-barbados.mp4");
  const user = currentUser();
  const location = useLocation();
  const videoPaths = new Set(["/", "/login", "/signup", "/discover", "/privacy", "/terms"]);

  useEffect(() => {
    api("/api/public/appearance")
      .then((data) => setVideoUrl(data.appearance?.backgroundVideoUrl || "/videos/come-to-barbados.mp4"))
      .catch(() => {});
  }, []);

  // Do not play the background video once a user is signed in — only show on public pages
  if (user || !videoUrl || !videoPaths.has(location.pathname)) return null;
  
  return <video className="app-bg-video" src={videoUrl} autoPlay muted loop playsInline aria-hidden="true" />;
}