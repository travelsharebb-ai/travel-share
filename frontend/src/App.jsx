import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Calendar, Check, Copy, Eye, EyeOff, ExternalLink, Lock, Megaphone, QrCode, RefreshCw, Save, ShieldCheck, Trash2, UploadCloud, Waves, X } from "lucide-react";
import Shell from "./components/Shell";
import MediaCard from "./components/MediaCard";
import { api, currentUser, setSession } from "./lib/api";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";

function PrivateRoute({ children }) {
  return currentUser() ? children : <Navigate to="/login" replace />;
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

  const content = (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
      <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-skysoft sm:h-24 sm:w-40">
        {ad.mediaType === "video" ? (
          <video src={ad.mediaUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" />
        ) : (
          <img src={ad.mediaUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs font-black uppercase text-primary"><Megaphone size={15} /> Sponsored</p>
        <p className="break-words text-base font-black text-navy">{ad.title}</p>
        {ad.description && <p className="line-clamp-2 break-words text-sm text-slatebody">{ad.description}</p>}
      </div>
      {ad.linkUrl && <ExternalLink className="hidden shrink-0 text-primary sm:block" size={20} />}
    </div>
  );

  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 px-3 pb-3 transition-all duration-700 ease-out sm:px-5 ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}`}>
      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-borderline bg-white p-3 shadow-soft">
        <button className="absolute right-5 top-2 rounded-full bg-white p-1 text-report shadow" aria-label="Close ad" onClick={() => setVisible(false)}>
          <X size={17} />
        </button>
        {ad.linkUrl ? <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="block pr-6">{content}</a> : <div className="pr-6">{content}</div>}
      </div>
    </div>
  );
}

function Landing() {
  return (
    <Shell>
      <main className="overflow-hidden">
        <section className="relative bg-sand">
          <div className="page-shell grid min-h-[calc(100vh-74px)] content-center gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="min-w-0 space-y-6">
              <p className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-primary shadow-sm">Privacy-first travel sharing</p>
              <h1 className="max-w-3xl break-words text-4xl font-black leading-tight text-navy sm:text-5xl lg:text-6xl">Travel Share</h1>
              <p className="max-w-2xl text-lg leading-8 text-slatebody">
                Create a trip album, share a personal QR code, and privately review every photo or video before it appears.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link className="btn-primary" to="/signup"><QrCode size={19} /> Create my QR</Link>
                <Link className="btn-ghost" to="/privacy"><ShieldCheck size={19} /> Privacy promise</Link>
              </div>
            </div>
            <div className="card min-w-0 overflow-hidden p-5">
              <div className="rounded-2xl bg-gradient-to-br from-primary via-ocean to-trust p-5 text-white">
                <Waves size={42} />
                <p className="mt-16 text-2xl font-black">Beach candids, tour moments, sunset snaps.</p>
                <p className="mt-3 text-white/90">Every upload waits in your approval queue first.</p>
              </div>
            </div>
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
      const data = await api(`/api/auth/${isSignup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      setSession(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="text-2xl font-black">{isSignup ? "Create your Travel Share account" : "Welcome back"}</h1>
          {isSignup && <input className="field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
          <input className="field" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="relative">
            <input
              className="field pr-14"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-report hover:bg-skysoft"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <p className="break-words rounded-2xl bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <button className="btn-primary w-full" type="submit">{isSignup ? "Sign up" : "Login"}</button>
          {!isSignup && <Link className="block text-center text-sm font-bold text-primary" to="/forgot-password">Forgot password?</Link>}
        </form>
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
      const data = await api("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="text-2xl font-black">Reset your password</h1>
          <p className="text-sm text-slatebody">Enter your account email. We’ll send a verification link before any password can be changed.</p>
          <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          {message && <p className="break-words rounded-2xl bg-rose-50 p-3 text-sm font-bold text-trust">{message}</p>}
          {error && <p className="break-words rounded-2xl bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <button className="btn-primary w-full" type="submit">Send reset link</button>
          <Link className="block text-center text-sm font-bold text-primary" to="/login">Back to login</Link>
        </form>
      </main>
    </Shell>
  );
}

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [valid, setValid] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/api/auth/reset-password/${token}`)
      .then((data) => setValid(data.valid))
      .catch(() => setValid(false));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const data = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setMessage(data.message);
      window.setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-md space-y-4 p-5 sm:p-7">
          <h1 className="text-2xl font-black">Choose a new password</h1>
          {valid === null && <p className="text-sm text-slatebody">Checking reset link...</p>}
          {valid === false && <p className="break-words rounded-2xl bg-red-50 p-3 text-sm font-bold text-reject">This reset link is invalid or expired.</p>}
          {valid && (
            <>
              <div className="relative">
                <input
                  className="field pr-14"
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-report hover:bg-skysoft"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {message && <p className="break-words rounded-2xl bg-rose-50 p-3 text-sm font-bold text-trust">{message}</p>}
              {error && <p className="break-words rounded-2xl bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
              <button className="btn-primary w-full" type="submit">Change password</button>
            </>
          )}
          <Link className="block text-center text-sm font-bold text-primary" to="/login">Back to login</Link>
        </form>
      </main>
    </Shell>
  );
}

function Dashboard() {
  const [trips, setTrips] = useState([]);
  const [form, setForm] = useState({ title: "", destination: "", startDate: "", endDate: "" });

  async function load() {
    const data = await api("/api/trips");
    setTrips(data.trips);
  }

  useEffect(() => { load(); }, []);

  async function createTrip(event) {
    event.preventDefault();
    await api("/api/trips", { method: "POST", body: JSON.stringify(form) });
    setForm({ title: "", destination: "", startDate: "", endDate: "" });
    load();
  }

  return (
    <Shell>
      <main className="page-shell space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-black">Tourist Dashboard</h1>
            <p className="text-slatebody">New upload waiting! Review candid memories before they enter your album.</p>
          </div>
        </div>
        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <form onSubmit={createTrip} className="card min-w-0 space-y-3 p-5">
            <h2 className="text-xl font-black">Create trip / album</h2>
            <input className="field" placeholder="Trip title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="field" placeholder="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="field" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <input className="field" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <button className="btn-primary w-full"><Calendar size={18} /> Create Album</button>
          </form>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <Link key={trip.id} to={`/trips/${trip.id}`} className="card min-w-0 p-5 transition hover:-translate-y-1">
                <p className="break-words text-xl font-black">{trip.title}</p>
                <p className="break-words text-slatebody">{trip.destination}</p>
                <p className="mt-4 text-sm font-bold text-primary">{trip._count?.uploads || 0} memories</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Shell>
  );
}

function TripDetails() {
  const { tripId } = useParams();
  const [trip, setTrip] = useState(null);
  const [tab, setTab] = useState("pending");
  const [uploads, setUploads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [qr, setQr] = useState(null);
  const pendingCount = uploads.filter((u) => u.status === "pending").length;

  async function load() {
    const [tripData, uploadsData, qrData] = await Promise.all([
      api(`/api/trips/${tripId}`),
      api(`/api/trips/${tripId}/uploads`),
      api(`/api/trips/${tripId}/qr`)
    ]);
    setTrip(tripData.trip);
    setUploads(uploadsData.uploads);
    setQr(qrData);
  }

  useEffect(() => { load(); }, [tripId]);

  async function action(id, name) {
    await api(`/api/uploads/${id}/${name}`, {
      method: "PATCH",
      body: name === "report" ? JSON.stringify({ reportReason: "Reported by album owner", blockUploader: false }) : "{}"
    });
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

  const visible = useMemo(() => uploads.filter((u) => tab === "pending" ? u.status === "pending" : u.status === "approved"), [uploads, tab]);

  if (!trip) return <Shell><main className="page-shell">Loading...</main></Shell>;

  return (
    <Shell>
      <main className="page-shell space-y-5">
        <div className="card min-w-0 p-5">
          <h1 className="break-words text-3xl font-black">{tab === "pending" ? `Pending Memories (${pendingCount} new)` : trip.title}</h1>
          <p className="break-words text-slatebody">{trip.destination}</p>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {["pending", "approved", "qr", "stats"].map((item) => (
              <button key={item} onClick={() => setTab(item)} className={tab === item ? "btn-primary shrink-0" : "btn-ghost shrink-0"}>
                {item === "qr" ? "QR Settings" : item === "approved" ? "Approved Album" : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {tab === "pending" && (
          <section className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button className="btn-ghost" onClick={() => setSelected(visible.map((u) => u.id))}>Select All</button>
              <button className="btn-green" disabled={!selected.length} onClick={() => bulk("approve")}><Check size={18} /> Approve Selected</button>
              <button className="btn-danger" disabled={!selected.length} onClick={() => bulk("reject")}>Reject Selected</button>
            </div>
            {visible.length === 0 ? <EmptyPending /> : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((upload) => (
                  <MediaCard
                    key={upload.id}
                    upload={upload}
                    selected={selected.includes(upload.id)}
                    onSelect={(id, checked) => setSelected((prev) => checked ? [...prev, id] : prev.filter((value) => value !== id))}
                    onApprove={(id) => action(id, "approve")}
                    onReject={(id) => action(id, "reject")}
                    onReport={(id) => action(id, "report")}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "approved" && (
          visible.length === 0 ? <EmptyApproved /> : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((upload) => <MediaCard key={upload.id} upload={upload} onDelete={(id) => api(`/api/uploads/${id}`, { method: "DELETE" }).then(load)} />)}
            </div>
          )
        )}

        {tab === "qr" && qr && (
          <section className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="card p-5">
              <img src={qr.dataUrl} alt="Trip QR code" className="mx-auto aspect-square w-full max-w-xs rounded-2xl bg-white object-contain" />
              <a className="btn-primary mt-4 w-full" href={qr.scanUrl} target="_blank" rel="noreferrer"><QrCode size={18} /> Open QR landing page</a>
            </div>
            <div className="card min-w-0 space-y-3 p-5">
              <h2 className="text-xl font-black">QR Settings</h2>
              <p className="break-words text-sm text-slatebody">{qr.scanUrl}</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button className="btn-ghost" onClick={() => updateQr({ qrActive: !trip.qrActive })}>{trip.qrActive ? "Pause QR" : "Resume QR"}</button>
                <button className="btn-ghost" onClick={() => updateQr({ regenerate: true })}><RefreshCw size={18} /> Regenerate</button>
                <button className="btn-danger" onClick={() => updateQr({ qrActive: false, qrMode: "revoked" })}>Revoke</button>
                <button className="btn-teal" onClick={createShareLink}><Copy size={18} /> Create private album link</button>
              </div>
            </div>
          </section>
        )}

        {tab === "stats" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Pending" value={pendingCount} />
            <Stat label="Approved" value={uploads.filter((u) => u.status === "approved").length} />
            <Stat label="Reported" value={uploads.filter((u) => u.status === "reported").length} />
          </div>
        )}
      </main>
    </Shell>
  );
}

function Stat({ label, value }) {
  return <div className="card p-5"><p className="text-sm font-bold text-slatebody">{label}</p><p className="text-4xl font-black text-primary">{value}</p></div>;
}

function EmptyPending() {
  return (
    <div className="card p-6 text-center">
      <p className="text-2xl font-black">No new uploads yet... Keep exploring!</p>
      <p className="mt-2 text-slatebody">Your QR is active — share it at the beach, on tours, or with new friends.</p>
    </div>
  );
}

function EmptyApproved() {
  return (
    <div className="card p-6 text-center">
      <p className="text-2xl font-black">Your album is ready for magic!</p>
      <p className="mt-2 text-slatebody">Approved shots appear here. Share the link with family or export later.</p>
    </div>
  );
}

function QrLanding() {
  const { qrToken } = useParams();
  const [trip, setTrip] = useState(null);

  useEffect(() => { api(`/api/public/qr/${qrToken}`).then((data) => setTrip(data.trip)); }, [qrToken]);
  if (!trip) return <Shell><main className="page-shell">Loading...</main></Shell>;

  return (
    <Shell>
      <main className="page-shell flex min-h-[80vh] items-center justify-center">
        <section className="card max-w-3xl space-y-5 p-5 sm:p-8">
          <p className="text-sm font-black uppercase text-primary">Upload a Photo/Video to {trip.touristFirstName}’s Private Travel Album</p>
          <h1 className="break-words text-3xl font-black">You’re about to upload to {trip.touristFirstName}’s private travel memories!</h1>
          <div className="rounded-2xl bg-skysoft p-4">
            <p className="font-black">This is a safe, one-way share:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slatebody">
              <li>They review every upload before anything is saved.</li>
              <li>You keep full ownership of your photo/video.</li>
              <li>We never sell or use your content for AI training.</li>
            </ul>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Private & Controlled", `Only ${trip.touristFirstName} sees pending uploads and decides what stays.`],
              ["No Location Data Shared", "We automatically strip GPS, timestamps, and device info."],
              ["Easy to Cancel", "Tap back if you change your mind."],
              ["Why this exists", "Travelers love surprise candids from strangers. This makes it effortless and respectful."]
            ].map(([title, copy]) => <div className="rounded-2xl border border-borderline bg-white p-4" key={title}><p className="font-black">{title}</p><p className="text-sm text-slatebody">{copy}</p></div>)}
          </div>
          <Link className="btn-primary w-full" to={`/qr/${qrToken}/upload`}><UploadCloud size={18} /> Continue to Upload</Link>
          <p className="break-words text-center text-xs text-slatebody">Powered by Travel Share • Privacy-first travel sharing • Questions? {supportEmail}</p>
        </section>
      </main>
    </Shell>
  );
}

function UploadPage() {
  const { qrToken } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const form = new FormData();
    form.append("file", file);
    try {
      await api(`/api/public/qr/${qrToken}/uploads`, { method: "POST", body: form });
      navigate(`/qr/${qrToken}/success`);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <main className="page-shell flex min-h-[75vh] items-center justify-center">
        <form onSubmit={submit} className="card w-full max-w-lg space-y-4 p-5 sm:p-7">
          <h1 className="text-2xl font-black">Upload a private memory</h1>
          <input className="field" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0])} />
          {error && <p className="rounded-2xl bg-red-50 p-3 text-sm font-bold text-reject">{error}</p>}
          <button className="btn-primary w-full" disabled={!file}><UploadCloud size={18} /> Upload for review</button>
        </form>
      </main>
    </Shell>
  );
}

function UploadSuccess() {
  return <Shell><main className="page-shell flex min-h-[70vh] items-center justify-center"><div className="card max-w-lg p-7 text-center"><Check className="mx-auto text-trust" size={44} /><h1 className="mt-3 text-2xl font-black">Thanks! Your upload is waiting privately for approval.</h1><p className="mt-2 text-slatebody">Nothing appears in the album unless the tourist approves it.</p></div></main></Shell>;
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
        {!trip ? (
          <form onSubmit={unlock} className="card mx-auto max-w-md space-y-4 p-5">
            <Lock size={36} className="text-primary" />
            <h1 className="text-2xl font-black">Private shared album</h1>
            <input className="field" placeholder="PIN if required" value={pin} onChange={(e) => setPin(e.target.value)} />
            {error && <p className="text-sm font-bold text-reject">{error}</p>}
            <button className="btn-primary w-full">Open Album</button>
          </form>
        ) : (
          <>
            <div className="card p-5"><h1 className="break-words text-3xl font-black">{trip.title}</h1><p className="text-slatebody">{trip.destination}</p></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {trip.uploads.map((upload) => <MediaCard key={upload.id} upload={upload} />)}
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

function Settings() {
  return (
    <Shell>
      <main className="page-shell">
        <section className="card max-w-3xl space-y-4 p-5">
          <h1 className="text-3xl font-black">Settings</h1>
          <p className="text-slatebody">Approved albums are private by default. QR links are separate from album share links, and upload links can be paused, revoked, regenerated, or expired from each trip.</p>
          <p className="text-slatebody">Use HTTPS in production and keep Render, Netlify, PostgreSQL, and Cloudinary credentials out of source control.</p>
        </section>
      </main>
    </Shell>
  );
}

function Legal({ type }) {
  return (
    <Shell>
      <main className="page-shell">
        <article className="card max-w-4xl space-y-4 p-5 sm:p-8">
          <h1 className="text-3xl font-black">{type === "privacy" ? "Privacy Policy" : "Terms"}</h1>
          <p className="text-slatebody">Travel Share is designed for private, consent-forward travel memory sharing. Uploads remain pending until the album owner approves them.</p>
          <p className="text-slatebody">We do not sell uploaded content or use it for AI training. Image metadata is stripped before storage when possible, and production media is stored in Cloudinary or S3.</p>
          <p className="text-slatebody">Report abuse to {supportEmail}.</p>
        </article>
      </main>
    </Shell>
  );
}

function Admin() {
  const [stats, setStats] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [ads, setAds] = useState([]);
  const [adForm, setAdForm] = useState({
    title: "",
    description: "",
    mediaUrl: "",
    mediaType: "image",
    linkUrl: "",
    active: true,
    priority: 0,
    displaySeconds: 12,
    startsAt: "",
    endsAt: ""
  });
  const [adFile, setAdFile] = useState(null);
  const [editingAdId, setEditingAdId] = useState(null);

  async function loadAdmin() {
    api("/api/admin/stats").then((data) => setStats(data.stats));
    api("/api/admin/moderation").then((data) => setUploads(data.uploads));
    api("/api/admin/ads").then((data) => setAds(data.ads));
  }

  useEffect(() => {
    loadAdmin();
  }, []);

  function resetAdForm() {
    setEditingAdId(null);
    setAdFile(null);
    setAdForm({ title: "", description: "", mediaUrl: "", mediaType: "image", linkUrl: "", active: true, priority: 0, displaySeconds: 12, startsAt: "", endsAt: "" });
  }

  function editAd(ad) {
    setEditingAdId(ad.id);
    setAdFile(null);
    setAdForm({
      title: ad.title || "",
      description: ad.description || "",
      mediaUrl: ad.mediaUrl || "",
      mediaType: ad.mediaType || "image",
      linkUrl: ad.linkUrl || "",
      active: ad.active,
      priority: ad.priority || 0,
      displaySeconds: ad.displaySeconds || 12,
      startsAt: ad.startsAt ? ad.startsAt.slice(0, 16) : "",
      endsAt: ad.endsAt ? ad.endsAt.slice(0, 16) : ""
    });
  }

  async function saveAd(event) {
    event.preventDefault();
    let mediaUrl = adForm.mediaUrl;
    let mediaType = adForm.mediaType;

    if (adFile) {
      const form = new FormData();
      form.append("file", adFile);
      const uploaded = await api("/api/admin/ads/media", { method: "POST", body: form });
      mediaUrl = uploaded.media.fileUrl;
      mediaType = uploaded.media.fileType;
    }

    const body = {
      ...adForm,
      mediaUrl,
      mediaType,
      priority: Number(adForm.priority),
      displaySeconds: Number(adForm.displaySeconds),
      startsAt: adForm.startsAt ? new Date(adForm.startsAt).toISOString() : null,
      endsAt: adForm.endsAt ? new Date(adForm.endsAt).toISOString() : null,
      description: adForm.description || null,
      linkUrl: adForm.linkUrl || null
    };
    await api(editingAdId ? `/api/admin/ads/${editingAdId}` : "/api/admin/ads", {
      method: editingAdId ? "PATCH" : "POST",
      body: JSON.stringify(body)
    });
    resetAdForm();
    loadAdmin();
  }

  return (
    <Shell>
      <main className="page-shell space-y-5">
        <h1 className="text-3xl font-black">Admin Dashboard</h1>
        {stats && <div className="grid gap-4 sm:grid-cols-4">{Object.entries(stats).map(([label, value]) => <Stat key={label} label={label} value={value} />)}</div>}
        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <form onSubmit={saveAd} className="card min-w-0 space-y-3 p-5">
            <h2 className="text-2xl font-black">{editingAdId ? "Edit Ad" : "Add Internal Ad"}</h2>
            <input className="field" placeholder="Ad title" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} />
            <textarea className="field min-h-24" placeholder="Short description" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} />
            <input className="field" type="file" accept="image/*,video/*" onChange={(e) => setAdFile(e.target.files?.[0] || null)} />
            <input className="field" placeholder="Image or video URL, or upload a file above" value={adForm.mediaUrl} onChange={(e) => setAdForm({ ...adForm, mediaUrl: e.target.value })} />
            <input className="field" placeholder="Click-through URL, optional" value={adForm.linkUrl} onChange={(e) => setAdForm({ ...adForm, linkUrl: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="field" value={adForm.mediaType} onChange={(e) => setAdForm({ ...adForm, mediaType: e.target.value })}>
                <option value="image">Image ad</option>
                <option value="video">Video ad</option>
              </select>
              <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-borderline bg-white px-4 py-3 font-bold">
                <input type="checkbox" checked={adForm.active} onChange={(e) => setAdForm({ ...adForm, active: e.target.checked })} />
                Active
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-bold text-slatebody">Priority<input className="field mt-1" type="number" min="0" max="1000" value={adForm.priority} onChange={(e) => setAdForm({ ...adForm, priority: e.target.value })} /></label>
              <label className="min-w-0 text-sm font-bold text-slatebody">Display seconds<input className="field mt-1" type="number" min="5" max="60" value={adForm.displaySeconds} onChange={(e) => setAdForm({ ...adForm, displaySeconds: e.target.value })} /></label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-sm font-bold text-slatebody">Starts at<input className="field mt-1" type="datetime-local" value={adForm.startsAt} onChange={(e) => setAdForm({ ...adForm, startsAt: e.target.value })} /></label>
              <label className="min-w-0 text-sm font-bold text-slatebody">Ends at<input className="field mt-1" type="datetime-local" value={adForm.endsAt} onChange={(e) => setAdForm({ ...adForm, endsAt: e.target.value })} /></label>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button className="btn-primary flex-1"><Save size={18} /> {editingAdId ? "Save Ad" : "Add Ad"}</button>
              {editingAdId && <button type="button" className="btn-ghost" onClick={resetAdForm}>Cancel</button>}
            </div>
          </form>
          <div className="space-y-3">
            <h2 className="text-2xl font-black">Internal Ads</h2>
            {ads.length === 0 ? <div className="card p-5 text-slatebody">No ads yet.</div> : ads.map((ad) => (
              <article key={ad.id} className="card min-w-0 overflow-hidden p-4">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-skysoft sm:w-44">
                    {ad.mediaType === "video" ? <video src={ad.mediaUrl} controls className="h-full w-full object-cover" /> : <img src={ad.mediaUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-lg font-black">{ad.title}</p>
                    <p className="break-words text-sm text-slatebody">{ad.description || "No description"}</p>
                    <p className="mt-2 text-xs font-bold uppercase text-report">{ad.active ? "Active" : "Paused"} • {ad.mediaType} • priority {ad.priority} • {ad.displaySeconds}s</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button className="btn-ghost" onClick={() => editAd(ad)}>Edit</button>
                      <button className="btn-ghost" onClick={() => api(`/api/admin/ads/${ad.id}`, { method: "PATCH", body: JSON.stringify({ active: !ad.active }) }).then(loadAdmin)}>
                        {ad.active ? "Pause" : "Activate"}
                      </button>
                      <button className="btn-danger" onClick={() => api(`/api/admin/ads/${ad.id}`, { method: "DELETE" }).then(loadAdmin)}><Trash2 size={17} /> Delete</button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-2xl font-black">Admin Moderation</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {uploads.map((upload) => <MediaCard key={upload.id} upload={upload} onReport={() => api(`/api/admin/moderation/${upload.id}/log`, { method: "POST", body: JSON.stringify({ action: "reviewed" }) })} />)}
          </div>
        </section>
      </main>
    </Shell>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/trips/:tripId" element={<PrivateRoute><TripDetails /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
        <Route path="/qr/:qrToken" element={<QrLanding />} />
        <Route path="/qr/:qrToken/upload" element={<UploadPage />} />
        <Route path="/qr/:qrToken/success" element={<UploadSuccess />} />
        <Route path="/share/:token" element={<ShareAlbum />} />
        <Route path="/privacy" element={<Legal type="privacy" />} />
        <Route path="/terms" element={<Legal type="terms" />} />
      </Routes>
      <BottomAd />
    </>
  );
}
