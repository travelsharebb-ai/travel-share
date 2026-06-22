import { useEffect, useMemo, useState, useRef } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Calendar,
  Check,
  CircleDollarSign,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Flame,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MousePointer2,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
  X
} from "lucide-react";
import Shell from "./components/Shell";
import MediaCard from "./components/MediaCard";
import ScreenshotGuard from "./components/ScreenshotGuard";
import { API_URL, api, currentUser, setSession, updateStoredUser, getGuestToken, setGuestToken, clearGuestToken } from "./lib/api";
import LocationField from "./components/LocationField";
import { reverseGeocode } from "./lib/geocode";
import MapView from "./pages/MapView";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || "";

function isAdmin(user = currentUser()) {
  return ["admin", "platform_admin"].includes(user?.role);
}

function isOrganizer(user = currentUser()) {
  return ["admin", "platform_admin", "organizer"].includes(user?.role);
}

function PrivateRoute({ children, roles }) {
  const user = currentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role) && !(roles.includes("platform_admin") && user.role === "admin")) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function BottomAd() {
  const [ad, setAd] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer;
    let mounted = true;
    api("/api/public/ads/current")
      .then((data) => {
        if (!mounted || !data.ad) return;
        setAd(data.ad);
        requestAnimationFrame(() => setVisible(true));
        hideTimer = window.setTimeout(() => setVisible(false), Math.max(5, data.ad.displaySeconds || 12) * 1000);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!ad) return null;
  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 px-3 pb-3 transition-all duration-500 ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}>
      <div className="relative mx-auto w-full max-w-3xl rounded-lg border border-borderline bg-panel p-3 shadow-soft">
        <button className="absolute right-3 top-3 rounded-full bg-skysoft p-1 text-report" aria-label="Close ad" onClick={() => setVisible(false)}><X size={17} /></button>
        <a href={ad.linkUrl || "#"} target={ad.linkUrl ? "_blank" : undefined} rel="noreferrer" className="flex min-w-0 flex-col gap-3 pr-7 sm:flex-row sm:items-center">
          <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-skysoft sm:w-40">
            {ad.mediaType === "video" ? <video src={ad.mediaUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" /> : <img src={ad.mediaUrl} alt="" className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><Megaphone size={15} /> Sponsored</p>
            <p className="break-words text-base font-black">{ad.title}</p>
            {ad.description && <p className="line-clamp-2 break-words text-sm text-slatebody">{ad.description}</p>}
          </div>
          {ad.linkUrl && <ExternalLink className="hidden shrink-0 text-primary sm:block" size={20} />}
        </a>
      </div>
    </div>
  );
}

function AppBackground() {
  const [videoUrl, setVideoUrl] = useState("/videos/come-to-barbados.mp4");
  const user = currentUser();
  const location = useLocation();
  const videoPaths = new Set(["/", "/login", "/signup", "/discover", "/privacy"]);

  useEffect(() => {
    api("/api/public/appearance")
      .then((data) => setVideoUrl(data.appearance?.backgroundVideoUrl || "/videos/come-to-barbados.mp4"))
      .catch(() => {});
  }, []);

  // Do not play the background video once a user is signed in — only show on public pages
  if (user || !videoUrl || !videoPaths.has(location.pathname)) return null;
  return <video className="app-bg-video" src={videoUrl} autoPlay muted loop playsInline aria-hidden="true" />;
}

function applyActiveStoreItem(item) {
  const root = document.documentElement;
  root.classList.remove("has-active-skin", "has-active-theme");
  root.style.removeProperty("--app-skin-url");
  root.style.removeProperty("--app-accent");
  if (!item) return;

  const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
  if (item.type === "album_theme" || item.type === "event_theme") {
    const url = metadata.backgroundUrl || item.previewUrl;
    if (url) {
      root.style.setProperty("--app-skin-url", `url("${url}")`);
      root.classList.add("has-active-skin");
    }
    if (metadata.accentColor) {
      root.style.setProperty("--app-accent", metadata.accentColor);
      root.classList.add("has-active-theme");
    }
  }
}

function assetUrl(url) {
  return url && url.startsWith("/") ? `${API_URL}${url}` : url;
}

function SessionSync() {
  useEffect(() => {
    const user = currentUser();
    applyActiveStoreItem(user?.activeStoreItem || null);
    if (!user) return;
    api("/api/auth/me")
      .then((data) => {
        updateStoredUser(data.user);
        applyActiveStoreItem(data.user?.activeStoreItem || null);
      })
      .catch(() => {});
  }, []);
  return null;
}

function Landing() {
  const user = currentUser();
  if (user) return <Navigate to="/dashboard" replace />;
  return (
    <Shell>
      <main className="page-shell grid min-h-[calc(100vh-74px)] content-center gap-8 py-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
        <section className="hero-copy-panel min-w-0 space-y-6">
          <p className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">QR-powered travel and event memories</p>
          <h1 className="max-w-3xl break-words font-serif text-5xl font-black leading-tight sm:text-6xl">TravelShare</h1>
          <p className="max-w-2xl text-lg leading-8 text-slatebody">
            Collect memories from tourists, guests, and event crowds. Map the journey, replay the experience, and manage the whole platform from one business control panel.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link className="btn-primary" to="/signup"><QrCode size={19} /> Create account</Link>
            <Link className="btn-ghost" to="/guest"><Users size={19} /> Continue as guest</Link>
            <Link className="btn-ghost" to="/discover"><MapPin size={19} /> Discover events</Link>
            <Link className="btn-ghost" to="/privacy"><ShieldCheck size={19} /> Privacy promise</Link>
          </div>
        </section>
        <section className="grid gap-4">
          {[
            ["Tourist Mode", "Personal albums, memory maps, route replay, and QR photo collection."],
            ["Events Mode", "Custom event maps, zones, crowd status, and location-specific QR uploads."],
            ["Business Admin", "Users, organizers, ads, store items, reports, analytics, and settings."]
          ].map(([title, copy]) => {
            // Make 'Events Mode' card clickable to open the Events page
            if (title === "Events Mode") {
              return (
                <Link key={title} to="/events" className="card p-5 block">
                  <p className="font-serif text-2xl font-black">{title}</p>
                  <p className="mt-2 text-slatebody">{copy}</p>
                </Link>
              );
            }
            return (
              <div className="card p-5" key={title}>
                <p className="font-serif text-2xl font-black">{title}</p>
                <p className="mt-2 text-slatebody">{copy}</p>
              </div>
            );
          })}
        </section>
      </main>
    </Shell>
  );
}

function GuestMode() {
  const [items, setItems] = useState([]);
  const [guest, setGuest] = useState(null);
  const [guestTrips, setGuestTrips] = useState([]);
  const [guestEvents, setGuestEvents] = useState([]);
  const [creatorLoading, setCreatorLoading] = useState(false);
  const [tripForm, setTripForm] = useState({ title: "", destination: "", defaultLocationVisibility: "approximate" });
  const [eventForm, setEventForm] = useState({ title: "", category: "", location: "", description: "" });
  const [guestMessage, setGuestMessage] = useState("");
  const [showGuestToast, setShowGuestToast] = useState(false);

  // Auto-show toast when a guestMessage is set from anywhere
  useEffect(() => {
    if (guestMessage) setShowGuestToast(true);
  }, [guestMessage]);

  // Auto-hide toast after ~8 seconds when visible
  useEffect(() => {
    if (!showGuestToast) return;
    const t = window.setTimeout(() => setShowGuestToast(false), 8000);
    return () => window.clearTimeout(t);
  }, [showGuestToast]);

  useEffect(() => {
    api("/api/public/store-preview").then((data) => setItems(data.items || [])).catch(() => {});
    // If we have a stored guest token from earlier, try to resume creator session
    const token = getGuestToken();
    if (token) {
      loadCreator(token).catch(() => {
        // ignore resume failures
      });
    }
  }, []);

  async function loadCreator(token) {
    const opts = token ? { headers: { "x-guest-token": token } } : {};
    const data = await api("/api/public/guest/creator", opts);
    setGuest(data.guest);
    // persist guest token locally so user can return if cookie isn't persisted
    if (data?.guest?.token) setGuestToken(data.guest.token);
    setGuestTrips(data.trips || []);
    setGuestEvents(data.events || []);
  }

  async function startCreator() {
    if (creatorLoading) return;
    setCreatorLoading(true);
    try {
      const res = await api("/api/public/guest/creator", { method: "POST", body: "{}" });
      // Try to load creator with cookie first; if cookie wasn't set due to CORS/SameSite,
      // fall back to using the returned token as an x-guest-token header.
      await loadCreator(res?.guest?.token);
      setGuestMessage("Guest creator started — you can now create temporary albums or events.");
      // show toast when message is set
      setShowGuestToast(true);
    } catch (err) {
      console.error("Failed to start guest creator:", err);
      setGuestMessage(err?.message || "Failed to start guest creator. Try again.");
      setShowGuestToast(true);
    } finally {
      setCreatorLoading(false);
    }
  }

  async function createGuestTrip(event) {
    event.preventDefault();
    const data = await api("/api/public/guest/trips", { method: "POST", body: JSON.stringify(tripForm) });
    setGuestMessage(`Guest album created. QR link: ${data.scanUrl}`);
    setTripForm({ title: "", destination: "", defaultLocationVisibility: "approximate" });
    await loadCreator();
  }

  async function createGuestEvent(event) {
    event.preventDefault();
    const data = await api("/api/public/guest/events", { method: "POST", body: JSON.stringify(eventForm) });
    setGuestMessage(`Guest event created. QR link: ${data.scanUrl}`);
    setEventForm({ title: "", category: "", location: "", description: "" });
    await loadCreator();
  }

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <HeaderBlock eyebrow="Guest Access" title="Use TravelShare without signing up" copy="Guests can enter from QR links, public event pages, or shared albums. You can view allowed spaces and upload memories for 3 days, then create an account to keep them." />
        </section>
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="card p-5">
            <MapPin className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">Tourist Guest</h2>
            <p className="mt-2 text-slatebody">Scan a trip QR, upload photos/videos, add captions, choose location privacy, and wait for album-owner approval.</p>
          </div>
          <div className="card p-5">
            <Calendar className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">Event Guest</h2>
            <p className="mt-2 text-slatebody">Open public events, scan zone QR codes, contribute memories to stages, vendors, photo hotspots, and live event maps.</p>
          </div>
          <div className="card p-5">
            <Lock className="text-primary" size={32} />
            <h2 className="mt-3 font-serif text-2xl font-black">After 3 Days</h2>
            <p className="mt-2 text-slatebody">Sign in to continue, claim guest uploads, buy add-ons, create albums, host events, or manage business tools.</p>
          </div>
        </section>
        <section className="hero-copy-panel flex flex-col gap-3 sm:flex-row items-center">
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
            <Link className="btn-primary" to="/discover"><MapPin size={18} /> Discover public events</Link>
            <Link className="btn-primary" to="/signup"><QrCode size={18} /> Create account to host</Link>
            {!guest ? (
              <button className={`btn-ghost ${creatorLoading ? "opacity-60 cursor-not-allowed" : ""}`} onClick={startCreator} disabled={creatorLoading} aria-busy={creatorLoading}><Sparkles size={18} /> {creatorLoading ? "Starting…" : "Start 3-day guest creator"}</button>
            ) : (
              <button className="btn-ghost" onClick={async () => {
                try {
                  await api("/api/public/guest/creator", { method: "DELETE" });
                  setGuest(null);
                  clearGuestToken();
                  setGuestMessage("Guest creator deactivated.");
                  setShowGuestToast(true);
                } catch (err) {
                  setGuestMessage(err.message || "Could not deactivate guest creator.");
                  setShowGuestToast(true);
                }
              }}><Trash2 size={16} /> Close guest creator</button>
            )}
          </div>
          {/* Guest toast placed inside the hero action area so it visually belongs to the guest flow */}
          {showGuestToast && guestMessage && (
            <div className="mt-2 sm:mt-0 sm:ml-4">
              <div className="relative inline-block">
                <div className="bg-black/75 text-white rounded-lg px-4 py-2 shadow-lg max-w-lg">
                  <button aria-label="Dismiss" className="absolute right-2 top-1 text-white text-lg leading-none opacity-90 hover:opacity-100" onClick={() => setShowGuestToast(false)}>×</button>
                  <p className="text-sm break-words">{guestMessage}</p>
                </div>
              </div>
            </div>
          )}
        </section>
        {guest && (
          <section className="grid gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-primary">Your Temporary Albums</h3>
              <div className="grid gap-4">
                {guestTrips.length === 0 ? (
                  <EmptyCard title="No guest albums" copy="Create a guest album above to collect uploads." />
                ) : (
                  guestTrips.map((trip) => (
                    <div key={trip.id} className="card p-4">
                      <Link to={`/trip/${trip.qrToken}`} className="block">
                        <p className="font-serif text-2xl font-black">{trip.title}</p>
                        <p className="text-slatebody">{trip.destination || "Guest album"} • {trip._count?.uploads || 0} uploads</p>
                        <p className="mt-2 text-primary">Open album QR page</p>
                      </Link>
                      <div className="mt-3 flex gap-2">
                        <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/trip/${trip.qrToken}`); setGuestMessage("Album link copied to clipboard."); setShowGuestToast(true); }}>Copy link</button>
                        <Link className="btn-ghost" to={`/trip/${trip.qrToken}`}>Open</Link>
                        <button className="btn-ghost text-reject" onClick={async () => {
                          if (!confirm("Delete this temporary album? This cannot be undone.")) return;
                          try {
                            await api(`/api/public/guest/trips/${trip.id}`, { method: "DELETE" });
                            setGuestTrips((list) => list.filter((t) => t.id !== trip.id));
                            setGuestMessage("Album deleted.");
                            setShowGuestToast(true);
                          } catch (err) {
                            setGuestMessage(err.message || "Could not delete album.");
                            setShowGuestToast(true);
                          }
                        }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-black uppercase text-primary">Your Temporary Events</h3>
              <div className="grid gap-4">
                {guestEvents.length === 0 ? (
                  <EmptyCard title="No guest events" copy="Create a guest event above to collect uploads." />
                ) : (
                  guestEvents.map((event) => (
                    <div key={event.id} className="card p-4">
                      <Link to={`/event/${event.qrToken}`} className="block">
                        <p className="font-serif text-2xl font-black">{event.title}</p>
                        <p className="text-slatebody">{event.location || "Guest event"} • {event._count?.uploads || 0} uploads</p>
                        <p className="mt-2 text-primary">Open event QR page</p>
                      </Link>
                      <div className="mt-3 flex gap-2">
                        <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/event/${event.qrToken}`); setGuestMessage("Event link copied to clipboard."); setShowGuestToast(true); }}>Copy link</button>
                        <Link className="btn-ghost" to={`/event/${event.qrToken}`}>Open</Link>
                        <button className="btn-ghost" onClick={async () => {
                          try {
                            const data = await api(`/api/public/guest/events/${event.id}/share-links`, { method: "POST" });
                            navigator.clipboard?.writeText(data.url);
                            setGuestMessage("Saved event link copied to clipboard.");
                            setShowGuestToast(true);
                          } catch (err) {
                            setGuestMessage(err.message || "Could not create share link.");
                            setShowGuestToast(true);
                          }
                        }}>Save link</button>
                        <button className="btn-ghost text-reject" onClick={async () => {
                          if (!confirm("Delete this temporary event? This cannot be undone.")) return;
                          try {
                            await api(`/api/public/guest/events/${event.id}`, { method: "DELETE" });
                            setGuestEvents((list) => list.filter((e) => e.id !== event.id));
                            setGuestMessage("Event deleted.");
                            setShowGuestToast(true);
                          } catch (err) {
                            setGuestMessage(err.message || "Could not delete event.");
                            setShowGuestToast(true);
                          }
                        }}>Delete</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}
        <section className="space-y-4">
          <div className="card p-5">
            <HeaderBlock eyebrow="Premium Skins" title="Preview add-ons as a guest" copy="You can browse skins, frames, themes, premium QR styles, ad-free viewing, and branded pages. Sign up to use or purchase them." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.length === 0 ? (
              <EmptyCard title="No store items" copy="Preview items will appear here." />
            ) : (
              items.map((item) => (
                <Link key={item.id} to="/store" className="card p-5 transition hover:-translate-y-1">
                  {item.previewUrl && <img src={item.previewUrl} alt="" className="mb-4 h-36 w-full rounded-lg object-cover" />}
                  <p className="text-xs font-black uppercase text-primary">{item.type || "Store item"}</p>
                  <h2 className="font-serif text-2xl font-black">{item.name}</h2>
                  <p className="text-sm text-slatebody">{item.description || ""}</p>
                  <p className="mt-3 text-sm font-bold text-primary">{(item.priceCents || 0) > 0 ? `$${((item.priceCents || 0) / 100).toFixed(2)}` : "Free"}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function AuthPage({ mode }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, { method: "POST", body: JSON.stringify(form) });
      setSession(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  async function oauth(provider) {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="font-serif text-3xl font-black">{isSignup ? "Create your TravelShare account" : "Welcome back"}</h1>
          {isSignup && <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          <input className="field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="relative">
            <input className="field pr-14" type={showPassword ? "text" : "password"} placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-report hover:bg-skysoft" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p className="break-words rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <button className="btn-primary w-full" type="submit">{isSignup ? "Sign up" : "Login"}</button>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" className="btn-ghost" onClick={() => oauth("google")}>Google</button>
            <button type="button" className="btn-ghost" onClick={() => oauth("microsoft")}>Microsoft</button>
          </div>
          {!isSignup && <Link className="block text-center text-sm font-bold text-primary" to="/forgot-password">Forgot password?</Link>}
        </form>
      </main>
    </Shell>
  );
}

function OAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const encodedUser = params.get("user");
      if (!token || !encodedUser) throw new Error("OAuth callback is missing session data.");
      const user = JSON.parse(atob(encodedUser.replace(/-/g, "+").replace(/_/g, "/")));
      setSession({ token, user });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }, [navigate]);

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="card max-w-md p-6 text-center">
          <h1 className="font-serif text-3xl font-black">{error ? "Sign-in failed" : "Signing you in..."}</h1>
          {error && <p className="mt-3 text-sm text-reject">{error}</p>}
        </div>
      </main>
    </Shell>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="font-serif text-3xl font-black">Reset your password</h1>
          <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {message && <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-trust">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <button className="btn-primary w-full">Send reset link</button>
        </form>
      </main>
    </Shell>
  );
}

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [valid, setValid] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/auth/reset-password/${token}`).then((data) => setValid(data.valid)).catch(() => setValid(false));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setMessage(data.message);
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5">
          <h1 className="font-serif text-3xl font-black">Choose a new password</h1>
          {valid === null && <p className="text-slatebody">Checking reset link...</p>}
          {valid === false && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">This reset link is invalid or expired.</p>}
          {valid && <input className="field" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          {message && <p className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-trust">{message}</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          {valid && <button className="btn-primary w-full">Change password</button>}
        </form>
      </main>
    </Shell>
  );
}

function Dashboard() {
  const user = currentUser();
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    api("/api/trips").then((data) => setTrips(data.trips || [])).catch(() => {});
  }, []);

  const chapterTarget = trips[0] ? `/trips/${trips[0].id}?tab=chapters` : "/tourist";
  const memoryCount = trips.reduce((sum, trip) => sum + (trip._count?.uploads || 0), 0);

  return (
    <Shell>
      <main className="page-shell journey-dashboard space-y-10">
        <section className="max-w-3xl">
          <p className="font-serif italic text-slatebody">{new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl font-black leading-tight">Your journey so far, {user?.name?.split(" ")[0]}</h1>
        </section>
        <section className="journey-stat-row">
          <p className="journey-zero">{memoryCount}</p>
          <div>
            <h2 className="font-serif text-3xl font-black">Memories collected</h2>
            <p className="mt-2 max-w-xl text-slatebody">Moments captured by you and the strangers who crossed your path.</p>
          </div>
        </section>
        <section className="journey-section">
          <div className="journey-heading"><h2 className="font-serif text-3xl font-black">Chapters</h2><span /></div>
          <p className="journey-empty">No chapters yet. Start your first one below.</p>
        </section>
        <section className="journey-section">
          <div className="journey-heading"><h2 className="font-serif text-3xl font-black">Recent Entries</h2><span /></div>
          <p className="journey-empty journey-entry">No entries yet. Your story begins when you create an album.</p>
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          <Link to="/tourist" className="card group p-6 transition hover:-translate-y-1">
            <p className="text-sm font-black uppercase text-primary">Tourist Mode</p>
            <h2 className="mt-2 font-serif text-3xl font-black">Memory maps and private albums</h2>
            <p className="mt-3 text-slatebody">Create trips, collect QR uploads, approve memories, and replay journeys by place.</p>
          </Link>
          <Link to="/events" className="card group p-6 transition hover:-translate-y-1">
            <p className="text-sm font-black uppercase text-primary">Events Mode</p>
            <h2 className="mt-2 font-serif text-3xl font-black">Live event maps and zones</h2>
            <p className="mt-3 text-slatebody">Host festivals, parties, tours, conferences, or pop-ups with QR-powered memory zones.</p>
          </Link>
        </section>
        <Link className="floating-chapter-btn" to={chapterTarget}><Sparkles size={18} /> Start a new chapter</Link>
      </main>
    </Shell>
  );
}

function TouristDashboard() {
  const [trips, setTrips] = useState([]);
  const [form, setForm] = useState({ title: "", destination: "", startDate: "", endDate: "", defaultLocationVisibility: "approximate" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const privacyModes = [
    ["exact", "Exact Location", "Use the true GPS point for precise memory pins."],
    ["approximate", "Approximate Location", "Recommended. Shows the area without exposing the exact spot."],
    ["hidden", "Hidden Region", "Stores privacy-first memories with only a general region shown."]
  ];

  async function load() {
    const data = await api("/api/trips");
    setTrips(data.trips);
  }

  useEffect(() => { load(); }, []);

  async function createTrip(event) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const data = await api("/api/trips", { method: "POST", body: JSON.stringify(form) });
      // Optimistically add the created trip to the list to avoid UI races
      if (data?.trip) setTrips((prev) => [data.trip, ...prev]);
      setForm({ title: "", destination: "", startDate: "", endDate: "", defaultLocationVisibility: "approximate" });
      // Refresh from server to ensure consistent counts and ordering
      await load();
    } catch (err) {
      setCreateError(err.message || "Could not create album. Try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <HeaderBlock eyebrow="Tourist Mode" title="Trips, albums, memory maps" copy="Collect private memories through QR links and turn approved uploads into an interactive journey." />
        <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createTrip} className="card min-w-0 space-y-3 p-5">
            <h2 className="font-serif text-2xl font-black">Create trip / album</h2>
            <input className="field" placeholder="Trip title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="field" placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <input className="field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-slatebody">Default location privacy</p>
              {privacyModes.map(([value, title, copy]) => (
                <button
                  key={value}
                  type="button"
                  className={`privacy-card ${form.defaultLocationVisibility === value ? "privacy-card-active" : ""}`}
                  onClick={() => setForm({ ...form, defaultLocationVisibility: value })}
                >
                  <span className="privacy-dot" />
                  <span>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </span>
                </button>
              ))}
            </div>
            {createError && <p className="text-sm font-bold text-reject">{createError}</p>}
            <button className="btn-primary w-full" disabled={creating} aria-busy={creating}><Calendar size={18} /> {creating ? "Creating…" : "Create Album"}</button>
          </form>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="card min-w-0 p-5 transition hover:-translate-y-1">
                <p className="break-words font-serif text-2xl font-black">{trip.title}</p>
                <p className="break-words text-slatebody">{trip.destination}</p>
                <p className="mt-4 text-sm font-bold text-primary">{trip._count?.uploads || 0} memories</p>
              </Link>
            ))}
            {trips.length === 0 && <EmptyCard icon={MapPin} title="No trips yet" copy="Create your first album and QR memory link." />}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function TripDetails() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const [trip, setTrip] = useState(null);
  const [tab, setTab] = useState(searchParams.get("tab") || "pending");
  const [uploads, setUploads] = useState([]);
  const [skinOptions, setSkinOptions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [qr, setQr] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [chapterForm, setChapterForm] = useState({ title: "", note: "" });
  const pendingCount = uploads.filter((u) => u.status === "pending").length;

  async function load() {
    const [tripData, uploadsData, qrData, mapResponse, storeData] = await Promise.all([
      api(`/api/trips/${tripId}`),
      api(`/api/trips/${tripId}/uploads`),
      api(`/api/trips/${tripId}/qr`),
      api(`/api/trips/${tripId}/map`),
      api("/api/store")
    ]);
    setTrip(tripData.trip);
    setUploads(uploadsData.uploads);
    setQr(qrData);
    setMapData(mapResponse);
    setSkinOptions((storeData.items || []).filter((item) => item.type === "image_skin" && item.owned));
  }

  useEffect(() => { load(); }, [tripId]);

  async function action(id, name) {
    await api(`/api/uploads/${id}/${name}`, { method: "PATCH", body: name === "report" ? JSON.stringify({ reportReason: "Reported by album owner", blockUploader: false }) : "{}" });
    load();
  }

  async function bulk(actionName) {
    await api(`/api/trips/${tripId}/uploads/bulk`, { method: "POST", body: JSON.stringify({ uploadIds: selected, action: actionName }) });
    setSelected([]);
    load();
  }

  async function updateQr(body) {
    await api(`/api/trips/${tripId}/qr-settings`, { method: "PATCH", body: JSON.stringify(body) });
    load();
  }

  async function createShareLink() {
    const data = await api(`/api/trips/${tripId}/share-links`, { method: "POST", body: JSON.stringify({}) });
    await navigator.clipboard?.writeText(data.url);
    alert("Private share link created and copied.");
  }

  async function createChapter(event) {
    event.preventDefault();
    await api(`/api/trips/${tripId}/chapters`, { method: "POST", body: JSON.stringify(chapterForm) });
    setChapterForm({ title: "", note: "" });
    load();
  }

  async function applySkin(uploadId, skinId) {
    await api(`/api/uploads/${uploadId}/skin`, { method: "PATCH", body: JSON.stringify({ skinId }) });
    load();
  }

  const visible = uploads.filter((u) => tab === "pending" ? u.status === "pending" : u.status === "approved");
  if (!trip) return <Shell><main className="page-shell">Loading...</main></Shell>;

  return (
    <Shell>
      <main className="page-shell space-y-5">
        <div className="card min-w-0 p-5">
          <p className="text-sm font-black uppercase text-primary">Tourist Album</p>
          <h1 className="break-words font-serif text-4xl font-black">{trip.title}</h1>
          <p className="break-words text-slatebody">{trip.destination}</p>
          <div className="mt-4 hidden lg:flex gap-2 overflow-x-auto">
            {["pending", "approved", "chapters", "map", "qr", "stats"].map((item) => (
              <button key={item} onClick={() => setTab(item)} className={tab === item ? "btn-primary shrink-0" : "btn-ghost shrink-0"}>
                {item === "qr" ? "QR Settings" : item === "approved" ? "Approved Album" : item === "map" ? "Memory Map" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
              <Link to={`/trips/${trip.id}/upload`} className="btn-ghost shrink-0">Upload memory</Link>
          </div>

          {/* Mobile: compact tab selector so map remains reachable on small screens */}
          <div className="mt-4 lg:hidden">
            <label className="sr-only">Select view</label>
            <select className="field w-full" value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Select album view">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="chapters">Chapters</option>
              <option value="map">Map</option>
              <option value="qr">QR Settings</option>
              <option value="stats">Stats</option>
            </select>
          </div>
        </div>

        {tab === "pending" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button className="btn-ghost" onClick={() => setSelected(visible.map((u) => u.id))}>Select All</button>
              <button className="btn-green" disabled={!selected.length} onClick={() => bulk("approve")}><Check size={18} /> Approve Selected</button>
              <button className="btn-danger" disabled={!selected.length} onClick={() => bulk("reject")}>Reject Selected</button>
            </div>
            {visible.length === 0 ? <EmptyCard title="No new uploads yet" copy="Share the QR at beaches, tours, and events to start collecting memories." /> : <MediaGrid uploads={visible} selected={selected} setSelected={setSelected} action={action} skinOptions={skinOptions} onApplySkin={applySkin} />}
          </section>
        )}

        {tab === "approved" && (visible.length === 0 ? <EmptyCard title="No approved memories yet" copy="Approved uploads will appear in your album and memory map." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map((upload) => <MediaCard key={upload.id} upload={upload} skinOptions={skinOptions} onApplySkin={applySkin} onDelete={(id) => api(`/api/uploads/${id}`, { method: "DELETE" }).then(load)} />)}</div>)}
        {tab === "chapters" && <ChaptersPanel chapters={trip.chapters || []} chapterForm={chapterForm} setChapterForm={setChapterForm} createChapter={createChapter} />}
        {tab === "map" && <MemoryMap data={mapData} tripId={trip.id} />}
        {tab === "qr" && qr && <QrPanel qr={qr} trip={trip} updateQr={updateQr} createShareLink={createShareLink} />}
        {tab === "stats" && <StatsGrid stats={{ Pending: pendingCount, Approved: uploads.filter((u) => u.status === "approved").length, Reported: uploads.filter((u) => u.status === "reported").length, "Map Pins": mapData?.pins?.length || 0 }} />}
        <button className="floating-chapter-btn" onClick={() => setTab("chapters")}><Sparkles size={18} /> Start a new chapter</button>
      </main>
    </Shell>
  );
}

function ChaptersPanel({ chapters, chapterForm, setChapterForm, createChapter }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={createChapter} className="card space-y-3 p-5">
        <p className="text-sm font-black uppercase text-primary">Trip Journal</p>
        <h2 className="font-serif text-2xl font-black">Start a new chapter</h2>
        <input className="field" placeholder="Chapter title" value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} />
        <textarea className="field min-h-28" placeholder="What happened in this part of the journey?" value={chapterForm.note} onChange={(e) => setChapterForm({ ...chapterForm, note: e.target.value })} />
        <button className="btn-primary w-full"><Sparkles size={18} /> Save Chapter</button>
      </form>
      <div className="space-y-3">
        {chapters.length === 0 && <EmptyCard icon={Sparkles} title="No chapters yet" copy="Start your first one to give the album a story, not just a gallery." />}
        {chapters.map((chapter) => (
          <article key={chapter.id} className="card p-5">
            <p className="text-xs font-black uppercase text-primary">{new Date(chapter.createdAt).toLocaleDateString()}</p>
            <h3 className="mt-1 font-serif text-2xl font-black">{chapter.title}</h3>
            {chapter.note && <p className="mt-2 whitespace-pre-wrap text-slatebody">{chapter.note}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

function EventsDashboard() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", category: "", location: "", startDate: "", endDate: "", visibility: "public", status: "live", coverImageUrl: "" });

  async function load() {
    const data = await api("/api/events");
    setEvents(data.events);
  }
  useEffect(() => { load(); }, []);

  async function createEvent(event) {
    event.preventDefault();
    await api("/api/events", { method: "POST", body: JSON.stringify({ ...form, coverImageUrl: form.coverImageUrl || null }) });
    setForm({ title: "", description: "", category: "", location: "", startDate: "", endDate: "", visibility: "public", status: "live", coverImageUrl: "" });
    load();
  }

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <HeaderBlock eyebrow="Events Mode" title="Travel Events" copy="Discover meetups, photo walks, festivals, and host map-based memory spaces." />
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={createEvent} className="card event-form-card min-w-0 space-y-4 p-5">
            <div>
              <p className="text-sm font-black uppercase text-primary">Event Details</p>
              <h2 className="mt-1 font-serif text-3xl font-black">Host an Event</h2>
              <p className="text-slatebody">Bring people together and collect memories in a shared album.</p>
            </div>
            <input className="field" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className="field" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" type="datetime-local" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <input className="field" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <textarea className="field min-h-24" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input className="field" placeholder="Cover image URL (optional)" value={form.coverImageUrl} onChange={(e) => setForm({ ...form, coverImageUrl: e.target.value })} />
            <button className="btn-primary w-full"><Calendar size={18} /> Create Event</button>
          </form>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {events.map((event) => <EventCard key={event.id} event={event} />)}
            {events.length === 0 && <EmptyCard icon={Calendar} title="No hosted events" copy="Create a festival, party, tour, conference, wedding, or pop-up experience." />}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function EventCard({ event }) {
  return (
    <Link to={`/events/${event.id}`} className="card min-w-0 overflow-hidden p-5 transition hover:-translate-y-1">
      {event.coverImageUrl && <img src={event.coverImageUrl} alt="" className="mb-4 h-32 w-full rounded-lg object-cover" />}
      <p className="text-xs font-black uppercase text-primary">{event.category || "Event"} • {event.status}</p>
      <p className="break-words font-serif text-2xl font-black">{event.title}</p>
      <p className="break-words text-sm text-slatebody">{event.location || "Location TBD"}</p>
      <p className="mt-4 text-sm font-bold text-primary">{event._count?.uploads || 0} memories • {event._count?.zones || 0} zones</p>
    </Link>
  );
}

function EventDetails() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [qr, setQr] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState("map");
  const [mapForm, setMapForm] = useState({ title: "Main Event Map", mapType: "image", imageUrl: "", mapboxStyle: "", centerLat: "", centerLng: "", zoom: "" });
  const [zoneForm, setZoneForm] = useState({ name: "", type: "Photo Hotspot", description: "", x: "", y: "", latitude: "", longitude: "", crowdStatus: "low", displayOrder: 0 });

  async function load() {
    const [eventData, qrData, analyticsData] = await Promise.all([
      api(`/api/events/${eventId}`),
      api(`/api/events/${eventId}/qr`),
      api(`/api/events/${eventId}/analytics`)
    ]);
    setEvent(eventData.event);
    setQr(qrData);
    setAnalytics(analyticsData.analytics);
  }
  useEffect(() => { load(); }, [eventId]);

  async function saveMap(e) {
    e.preventDefault();
    await api(`/api/events/${eventId}/maps`, { method: "POST", body: JSON.stringify(cleanNumbers(mapForm)) });
    setMapForm({ title: "Main Event Map", mapType: "image", imageUrl: "", mapboxStyle: "", centerLat: "", centerLng: "", zoom: "" });
    load();
  }

  async function saveZone(e) {
    e.preventDefault();
    await api(`/api/events/${eventId}/zones`, { method: "POST", body: JSON.stringify(cleanNumbers(zoneForm)) });
    setZoneForm({ name: "", type: "Photo Hotspot", description: "", x: "", y: "", latitude: "", longitude: "", crowdStatus: "low", displayOrder: 0 });
    load();
  }

  async function crowd(zone, crowdStatus) {
    await api(`/api/events/${eventId}/zones/${zone.id}`, { method: "PATCH", body: JSON.stringify({ crowdStatus }) });
    load();
  }

  if (!event) return <Shell><main className="page-shell">Loading...</main></Shell>;

  return (
    <Shell>
      <main className="page-shell space-y-5">
        <div className="card p-5">
          <p className="text-sm font-black uppercase text-primary">Event Experience Platform</p>
          <h1 className="font-serif text-4xl font-black">{event.title}</h1>
          <p className="text-slatebody">{event.location} • {event.status} • {event.visibility}</p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {["map", "editor", "uploads", "qr", "analytics"].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? "btn-primary shrink-0" : "btn-ghost shrink-0"}>{item === "qr" ? "QR Codes" : item[0].toUpperCase() + item.slice(1)}</button>)}
          </div>
        </div>
        {tab === "map" && <EventMap event={event} />}
        {tab === "editor" && <EventEditor event={event} mapForm={mapForm} setMapForm={setMapForm} saveMap={saveMap} zoneForm={zoneForm} setZoneForm={setZoneForm} saveZone={saveZone} crowd={crowd} />}
        {tab === "uploads" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{event.uploads.map((upload) => <MediaCard key={upload.id} upload={upload} onApprove={(id) => api(`/api/uploads/${id}/approve`, { method: "PATCH", body: "{}" }).then(load)} onReject={(id) => api(`/api/uploads/${id}/reject`, { method: "PATCH", body: "{}" }).then(load)} />)}</div>}
        {tab === "qr" && <EventQr event={event} qr={qr} />}
        {tab === "analytics" && <AnalyticsPanel analytics={analytics} />}
      </main>
    </Shell>
  );
}

function Store() {
  const [items, setItems] = useState([]);
  const [storeTab, setStoreTab] = useState('all');
  const [message, setMessage] = useState("");
  const [activeItem, setActiveItem] = useState(currentUser()?.activeStoreItem || null);
  async function load() {
    const [storeData, meData] = await Promise.all([api("/api/store"), api("/api/auth/me")]);
    setItems(storeData.items);
    updateStoredUser(meData.user);
    setActiveItem(meData.user?.activeStoreItem || null);
    applyActiveStoreItem(meData.user?.activeStoreItem || null);
  }
  useEffect(() => { load(); }, []);
  async function buy(item) {
    const data = await api(`/api/store/${item.id}/purchase`, { method: "POST", body: "{}" });
    setMessage(data.message);
    load();
  }
  async function checkout(item, provider) {
    try {
      const data = await api(`/api/store/${item.id}/checkout`, { method: "POST", body: JSON.stringify({ provider }) });
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setMessage(`${provider} checkout created.`);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function activate(item) {
    const data = await api(`/api/store/${item.id}/activate`, { method: "POST", body: "{}" });
    const user = { ...currentUser(), activeStoreItem: data.activeStoreItem };
    updateStoredUser(user);
    setActiveItem(data.activeStoreItem);
    applyActiveStoreItem(data.activeStoreItem);
    setMessage(`${item.name} is now active.`);
  }
  async function clearActive() {
    await api("/api/store/activate", { method: "DELETE" });
    const user = { ...currentUser(), activeStoreItem: null };
    updateStoredUser(user);
    setActiveItem(null);
    applyActiveStoreItem(null);
    setMessage("Active skin cleared.");
  }
  return (
    <Shell>
      <main className="page-shell space-y-6">
        <HeaderBlock eyebrow="Premium Add-ons" title="Skins, frames, themes, QR styles" copy="Purchases are modeled now. Stripe checkout can plug into this store later." />
        {message && <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 font-bold text-primary">{message}</p>}
        {activeItem && <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><p><span className="font-bold">Active:</span> {activeItem.name}</p><button className="btn-ghost" onClick={clearActive}>Clear active</button></div>}
        <div className="flex gap-2 mb-4">
          <button className={storeTab === 'all' ? 'btn-primary' : 'btn-ghost'} onClick={() => setStoreTab('all')}>All</button>
          <button className={storeTab === 'seasonal' ? 'btn-primary' : 'btn-ghost'} onClick={() => setStoreTab('seasonal')}>Seasonal</button>
          <button className={storeTab === 'premium' ? 'btn-primary' : 'btn-ghost'} onClick={() => setStoreTab('premium')}>Premium</button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(() => {
            let shown = items;
            if (storeTab === 'seasonal') shown = items.filter((it) => it.metadata && it.metadata.category === 'seasonal');
            if (storeTab === 'premium') shown = items.filter((it) => it.metadata && it.metadata.isPremium === true);
            return shown.map((item) => (
            <article key={item.id} className="card overflow-hidden p-4">
              <div className="relative h-36 rounded-lg bg-skysoft">
                {item.previewUrl && <img src={assetUrl(item.previewUrl)} alt="" className="h-full w-full rounded-lg object-cover" />}
                {!item.owned && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border border-borderline bg-panel px-2 py-1 text-xs font-bold"><Lock size={13} /> Locked</span>}
              </div>
              <p className="mt-4 text-xs font-black uppercase text-primary">{item.type === "image_skin" ? "photo frame" : item.type.replace("_", " ")}</p>
              <h2 className="font-serif text-2xl font-black">{item.name}</h2>
              <p className="text-sm text-slatebody">{item.description || "Premium TravelShare add-on."}</p>
              <p className="mt-3 text-sm font-bold text-primary">{item.priceCents ? `$${(item.priceCents / 100).toFixed(2)}` : "Included for registered users"}</p>
              {!item.owned && item.priceCents > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2"><button className="btn-primary" onClick={() => checkout(item, "stripe")}>Stripe</button><button className="btn-ghost" onClick={() => checkout(item, "paypal")}>PayPal</button></div>}
              <button className={item.owned ? "btn-ghost mt-4 w-full" : "btn-primary mt-4 w-full"} disabled={item.owned || item.priceCents > 0} onClick={() => buy(item)}>
                <ShoppingBag size={18} /> {item.owned ? "Owned" : item.priceCents ? `Checkout $${(item.priceCents / 100).toFixed(2)}` : "Unlock"}
              </button>
              {item.owned && item.type === "image_skin" && <p className="mt-2 rounded-lg bg-skysoft p-3 text-sm font-bold text-slatebody">Available in album photo frame pickers.</p>}
              {item.owned && item.type !== "image_skin" && <button className={activeItem?.id === item.id ? "btn-primary mt-2 w-full" : "btn-ghost mt-2 w-full"} disabled={activeItem?.id === item.id} onClick={() => activate(item)}>{activeItem?.id === item.id ? "Active" : "Activate"}</button>}
            </article>
            ))
          })()}
          {items.length === 0 && <EmptyCard title="No add-ons yet" copy="Admin can add image skins, frames, themes, premium QR designs, and branded pages." />}
        </div>
      </main>
    </Shell>
  );
}

function Admin() {
  const [tab, setTab] = useState("overview");
  const [data, setData] = useState({});
  const [adForm, setAdForm] = useState({ title: "", description: "", mediaUrl: "", mediaType: "image", linkUrl: "", active: true, priority: 0, displaySeconds: 12, placement: "global", startsAt: "", endsAt: "" });
  const [itemForm, setItemForm] = useState({ name: "", description: "", type: "image_skin", priceCents: 0, previewUrl: "", active: true });

  async function load() {
    const [stats, users, events, guests, moderation, ads, store, analytics, settings] = await Promise.all([
      api("/api/admin/stats"),
      api("/api/admin/users"),
      api("/api/admin/events"),
      api("/api/admin/guests"),
      api("/api/admin/moderation"),
      api("/api/admin/ads"),
      api("/api/admin/store"),
      api("/api/admin/analytics"),
      api("/api/admin/settings")
    ]);
    setData({ stats: stats.stats, users: users.users, events: events.events, guests: guests.guests, uploads: moderation.uploads, ads: ads.ads, store: store.items, analytics: analytics.analytics, settings: settings.settings });
  }
  useEffect(() => { load(); }, []);

  async function role(user, nextRole) {
    await api(`/api/admin/users/${user.id}`, { method: "PATCH", body: JSON.stringify({ role: nextRole }) });
    load();
  }

  async function saveAd(e) {
    e.preventDefault();
    await api("/api/admin/ads", { method: "POST", body: JSON.stringify({ ...adForm, description: adForm.description || null, linkUrl: adForm.linkUrl || null, startsAt: adForm.startsAt ? new Date(adForm.startsAt).toISOString() : null, endsAt: adForm.endsAt ? new Date(adForm.endsAt).toISOString() : null }) });
    setAdForm({ title: "", description: "", mediaUrl: "", mediaType: "image", linkUrl: "", active: true, priority: 0, displaySeconds: 12, placement: "global", startsAt: "", endsAt: "" });
    load();
  }

  async function saveItem(e) {
    e.preventDefault();
    await api("/api/admin/store", { method: "POST", body: JSON.stringify({ ...itemForm, previewUrl: itemForm.previewUrl || null, priceCents: Number(itemForm.priceCents) }) });
    setItemForm({ name: "", description: "", type: "image_skin", priceCents: 0, previewUrl: "", active: true });
    load();
  }

  async function updateStoreItem(itemId, changes) {
    const payload = { ...changes };
    if ("description" in payload) payload.description = payload.description || null;
    if ("previewUrl" in payload) payload.previewUrl = payload.previewUrl || null;
    if ("priceCents" in payload) payload.priceCents = Number(payload.priceCents || 0);
    await api(`/api/admin/store/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });
    load();
  }

  const downloadItems = useMemo(() => (data.store || []).filter((item) => item.type === "download_asset" && item.active), [data.store]);

  async function assignDownloadItem(uploadId, itemId) {
    await api(`/api/admin/uploads/${uploadId}/download-item`, { method: "PATCH", body: JSON.stringify({ itemId }) });
    load();
  }

  return (
    <Shell>
      <main className="page-shell space-y-5">
        <HeaderBlock eyebrow="Business Control Panel" title="Admin dashboard" copy="Manage users, organizers, events, maps, ads, store items, reports, analytics, and platform settings." />
        <div className="hidden lg:flex gap-2 overflow-x-auto">
          {["overview", "users", "organizers", "events", "maps", "memories", "ads", "store", "analytics", "settings"].map((item) => (
            <button key={item} onClick={() => setTab(item)} className={tab === item ? "btn-primary shrink-0" : "btn-ghost shrink-0"}>{item}</button>
          ))}
        </div>
        {tab === "overview" && <StatsGrid stats={data.stats || {}} />}
        {tab === "users" && <UsersTable users={data.users || []} role={role} />}
        {tab === "organizers" && <UsersTable users={(data.users || []).filter((u) => u.role === "organizer")} role={role} />}
        {tab === "events" && <AdminEvents events={data.events || []} />}
        {tab === "maps" && <AdminMaps events={data.events || []} />}
        {tab === "memories" && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{(data.uploads || []).map((upload) => <MediaCard key={upload.id} upload={upload} downloadOptions={downloadItems} currentDownloadItemId={upload.downloadPurchaseItemId} onChangeDownloadItem={assignDownloadItem} onReport={() => api(`/api/admin/moderation/${upload.id}/log`, { method: "POST", body: JSON.stringify({ action: "reviewed" }) })} />)}</div>}
        {tab === "ads" && <AdsAdmin ads={data.ads || []} adForm={adForm} setAdForm={setAdForm} saveAd={saveAd} reload={load} />}
        {tab === "store" && <StoreAdmin items={data.store || []} itemForm={itemForm} setItemForm={setItemForm} saveItem={saveItem} updateItem={updateStoreItem} reload={load} />}
        {tab === "analytics" && <AnalyticsPanel analytics={data.analytics} />}
        {tab === "settings" && <SettingsAdmin settings={data.settings} />}
      </main>
    </Shell>
  );
}

function PublicTripJoin() {
  const { qrToken } = useParams();
  const [trip, setTrip] = useState(null);
  const [guest, setGuest] = useState(null);
  useEffect(() => {
    // fetch trip and persist guest token from server response so the guest can return if cookie wasn't set
    api(`/api/public/qr/${qrToken}`).then((data) => {
      setTrip(data.trip);
      setGuest(data.guest);
      if (data?.guest?.token) setGuestToken(data.guest.token);
    }).catch(() => {});
  }, [qrToken]);
  if (!trip) return <Shell><main className="page-shell">Loading...</main></Shell>;
  return <GuestJoin title={trip.title} subtitle={`${trip.touristFirstName}'s private travel album`} guest={guest} uploadTo={`/qr/${qrToken}/upload`} />;
}

function PublicEventJoin() {
  const { qrToken } = useParams();
  const [event, setEvent] = useState(null);
  const [guest, setGuest] = useState(null);
  useEffect(() => { api(`/api/public/event/${qrToken}`).then((data) => { setEvent(data.event); setGuest(data.guest); }); }, [qrToken]);
  if (!event) return <Shell><main className="page-shell">Loading...</main></Shell>;
  return <GuestJoin title={event.title} subtitle={event.location || "Event memory space"} guest={guest} uploadTo={`/event/${qrToken}/upload`} extra={<EventMap event={event} publicView />} />;
}

function PublicZoneJoin() {
  const { qrToken } = useParams();
  const [zone, setZone] = useState(null);
  const [guest, setGuest] = useState(null);
  useEffect(() => { api(`/api/public/zone/${qrToken}`).then((data) => { setZone(data.zone); setGuest(data.guest); }); }, [qrToken]);
  if (!zone) return <Shell><main className="page-shell">Loading...</main></Shell>;
  return <GuestJoin title={zone.name} subtitle={`${zone.event.title} memory zone`} guest={guest} uploadTo={`/zone/${qrToken}/upload`} />;
}

function GuestJoin({ title, subtitle, guest, uploadTo, extra }) {
  const expired = guest?.expired || (guest?.expiresAt && new Date(guest.expiresAt) <= new Date());
  return (
    <Shell>
      <main className="page-shell grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="card space-y-5 p-6">
          <p className="text-sm font-black uppercase text-primary">Temporary guest access</p>
          <h1 className="font-serif text-4xl font-black">{title}</h1>
          <p className="text-slatebody">{subtitle}</p>
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <p className="font-bold">You can contribute without signing up for 3 days.</p>
            <p className="mt-1 text-sm text-slatebody">Create an account later to keep memories, claim uploads, buy add-ons, or host your own albums/events.</p>
            {guest?.expiresAt && <p className="mt-3 text-sm font-bold text-primary">Guest access expires: {new Date(guest.expiresAt).toLocaleString()}</p>}
          </div>
          {expired ? <Link className="btn-primary w-full" to="/signup">Create account to continue</Link> : <Link className="btn-primary w-full" to={uploadTo}><UploadCloud size={18} /> Upload memory</Link>}
        </section>
        <section className="space-y-4">{extra || <EmptyCard title="Privacy-first upload" copy="Uploads wait for approval unless the owner enables trusted auto-approval." />}</section>
      </main>
    </Shell>
  );
}

function PublicUpload({ type }) {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ caption: "", latitude: "", longitude: "", locationName: "", region: "", locationVisibility: "approximate" });
  const [error, setError] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const locationName = searchParams.get("locationName") || searchParams.get("place");
    if (lat || lng || locationName) {
      setForm((prev) => ({ ...prev, latitude: lat || prev.latitude, longitude: lng || prev.longitude, locationName: locationName || prev.locationName }));
    }
  }, []);
  function useLocation() {
    if (!navigator.geolocation) return setError("Geolocation is not available in this browser.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = String(pos.coords.latitude);
      const lng = String(pos.coords.longitude);
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      // If we have a Mapbox token, reverse-geocode to fill the location name automatically
      try {
        const { reverseGeocode } = await import("./lib/geocode.js");
        const place = await reverseGeocode(lat, lng);
        if (place) setForm((prev) => ({ ...prev, locationName: place }));
      } catch (e) {
        // ignore reverse geocode failures — coords are still set
      } finally {
        setIsLocating(false);
      }
    }, (err) => {
      setIsLocating(false);
      setError("Location permission was not allowed. You can type the place instead.");
    }, { timeout: 10000 });
  }

  async function submit(event) {
    event.preventDefault();
    // Submit the upload to the public upload endpoint
    const body = new FormData();
    body.append("file", file);
    Object.entries(form).forEach(([key, value]) => { if (value !== undefined && value !== null) body.append(key, value); });
    const path = type === "event" ? `/api/public/event/${qrToken}/uploads` : type === "zone" ? `/api/public/zone/${qrToken}/uploads` : `/api/public/qr/${qrToken}/uploads`;
    try {
      setError("");
      setUploading(true);
      await api(path, { method: "POST", body, timeoutMs: 30000 });
      navigate(type === "event" ? `/event/${qrToken}/success` : type === "zone" ? `/zone/${qrToken}/success` : `/qr/${qrToken}/success`);
    } catch (err) {
      if (err?.name === "AbortError") setError("The upload took too long. Try a smaller file or check your connection.");
      else setError(err.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  // Two-step review state: 'form' -> 'review'
  const [step, setStep] = useState("form");

  function startReview(e) {
    e.preventDefault();
    if (!file) return setError("Choose a file before reviewing.");
    setStep("review");
  }

  function backToForm(e) {
    e.preventDefault();
    setStep("form");
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        {step === "form" ? (
          <form onSubmit={startReview} className="card w-full max-w-xl space-y-4 p-5">
            <h1 className="font-serif text-3xl font-black">Upload a memory</h1>
            <input className="field" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0])} disabled={uploading} />
            <input className="field" placeholder="Caption (optional)" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <LocationField value={form.locationName} onChange={(val) => setForm({ ...form, locationName: val })} latitude={form.latitude} longitude={form.longitude} onLatChange={(val) => setForm({ ...form, latitude: val })} onLngChange={(val) => setForm({ ...form, longitude: val })} placeholder="Location name or search" />
              <input className="field" placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <select className="field" value={form.locationVisibility} onChange={(e) => setForm({ ...form, locationVisibility: e.target.value })}>
                <option value="exact">Exact</option>
                <option value="approximate">Approximate</option>
                <option value="hidden">Hidden</option>
              </select>
              <input className="field" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              <input className="field" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
            <button type="button" className="btn-ghost w-full" onClick={useLocation}><MapPin size={18} /> Use device location</button>
            {isLocating && <p className="text-sm text-slatebody mt-2">Detecting device location…</p>}
            {form.latitude && form.longitude && (
              <a className="text-sm text-primary mt-2 inline-block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.latitude + ',' + form.longitude)}`}>
                Open coordinates in Google Maps
              </a>
            )}
            {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
            <div className="flex gap-2">
              <button className="btn-ghost w-full" onClick={(e) => { e.preventDefault(); navigate(-1); }}>Cancel</button>
              <button className="btn-primary w-full" disabled={!file} aria-busy={uploading}><UploadCloud size={18} /> Review</button>
            </div>
          </form>
        ) : (
          <article className="card w-full max-w-xl space-y-4 p-5">
            <h1 className="font-serif text-3xl font-black">Review your upload</h1>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                {file && file.type?.startsWith("image") && <img src={URL.createObjectURL(file)} alt="Preview" className="w-full rounded-lg object-cover" />}
                {file && file.type?.startsWith("video") && <video src={URL.createObjectURL(file)} controls className="w-full rounded-lg object-cover" />}
              </div>
              <div>
                <p className="font-bold">{form.locationName || "No place provided"}</p>
                <p className="text-sm text-slatebody">{form.region || "Region not provided"}</p>
                <p className="mt-2">Accuracy: <strong>{form.locationVisibility}</strong></p>
                {form.latitude && form.longitude && <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.latitude + ',' + form.longitude)}`}>Open location in Google Maps</a>}
                <p className="mt-4 text-slatebody">Caption:</p>
                <p className="mt-1">{form.caption || "—"}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost w-full" onClick={backToForm}>Back</button>
              <button className="btn-primary w-full" onClick={submit} disabled={uploading} aria-busy={uploading}><UploadCloud size={18} /> {uploading ? "Uploading..." : "Confirm & Upload"}</button>
            </div>
          </article>
        )}
        {emptySpot && (
          <div className="absolute right-4 bottom-4 z-40">
            <div className="card p-3 max-w-xs">
              <p className="font-bold">Add memory here</p>
              <p className="text-sm text-slatebody">{emptySpot.place || `${emptySpot.lat.toFixed(5)}, ${emptySpot.lng.toFixed(5)}`}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(`${emptySpot.lat},${emptySpot.lng}`); alert('Coordinates copied to clipboard'); }}>Copy coords</button>
                <button className="btn-primary" onClick={() => { setEmptySpot(null); navigate('/guest'); }}>Start guest upload</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </Shell>
  );
}

function TripUpload() {
  // Authenticated upload page for owners to add memories directly to a trip
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ caption: "", latitude: "", longitude: "", locationName: "", region: "", locationVisibility: "approximate" });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const locationName = searchParams.get("locationName") || searchParams.get("place");
    if (lat || lng || locationName) {
      setForm((prev) => ({ ...prev, latitude: lat || prev.latitude, longitude: lng || prev.longitude, locationName: locationName || prev.locationName }));
    }
    // populate once on mount
  }, []);

  const [isLocating, setIsLocating] = useState(false);
  async function useLocation() {
    if (!navigator.geolocation) return setError("Geolocation is not available in this browser.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = String(pos.coords.latitude);
      const lng = String(pos.coords.longitude);
      setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
      try {
        const { reverseGeocode } = await import("./lib/geocode.js");
        const place = await reverseGeocode(lat, lng);
        if (place) setForm((prev) => ({ ...prev, locationName: place }));
      } catch (e) {
        // ignore
      } finally {
        setIsLocating(false);
      }
    }, (err) => {
      setIsLocating(false);
      setError("Location permission was not allowed. You can type the place instead.");
    }, { timeout: 10000 });
  }

  async function submit(e) {
    e.preventDefault();
    const body = new FormData();
    if (!file) return setError("Choose a file to upload.");
    body.append("file", file);
    Object.entries(form).forEach(([k, v]) => { if (v !== undefined && v !== null) body.append(k, v); });
    try {
      setError("");
      setUploading(true);
      await api(`/api/trips/${tripId}/uploads`, { method: "POST", body, timeoutMs: 30000 });
      navigate(`/trips/${tripId}`);
    } catch (err) {
      if (err?.name === "AbortError") setError("The upload took too long. Try a smaller file or check your connection.");
      else setError(err.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-xl space-y-4 p-5">
          <h1 className="font-serif text-3xl font-black">Upload memory to album</h1>
          <input className="field" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0])} disabled={uploading} />
          <input className="field" placeholder="Caption (optional)" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <LocationField value={form.locationName} onChange={(val) => setForm({ ...form, locationName: val })} latitude={form.latitude} longitude={form.longitude} onLatChange={(val) => setForm({ ...form, latitude: val })} onLngChange={(val) => setForm({ ...form, longitude: val })} placeholder="Location name or search" />
            <input className="field" placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select className="field" value={form.locationVisibility} onChange={(e) => setForm({ ...form, locationVisibility: e.target.value })}>
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="hidden">Hidden</option>
            </select>
            <input className="field" placeholder="Latitude" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
            <input className="field" placeholder="Longitude" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
          </div>
          <button type="button" className="btn-ghost w-full" onClick={useLocation}><MapPin size={18} /> Use device location</button>
          {isLocating && <p className="text-sm text-slatebody mt-2">Detecting device location…</p>}
          {form.latitude && form.longitude && (
            <a className="text-sm text-primary mt-2 inline-block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.latitude + ',' + form.longitude)}`}>
              Open coordinates in Google Maps
            </a>
          )}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-ghost w-full" onClick={(e) => { e.preventDefault(); navigate(-1); }}>Cancel</button>
            <button className="btn-primary w-full" disabled={!file} aria-busy={uploading}><UploadCloud size={18} /> {uploading ? "Uploading..." : "Upload"}</button>
          </div>
        </form>
      </main>
    </Shell>
  );
}

function UploadSuccess() {
  const navigate = useNavigate();
  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="card max-w-lg p-7 text-center">
          <Check className="mx-auto text-trust" size={44} />
          <h1 className="mt-3 font-serif text-3xl font-black">Thanks! Your upload is waiting privately for approval.</h1>
          <p className="mt-2 text-slatebody">Create an account to keep your memories after guest access expires.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button className="btn-ghost" onClick={() => navigate(-1)}>Back to album</button>
            <Link className="btn-primary" to="/signup">Create account</Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function ShareAlbum() {
  const { token } = useParams();
  const [pin, setPin] = useState("");
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState("");
  async function unlock(event) {
    event.preventDefault();
    try {
      const data = await api(`/api/public/share/${token}/unlock`, { method: "POST", body: JSON.stringify({ pin }) });
      setTrip(data.trip);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <Shell>
      <main className="page-shell space-y-5">
        {!trip ? <form onSubmit={unlock} className="card mx-auto max-w-md space-y-4 p-5"><Lock size={36} className="text-primary" /><h1 className="font-serif text-3xl font-black">Private shared album</h1><input className="field" placeholder="PIN if required" value={pin} onChange={(e) => setPin(e.target.value)} />{error && <p className="text-sm font-bold text-reject">{error}</p>}<button className="btn-primary w-full">Open Album</button></form> : <><HeaderBlock eyebrow="Shared Album" title={trip.title} copy={trip.destination} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{trip.uploads.map((upload) => <MediaCard key={upload.id} upload={upload} />)}</div></>}
      </main>
    </Shell>
  );
}

function Settings() {
  const user = currentUser();
  const hasMapboxToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
  const [platformSettings, setPlatformSettings] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: user?.name || "", email: user?.email || "", currentPassword: "", newPassword: "" });
  const [preferences, setPreferences] = useState({ defaultLocationVisibility: "approximate", emailNotifications: true, uploadAlerts: true, promotionalEmails: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api("/api/public/settings"), api("/api/auth/me")])
      .then(([settingsData, meData]) => {
        setPlatformSettings(settingsData.settings);
        updateStoredUser(meData.user);
        setProfileForm((prev) => ({ ...prev, name: meData.user?.name || "", email: meData.user?.email || "" }));
        setPreferences({
          defaultLocationVisibility: meData.user?.preferences?.defaultLocationVisibility || settingsData.settings?.defaultPrivacy || "approximate",
          emailNotifications: meData.user?.preferences?.emailNotifications ?? true,
          uploadAlerts: meData.user?.preferences?.uploadAlerts ?? true,
          promotionalEmails: meData.user?.preferences?.promotionalEmails ?? false
        });
      })
      .catch((err) => setError(err.message || "Settings could not be loaded."));
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const body = {
        name: profileForm.name,
        email: profileForm.email,
        preferences
      };
      if (profileForm.newPassword) {
        body.currentPassword = profileForm.currentPassword;
        body.newPassword = profileForm.newPassword;
      }
      const data = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      updateStoredUser(data.user);
      setProfileForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }));
      setMessage("Settings saved.");
    } catch (err) {
      setError(err.message || "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const privacyOptions = [
    ["exact", "Exact location", "Use precise coordinates when you add memories."],
    ["approximate", "Approximate location", "Recommended. Show the area without exposing the exact spot."],
    ["hidden", "Hidden location", "Hide coordinates by default and keep only broad context."]
  ];

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <HeaderBlock eyebrow="Account" title="Settings" copy="Manage your profile, default privacy, and TravelShare notifications." />
        {message && <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 font-bold text-primary">{message}</p>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}

        <form onSubmit={saveSettings} className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="card space-y-4 p-5">
            <div>
              <p className="text-sm font-black uppercase text-primary">Profile</p>
              <h2 className="font-serif text-2xl font-black">Personal details</h2>
            </div>
            <input className="field" placeholder="Name" value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} />
            <input className="field" type="email" placeholder="Email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" type="password" placeholder="Current password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} />
              <input className="field" type="password" placeholder="New password" value={profileForm.newPassword} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} />
            </div>
            <p className="text-xs text-slatebody">Leave password fields blank to keep your current password.</p>
          </section>

          <section className="card space-y-4 p-5">
            <div>
              <p className="text-sm font-black uppercase text-primary">Privacy</p>
              <h2 className="font-serif text-2xl font-black">Default location accuracy</h2>
            </div>
            <div className="grid gap-3">
              {privacyOptions.map(([value, title, copy]) => (
                <button
                  key={value}
                  type="button"
                  className={`privacy-card ${preferences.defaultLocationVisibility === value ? "privacy-card-active" : ""}`}
                  onClick={() => setPreferences({ ...preferences, defaultLocationVisibility: value })}
                  aria-label={`Use ${title}`}
                >
                  <span className="privacy-dot" />
                  <span>
                    <strong>{title}</strong>
                    <small>{copy}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card space-y-4 p-5 xl:col-span-2">
            <div>
              <p className="text-sm font-black uppercase text-primary">Notifications</p>
              <h2 className="font-serif text-2xl font-black">Email preferences</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["emailNotifications", "Email notifications", "Account and platform updates.", Mail],
                ["uploadAlerts", "Upload alerts", "New memory and moderation activity.", Bell],
                ["promotionalEmails", "Promotional emails", "Product news, offers, and launches.", Megaphone]
              ].map(([key, title, copy, Icon]) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-borderline bg-skysoft p-4">
                  <input
                    className="mt-1 h-5 w-5 shrink-0"
                    type="checkbox"
                    checked={Boolean(preferences[key])}
                    onChange={(e) => setPreferences({ ...preferences, [key]: e.target.checked })}
                    aria-label={title}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-bold"><Icon size={17} /> {title}</span>
                    <span className="mt-1 block text-sm text-slatebody">{copy}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="card space-y-3 p-5 xl:col-span-2">
            <h2 className="font-serif text-2xl font-black">Platform defaults</h2>
            {user?.role === "guest" && (
              <p className="text-slatebody">Guest access lasts {platformSettings?.guestAccessDays ?? "3"} days. Guest data is scheduled for removal {platformSettings?.guestDeletionDays ?? "14"} days after expiry.</p>
            )}
            {!hasMapboxToken && (
              <p className="text-slatebody">Mapbox is the planned map provider. Add <code>VITE_MAPBOX_TOKEN</code> for production map rendering. Current map surfaces provide interactive TravelShare pins, routes, zones, and replay controls without adding a map SDK dependency.</p>
            )}
            <button className="btn-primary" disabled={saving} aria-busy={saving}><Save size={18} /> {saving ? "Saving..." : "Save settings"}</button>
          </section>
        </form>
      </main>
    </Shell>
  );
}

function Legal({ type }) {
  return (
    <Shell>
      <main className="page-shell">
        <article className="card max-w-4xl space-y-4 p-5 sm:p-8">
          <h1 className="font-serif text-4xl font-black">{type === "privacy" ? "Privacy Policy" : "Terms"}</h1>
          <p className="text-slatebody">TravelShare is designed for private, consent-forward travel and event memory sharing. Uploads remain pending until the album owner or organizer approves them.</p>
          <p className="text-slatebody">We do not sell uploaded content or use it for AI training. Location sharing is optional and can be exact, approximate, or hidden.</p>
          <p className="text-slatebody">Report abuse to {supportEmail}.</p>
        </article>
      </main>
    </Shell>
  );
}

function MemoryMap({ data, tripId }) {
  const [selected, setSelected] = useState(null);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const navigate = useNavigate();
  const pins = data?.pins || [];
  const route = data?.route || [];
  const replay = data?.replay || [];
  const activeReplay = replay[replayIndex];
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [filters, setFilters] = useState({ photosOnly: false });
  const [searchText, setSearchText] = useState("");
  const [emptySpot, setEmptySpot] = useState(null);

  async function forwardGeocode(query) {
    const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
    if (!token || !query) return null;
    try {
      const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1`);
      if (!resp.ok) return null;
      const data = await resp.json();
      const feat = data?.features?.[0];
      if (!feat) return null;
      return { lat: feat.center[1], lng: feat.center[0], place: feat.place_name };
    } catch (e) {
      return null;
    }
  }
  async function locateMe() {
    if (!navigator.geolocation) return alert("Geolocation not available in this browser.");
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (mapInstanceRef.current) mapInstanceRef.current.easeTo({ center: [lng, lat], zoom: 14 });
      setIsLocating(false);
    }, () => {
      setIsLocating(false);
      alert("Could not determine device location.");
    }, { timeout: 10000 });
  }

  // Helper: detect if we have geo pins suitable for a real map
  const hasGeoPins = pins.some((p) => p.latitude && p.longitude);

  useEffect(() => {
    if (!mapboxToken || !hasGeoPins) return;

    let cancelled = false;

    async function loadMapbox() {
      setIsMapLoading(true);
      setMapLoadError(false);
      // Load CSS
      if (!document.getElementById("mapbox-gl-css")) {
        const link = document.createElement("link");
        link.id = "mapbox-gl-css";
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v2.20.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      // Load script
      if (!window.mapboxgl) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://api.mapbox.com/mapbox-gl-js/v2.20.0/mapbox-gl.js";
          s.async = true;
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        }).catch(() => {
          // If loading fails, we'll fall back to the DOM map
        });
      }

      if (cancelled) return;
      if (!window.mapboxgl) {
        setMapLoadError(true);
        setIsMapLoading(false);
        return;
      }

      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = mapboxToken;
      const center = (() => {
        const first = pins.find((p) => p.latitude && p.longitude);
        return first ? [first.longitude, first.latitude] : [0, 0];
      })();

      // create map
      mapInstanceRef.current = new mapboxgl.Map({ container: mapRef.current, style: 'https://api.mapbox.com/styles/v1/mapbox/streets-v11', center, zoom: 10 });

      // Build GeoJSON
      const features = pins.filter((p) => p.latitude && p.longitude).map((p) => ({
        type: "Feature",
        properties: { id: p.id, locationName: p.locationName, count: p.count, memories: p.memories },
        geometry: { type: "Point", coordinates: [p.longitude, p.latitude] }
      }));

      mapInstanceRef.current.on("load", () => {
        if (!mapInstanceRef.current) return;
        // Apply filters when building source features
        const filteredFeatures = features.filter((f) => {
          if (!filters.photosOnly) return true;
          const memories = f.properties?.memories || [];
          return memories.some((m) => m?.fileUrl && /\.(jpe?g|png|gif|webp|bmp)$/i.test(m.fileUrl));
        });

        mapInstanceRef.current.addSource("pins", {
          type: "geojson",
          data: { type: "FeatureCollection", features: filteredFeatures },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50
        });

        // cluster circles
        mapInstanceRef.current.addLayer({
          id: "clusters",
          type: "circle",
          source: "pins",
          filter: ["has", "point_count"],
          paint: { "circle-color": "#1E40AF", "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 50, 30] }
        });

        mapInstanceRef.current.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "pins",
          filter: ["has", "point_count"],
          layout: { "text-field": "{point_count}", "text-size": 12 }
        });

        // unclustered points
        mapInstanceRef.current.addLayer({
          id: "unclustered-point",
          type: "circle",
          source: "pins",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-color": "#06B6D4", "circle-radius": 8 }
        });

        // click handlers
        mapInstanceRef.current.on("click", "unclustered-point", (e) => {
          const feature = e.features && e.features[0];
          if (!feature) return;
          const props = feature.properties || {};
          const id = props.id;
          const pin = pins.find((p) => p.id === id);
          if (pin) setSelected(pin);
        });

        mapInstanceRef.current.on("click", "clusters", (e) => {
          const features = mapInstanceRef.current.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          const clusterId = features[0].properties.cluster_id;
          mapInstanceRef.current.getSource("pins").getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            mapInstanceRef.current.easeTo({ center: features[0].geometry.coordinates, zoom });
          });
        });

        // click on the map canvas where no pin exists -> open trip upload (prefill coords) or show empty-spot UI
        mapInstanceRef.current.on("click", (e) => {
          try {
            const featuresAtPoint = mapInstanceRef.current.queryRenderedFeatures(e.point, { layers: ["unclustered-point", "clusters"] });
            if (featuresAtPoint && featuresAtPoint.length > 0) return; // clicked a pin/cluster
          } catch (err) {
            // ignore
          }
          const lat = e.lngLat.lat;
          const lng = e.lngLat.lng;
          if (tripId) {
            (async () => {
              let place = null;
              try { place = await reverseGeocode(lat, lng); } catch (err) { }
              const q = new URLSearchParams();
              q.set("lat", String(lat));
              q.set("lng", String(lng));
              if (place) q.set("locationName", place);
              navigate(`/trips/${tripId}/upload?${q.toString()}`);
            })();
            return;
          }

          // Non-trip view: show an empty-spot panel with quick actions
          (async () => {
            let place = null;
            try { place = await reverseGeocode(lat, lng); } catch (err) { }
            setEmptySpot({ lat, lng, place });
            window.setTimeout(() => { setEmptySpot(null); }, 20_000);
          })();
        });
      });
      // map loaded successfully
      setIsMapLoading(false);
    }

    loadMapbox();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) { /* ignore */ }
        mapInstanceRef.current = null;
      }
    };
  }, [pins, hasGeoPins]);

  return (
    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <MapStatusBanner isMapLoading={isMapLoading} mapLoadError={mapLoadError} />
      <div className="map-surface relative">
        <div className="absolute left-4 top-4 rounded-lg border border-borderline bg-panel/90 p-3 z-10">
          <p className="text-xs font-black uppercase text-primary">Memory Map</p>
          <p className="text-sm text-slatebody">{mapboxToken ? "Mapbox ready" : "Set VITE_MAPBOX_TOKEN for production maps"}</p>
          <div className="mt-2 flex gap-2 items-center">
            <input className="field h-9" placeholder="Search place" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
            <button className="btn-ghost" onClick={async () => {
              if (!searchText) return;
              const res = await forwardGeocode(searchText);
              if (!res) return alert("Place not found");
              if (mapInstanceRef.current) mapInstanceRef.current.easeTo({ center: [res.lng, res.lat], zoom: 13 });
            }}>Go</button>
          </div>
          <div className="mt-2 flex gap-2 items-center">
            <button type="button" className="btn-ghost" onClick={locateMe} aria-busy={isLocating}><MousePointer2 size={14} /> <span className="ml-2">{isLocating ? "Locating…" : "Locate me"}</span></button>
            <label className="ml-2 inline-flex items-center gap-2"><input type="checkbox" checked={filters.photosOnly} onChange={(e) => setFilters((f) => ({ ...f, photosOnly: e.target.checked }))} /> <span className="text-xs">Photos only</span></label>
          </div>
        </div>
        {mapboxToken && hasGeoPins ? (
          <>
            <div ref={mapRef} style={{ position: "absolute", inset: 0 }} />
            {isMapLoading && <div className="absolute inset-0 flex items-center justify-center z-20"><div className="rounded-lg bg-panel/95 p-4">Loading map…</div></div>}
            {mapLoadError && <div className="absolute inset-0 flex items-center justify-center z-20"><div className="rounded-lg bg-red-50 p-4 text-sm font-bold text-reject">Map failed to load — using a simple preview. Set <code>VITE_MAPBOX_TOKEN</code> for full maps.</div></div>}
          </>
        ) : (
          <>
            {pins.filter((pin) => {
              if (!filters.photosOnly) return true;
              const memories = pin.memories || [];
              return memories.some((m) => m?.fileUrl && /\.(jpe?g|png|gif|webp|bmp)$/i.test(m.fileUrl));
            }).map((pin, index) => <button key={pin.id} className="map-pin" style={{ left: `${15 + (index * 19) % 70}%`, top: `${24 + (index * 23) % 58}%` }} onClick={() => setSelected(pin)} title={pin.locationName}><MapPin size={18} /><span>{pin.count}</span></button>)}
            {route.length > 1 && <div className="route-line" />}
          </>
        )}
      </div>
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="font-serif text-2xl font-black">Replay My Journey</h2>
          <input className="mt-4 w-full" type="range" min="0" max={Math.max(0, replay.length - 1)} value={replayIndex} onChange={(e) => setReplayIndex(Number(e.target.value))} />
          <p className="mt-3 text-sm text-slatebody">{activeReplay ? `${activeReplay.locationName} • ${new Date(activeReplay.createdAt).toLocaleString()}` : "Approve memories with locations to replay the trip."}</p>
        </div>
        <div className="card p-5">
          <h2 className="font-serif text-2xl font-black">Most Memorable Places</h2>
          <div className="mt-3 space-y-2">{pins.map((pin) => <button key={pin.id} className="flex w-full items-center justify-between rounded-lg bg-skysoft px-3 py-2 text-left" onClick={() => setSelected(pin)}><span>{pin.locationName}</span><span className="font-bold text-primary">{pin.count}</span></button>)}</div>
        </div>
        {selected && <div className="card p-5"><h2 className="font-serif text-2xl font-black">{selected.locationName}</h2><p className="text-slatebody">{selected.count} memories</p><div className="mt-3 grid grid-cols-3 gap-2">{selected.memories.map((memory) => <img key={memory.id} src={memory.fileUrl} alt="" className="aspect-square rounded-lg object-cover" />)}</div></div>}
      </div>
    </section>
  );
}

function MapStatusBanner({ isMapLoading, mapLoadError }) {
  if (!isMapLoading && !mapLoadError) return null;
  return (
    <div className="absolute left-4 top-20 z-30">
      {isMapLoading && <div className="rounded-lg bg-panel/95 p-2 text-sm">Loading interactive map…</div>}
      {mapLoadError && <div className="rounded-lg bg-red-50 p-2 text-sm font-bold text-reject">Map failed to load — using a simple preview. Set `VITE_MAPBOX_TOKEN` for full maps.</div>}
    </div>
  );
}

function EventMap({ event }) {
  const map = event.maps?.[0];
  const hasMapboxToken = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
  return (
    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="map-surface overflow-hidden">
        {map?.mapboxStyle && !hasMapboxToken && (
          <div className="absolute left-4 top-16 z-30"><div className="rounded-lg bg-red-50 p-2 text-sm font-bold text-reject">Interactive map style configured, but <code>VITE_MAPBOX_TOKEN</code> is not set — using static map preview.</div></div>
        )}
        {map?.imageUrl && <img src={map.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <div className="absolute left-4 top-4 rounded-lg border border-borderline bg-panel/90 p-3"><p className="text-xs font-black uppercase text-primary">Event Map</p><p className="text-sm text-slatebody">{map?.title || "Add a custom map in the editor"}</p></div>
        {event.zones?.map((zone, index) => <Link key={zone.id} className={`zone-pin crowd-${zone.crowdStatus}`} to={`/zone/${zone.qrToken}`} style={{ left: `${zone.x || 18 + (index * 17) % 68}%`, top: `${zone.y || 22 + (index * 21) % 60}%` }}><MapPin size={16} />{zone.name}</Link>)}
      </div>
      <div className="space-y-3">
        {event.zones?.map((zone) => <div key={zone.id} className="card p-4"><p className="font-bold">{zone.name}</p><p className="text-sm text-slatebody">{zone.type} • {zone.crowdStatus} traffic • {zone._count?.uploads || 0} memories</p><Link className="btn-ghost mt-3 w-full" to={`/zone/${zone.qrToken}`}><QrCode size={18} /> Open zone QR page</Link></div>)}
        {(!event.zones || event.zones.length === 0) && <EmptyCard title="No zones yet" copy="Add entrances, stages, vendors, restrooms, VIP, first aid, bars, shuttles, merch, and photo hotspots." />}
      </div>
    </section>
  );
}

function EventEditor({ event, mapForm, setMapForm, saveMap, zoneForm, setZoneForm, saveZone, crowd }) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <form onSubmit={saveMap} className="card space-y-3 p-5">
        <h2 className="font-serif text-2xl font-black">Event Map</h2>
        <input className="field" placeholder="Map title" value={mapForm.title} onChange={(e) => setMapForm({ ...mapForm, title: e.target.value })} />
        <input className="field" placeholder="Custom map image URL" value={mapForm.imageUrl} onChange={(e) => setMapForm({ ...mapForm, imageUrl: e.target.value })} />
        <input className="field" placeholder="Mapbox style URL (optional)" value={mapForm.mapboxStyle} onChange={(e) => setMapForm({ ...mapForm, mapboxStyle: e.target.value })} />
        <button className="btn-primary w-full"><Save size={18} /> Save Map</button>
      </form>
      <form onSubmit={saveZone} className="card space-y-3 p-5">
        <h2 className="font-serif text-2xl font-black">Memory Zone</h2>
        <input className="field" placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" placeholder="Type" value={zoneForm.type} onChange={(e) => setZoneForm({ ...zoneForm, type: e.target.value })} />
          <select className="field" value={zoneForm.crowdStatus} onChange={(e) => setZoneForm({ ...zoneForm, crowdStatus: e.target.value })}><option value="low">Low traffic</option><option value="moderate">Moderate traffic</option><option value="high">High traffic</option></select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" placeholder="Map X %" value={zoneForm.x} onChange={(e) => setZoneForm({ ...zoneForm, x: e.target.value })} />
          <input className="field" placeholder="Map Y %" value={zoneForm.y} onChange={(e) => setZoneForm({ ...zoneForm, y: e.target.value })} />
        </div>
        <textarea className="field min-h-20" placeholder="Description" value={zoneForm.description} onChange={(e) => setZoneForm({ ...zoneForm, description: e.target.value })} />
        <button className="btn-primary w-full"><QrCode size={18} /> Add Zone + QR</button>
      </form>
      <div className="xl:col-span-2 grid gap-3 md:grid-cols-3">
        {event.zones.map((zone) => <div key={zone.id} className="card p-4"><p className="font-bold">{zone.name}</p><p className="text-sm text-slatebody">{zone.crowdStatus} traffic</p><div className="mt-3 flex gap-2"><button className="btn-ghost" onClick={() => crowd(zone, "low")}>Low</button><button className="btn-ghost" onClick={() => crowd(zone, "moderate")}>Med</button><button className="btn-ghost" onClick={() => crowd(zone, "high")}>High</button></div></div>)}
      </div>
    </section>
  );
}

function EventQr({ event, qr }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="card p-5">{qr?.dataUrl && <img src={qr.dataUrl} alt="Event QR code" className="mx-auto aspect-square w-full max-w-xs rounded-lg bg-qrwhite object-contain" />}<a className="btn-primary mt-4 w-full" href={qr?.scanUrl} target="_blank" rel="noreferrer"><QrCode size={18} /> Open event guest page</a></div>
      <div className="grid gap-3 sm:grid-cols-2">{event.zones.map((zone) => <Link key={zone.id} className="card p-4" to={`/zone/${zone.qrToken}`}><p className="font-bold">{zone.name}</p><p className="text-sm text-slatebody">Zone-specific QR upload link</p></Link>)}</div>
    </section>
  );
}

function HeaderBlock({ eyebrow, title, copy }) {
  return <section><p className="text-sm font-black uppercase text-primary">{eyebrow}</p><h1 className="mt-2 break-words font-serif text-4xl font-black">{title}</h1>{copy && <p className="mt-2 max-w-3xl text-slatebody">{copy}</p>}</section>;
}

function EmptyCard({ title, copy, icon: Icon = Sparkles }) {
  return (
    <div className="empty-card card p-8 text-center">
      <div className="empty-icon mx-auto"><Icon size={34} /></div>
      <p className="mt-5 font-serif text-2xl font-black">{title}</p>
      <p className="mt-2 text-slatebody">{copy}</p>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="card p-5"><p className="text-sm font-bold capitalize text-slatebody">{label}</p><p className="text-4xl font-black text-primary">{value ?? 0}</p></div>;
}

function StatsGrid({ stats }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(stats || {}).map(([label, value]) => <Stat key={label} label={label} value={value} />)}</div>;
}

function MediaGrid({ uploads, selected, setSelected, action, skinOptions, onApplySkin }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{uploads.map((upload) => <MediaCard key={upload.id} upload={upload} selected={selected.includes(upload.id)} onSelect={(id, checked) => setSelected((prev) => checked ? [...prev, id] : prev.filter((value) => value !== id))} onApprove={(id) => action(id, "approve")} onReject={(id) => action(id, "reject")} onReport={(id) => action(id, "report")} skinOptions={skinOptions} onApplySkin={onApplySkin} />)}</div>;
}

function QrPanel({ qr, trip, updateQr, createShareLink }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="card p-5"><img src={qr.dataUrl} alt="Trip QR code" className="mx-auto aspect-square w-full max-w-xs rounded-lg bg-qrwhite object-contain" /><a className="btn-primary mt-4 w-full" href={qr.scanUrl} target="_blank" rel="noreferrer"><QrCode size={18} /> Open guest page</a></div>
      <div className="card min-w-0 space-y-3 p-5"><h2 className="font-serif text-2xl font-black">QR Settings</h2><p className="break-words text-sm text-slatebody">{qr.scanUrl}</p><div className="grid gap-2 sm:grid-cols-2"><button className="btn-ghost" onClick={() => updateQr({ qrActive: !trip.qrActive })}>{trip.qrActive ? "Pause QR" : "Resume QR"}</button><button className="btn-ghost" onClick={() => updateQr({ regenerate: true })}><RefreshCw size={18} /> Regenerate</button><button className="btn-danger" onClick={() => updateQr({ qrActive: false, qrMode: "revoked" })}>Revoke</button><button className="btn-teal" onClick={createShareLink}><Copy size={18} /> Private album link</button><button className="btn-ghost" onClick={() => updateQr({ qrMode: "approval_required" })}>Approval required</button><button className="btn-ghost" onClick={() => updateQr({ qrMode: "family_safe" })}>Family safe</button></div></div>
    </section>
  );
}

function UsersTable({ users, role }) {
  return <div className="space-y-3">{users.map((user) => <div key={user.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{user.name}</p><p className="text-sm text-slatebody">{user.email} • {user.role}</p></div><select className="field sm:w-56" value={user.role} onChange={(e) => role(user, e.target.value)}><option value="tourist">tourist</option><option value="organizer">organizer</option><option value="platform_admin">platform admin</option><option value="guest">guest</option></select></div>)}</div>;
}

function AdminEvents({ events }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{events.map((event) => <div key={event.id} className="card p-4"><p className="font-serif text-2xl font-black">{event.title}</p><p className="text-sm text-slatebody">{event.organizer?.email || "No organizer"} • {event.status}</p><p className="mt-3 text-primary">{event._count.uploads} uploads • {event._count.zones} zones</p></div>)}</div>;
}

function AdminMaps({ events }) {
  return <div className="space-y-3">{events.map((event) => <div key={event.id} className="card p-4"><p className="font-bold">{event.title}</p><p className="text-sm text-slatebody">Manage maps and zones from the event detail page.</p><Link className="btn-primary mt-3" to={`/events/${event.id}`}><MapPin size={18} /> Open map tools</Link></div>)}</div>;
}

function AdsAdmin({ ads, adForm, setAdForm, saveAd, reload }) {
  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={saveAd} className="card space-y-3 p-5"><h2 className="font-serif text-2xl font-black">Create Ad</h2><input className="field" placeholder="Title" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} /><textarea className="field min-h-20" placeholder="Description" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} /><input className="field" placeholder="Media URL" value={adForm.mediaUrl} onChange={(e) => setAdForm({ ...adForm, mediaUrl: e.target.value })} /><input className="field" placeholder="Click URL" value={adForm.linkUrl} onChange={(e) => setAdForm({ ...adForm, linkUrl: e.target.value })} /><div className="grid gap-3 sm:grid-cols-2"><select className="field" value={adForm.mediaType} onChange={(e) => setAdForm({ ...adForm, mediaType: e.target.value })}><option value="image">Image</option><option value="video">Video</option></select><select className="field" value={adForm.placement} onChange={(e) => setAdForm({ ...adForm, placement: e.target.value })}><option value="global">Global</option><option value="tourist">Tourist</option><option value="event">Event</option><option value="guest">Guest</option><option value="map">Map</option><option value="upload_success">Upload Success</option></select></div><button className="btn-primary w-full"><Save size={18} /> Save Ad</button></form>
      <div className="space-y-3">{ads.map((ad) => <div key={ad.id} className="card p-4"><p className="font-bold">{ad.title}</p><p className="text-sm text-slatebody">{ad.placement} • {ad.active ? "active" : "paused"}</p><button className="btn-ghost mt-3" onClick={() => api(`/api/admin/ads/${ad.id}`, { method: "PATCH", body: JSON.stringify({ active: !ad.active }) }).then(reload)}>{ad.active ? "Pause" : "Activate"}</button></div>)}</div>
    </section>
  );
}

function StoreAdmin({ items, itemForm, setItemForm, saveItem, updateItem, reload }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const storeTypes = [
    ["image_skin", "Image skin"],
    ["photo_frame", "Photo frame"],
    ["album_theme", "Album theme"],
    ["event_theme", "Event theme"],
    ["download_asset", "Download asset"],
    ["premium_qr", "Premium QR"],
    ["branded_page", "Branded page"],
    ["ad_free", "Ad-free viewing"]
  ];

  function edit(item) {
    setEditingId(item.id);
    setDraft({
      name: item.name,
      description: item.description || "",
      type: item.type,
      priceCents: item.priceCents || 0,
      previewUrl: item.previewUrl || "",
      active: item.active
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    await updateItem(editingId, draft);
    setEditingId(null);
    setDraft(null);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={saveItem} className="card space-y-3 p-5">
        <h2 className="font-serif text-2xl font-black">Create Store Item</h2>
        <input className="field" placeholder="Name" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
        <textarea className="field min-h-20" placeholder="Description" value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
        <select className="field" value={itemForm.type} onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}>
          {storeTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input className="field" type="number" min="0" placeholder="Price cents" value={itemForm.priceCents} onChange={(e) => setItemForm({ ...itemForm, priceCents: e.target.value })} />
        <input className="field" placeholder="Preview URL" value={itemForm.previewUrl} onChange={(e) => setItemForm({ ...itemForm, previewUrl: e.target.value })} />
        <button className="btn-primary w-full"><CircleDollarSign size={18} /> Save Add-on</button>
      </form>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="card p-4">
            {editingId === item.id && draft ? (
              <form onSubmit={saveEdit} className="space-y-3">
                <input className="field" placeholder="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                <textarea className="field min-h-20" placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                <select className="field" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {storeTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input className="field" type="number" min="0" placeholder="Price cents" value={draft.priceCents} onChange={(e) => setDraft({ ...draft, priceCents: e.target.value })} />
                <input className="field" placeholder="Preview URL" value={draft.previewUrl} onChange={(e) => setDraft({ ...draft, previewUrl: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary" type="submit"><Save size={18} /> Save</button>
                  <button className="btn-ghost" type="button" onClick={() => { setEditingId(null); setDraft(null); }}>Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  {item.previewUrl && <div className="w-20 h-12 overflow-hidden rounded bg-skysoft"><img src={item.previewUrl} alt="preview" className="w-full h-full object-cover" /></div>}
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm text-slatebody">{item.type} • ${(item.priceCents / 100).toFixed(2)} • {item.active ? "active" : "paused"}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-ghost" onClick={() => edit(item)}>Edit</button>
                  <button className="btn-ghost" onClick={() => updateItem(item.id, { active: !item.active })}>{item.active ? "Pause" : "Activate"}</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AnalyticsPanel({ analytics }) {
  return <section className="grid gap-5 lg:grid-cols-2"><div className="card p-5"><h2 className="font-serif text-2xl font-black"><Flame className="inline text-primary" /> Popular Zones</h2><div className="mt-3 space-y-2">{(analytics?.popularZones || []).map((zone, index) => <p key={`${zone.zone}-${index}`} className="rounded-lg bg-skysoft p-3">{zone.event ? `${zone.event} • ` : ""}{zone.zone || zone.name}: <span className="text-primary">{zone.count}</span> memories</p>)}</div></div><div className="card p-5"><h2 className="font-serif text-2xl font-black"><BarChart3 className="inline text-primary" /> Map Hotspots</h2><div className="mt-3 space-y-2">{(analytics?.mapHotspots || []).map((spot) => <p key={spot.locationName} className="rounded-lg bg-skysoft p-3">{spot.locationName}: <span className="text-primary">{spot.count}</span></p>)}</div></div></section>;
}

function SettingsAdmin({ settings }) {
  const [form, setForm] = useState({
    guestAccessDays: settings?.guestAccessDays ?? 3,
    guestDeletionDays: settings?.guestDeletionDays ?? 14,
    maxUploadSizeMb: settings?.maxUploadSizeMb ?? 50,
    defaultPrivacy: settings?.defaultPrivacy || "approximate",
    moderationProvider: settings?.moderationProvider || "disabled",
    mapProvider: settings?.mapProvider || "mapbox",
    paymentProvider: settings?.paymentProvider || "planned_stripe",
    backgroundVideoUrl: settings?.backgroundVideoUrl || "/videos/come-to-barbados.mp4"
  });
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm({
      guestAccessDays: settings?.guestAccessDays ?? 3,
      guestDeletionDays: settings?.guestDeletionDays ?? 14,
      maxUploadSizeMb: settings?.maxUploadSizeMb ?? 50,
      defaultPrivacy: settings?.defaultPrivacy || "approximate",
      moderationProvider: settings?.moderationProvider || "disabled",
      mapProvider: settings?.mapProvider || "mapbox",
      paymentProvider: settings?.paymentProvider || "planned_stripe",
      backgroundVideoUrl: settings?.backgroundVideoUrl || "/videos/come-to-barbados.mp4"
    });
  }, [settings]);

  async function save(event) {
    event.preventDefault();
    const payload = {
      ...form,
      guestAccessDays: Number(form.guestAccessDays || 3),
      guestDeletionDays: Number(form.guestDeletionDays || 14),
      maxUploadSizeMb: Number(form.maxUploadSizeMb || 50)
    };
    await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(payload) });
    setMessage("Platform settings updated.");
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="card space-y-5 p-5">
        <div>
          <p className="text-sm font-black uppercase text-primary">Platform Settings</p>
          <h2 className="font-serif text-2xl font-black">Defaults and providers</h2>
          <p className="text-sm text-slatebody">These values are stored in platform settings and fall back to environment variables when unset.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-bold">Guest access days</span>
            <input className="field" type="number" min="1" value={form.guestAccessDays} onChange={(e) => setForm({ ...form, guestAccessDays: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold">Guest deletion days</span>
            <input className="field" type="number" min="1" value={form.guestDeletionDays} onChange={(e) => setForm({ ...form, guestDeletionDays: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold">Max upload size MB</span>
            <input className="field" type="number" min="1" value={form.maxUploadSizeMb} onChange={(e) => setForm({ ...form, maxUploadSizeMb: e.target.value })} />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-bold">Default privacy</span>
            <select className="field" value={form.defaultPrivacy} onChange={(e) => setForm({ ...form, defaultPrivacy: e.target.value })}>
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold">Map provider</span>
            <select className="field" value={form.mapProvider} onChange={(e) => setForm({ ...form, mapProvider: e.target.value })}>
              <option value="mapbox">Mapbox</option>
              <option value="dom_fallback">DOM fallback</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold">Moderation provider</span>
            <input className="field" value={form.moderationProvider} onChange={(e) => setForm({ ...form, moderationProvider: e.target.value })} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-bold">Payment provider</span>
            <input className="field" value={form.paymentProvider} onChange={(e) => setForm({ ...form, paymentProvider: e.target.value })} />
          </label>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-bold">Public background video URL</span>
          <input className="field" value={form.backgroundVideoUrl} onChange={(e) => setForm({ ...form, backgroundVideoUrl: e.target.value })} />
        </label>
        {message && <p className="text-sm font-bold text-primary">{message}</p>}
        <button className="btn-primary"><Save size={18} /> Save Platform Settings</button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Object.entries(form || {}).map(([key, value]) => <div key={key} className="card p-5"><p className="text-sm font-bold text-slatebody">{key}</p><p className="mt-2 break-words text-2xl font-black text-primary">{String(value)}</p></div>)}
      </div>
    </div>
  );
}

function cleanNumbers(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, value === "" ? null : value]));
}

function DiscoverEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api("/api/public/events")
      .then((data) => {
        if (!mounted) return;
        setEvents(data.events || []);
      })
      .catch(() => {})
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <HeaderBlock eyebrow="Discover" title="Public Events" copy="Browse upcoming and recent public events and open their QR pages to contribute memories." />
        </section>

        <section className="grid gap-4">
          {loading ? (
            <div className="card p-5">Loading events…</div>
          ) : events.length === 0 ? (
            <div className="card p-5">No public events found.</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="card p-5">
                <Link to={`/event/${ev.qrToken}`} className="block">
                  <p className="font-serif text-2xl font-black">{ev.title}</p>
                  <p className="text-slatebody">{ev.location || "Public event"} • {ev._count?.uploads || 0} memories</p>
                  <p className="mt-2 text-primary">Open event QR page</p>
                </Link>
              </div>
            ))
          )}
        </section>
      </main>
    </Shell>
  );
}

export default function App() {
  return (
    <>
      <SessionSync />
      <ScreenshotGuard />
      <AppBackground />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/guest" element={<GuestMode />} />
        <Route path="/discover" element={<DiscoverEvents />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/tourist" element={<PrivateRoute><TouristDashboard /></PrivateRoute>} />
        <Route path="/trips/:tripId" element={<PrivateRoute><TripDetails /></PrivateRoute>} />
        <Route path="/trips/:tripId/upload" element={<PrivateRoute><TripUpload /></PrivateRoute>} />
        <Route path="/events" element={<PrivateRoute roles={["organizer", "platform_admin"]}><EventsDashboard /></PrivateRoute>} />
        <Route path="/events/:eventId" element={<PrivateRoute roles={["organizer", "platform_admin"]}><EventDetails /></PrivateRoute>} />
        <Route path="/store" element={<PrivateRoute><Store /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute roles={["platform_admin"]}><Admin /></PrivateRoute>} />
        <Route path="/qr/:qrToken" element={<PublicTripJoin />} />
        <Route path="/qr/:qrToken/upload" element={<PublicUpload type="trip" />} />
        <Route path="/qr/:qrToken/success" element={<UploadSuccess />} />
        <Route path="/event/:qrToken" element={<PublicEventJoin />} />
        <Route path="/event/:qrToken/upload" element={<PublicUpload type="event" />} />
        <Route path="/event/:qrToken/success" element={<UploadSuccess />} />
        <Route path="/zone/:qrToken" element={<PublicZoneJoin />} />
        <Route path="/zone/:qrToken/upload" element={<PublicUpload type="zone" />} />
        <Route path="/zone/:qrToken/success" element={<UploadSuccess />} />
        <Route path="/share/:token" element={<ShareAlbum />} />
        <Route path="/privacy" element={<Legal type="privacy" />} />
        <Route path="/terms" element={<Legal type="terms" />} />
        <Route path="/map" element={<MapView />} />
      </Routes>
      <BottomAd />
    </>
  );
}
