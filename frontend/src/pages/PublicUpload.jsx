import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function PublicUpload() {
  const { qrToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [qrInfo, setQrInfo] = useState(location.state || null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(!location.state);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const base = import.meta.env.VITE_API_URL || "";

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    async function loadQrInfo() {
      if (qrInfo) return;

      try {
        setLoading(true);
        const res = await fetch(`${base}/api/public/qr/${qrToken}`, {
          credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "QR not found");
          return;
        }

        setQrInfo({
          qrType: data.type,
          qrData: data.data,
          guest: data.guest
        });
      } catch (err) {
        console.error(err);
        setError("Failed to load QR details");
      } finally {
        setLoading(false);
      }
    }

    loadQrInfo();
  }, [base, qrInfo, qrToken]);

  const title =
    qrInfo?.qrType === "event"
      ? qrInfo?.qrData?.title || "Event Upload"
      : qrInfo?.qrType === "trip"
        ? qrInfo?.qrData?.title || "Trip Upload"
        : qrInfo?.qrType === "zone"
          ? qrInfo?.qrData?.name || "Zone Upload"
          : "Upload Memory";

  const subtitle =
    qrInfo?.qrType === "event"
      ? qrInfo?.qrData?.location || "Share your event memory"
      : qrInfo?.qrType === "trip"
        ? qrInfo?.qrData?.destination || "Share your trip memory"
        : qrInfo?.qrType === "zone"
          ? qrInfo?.qrData?.event?.title || "Share from this event zone"
          : "Share your photo or video";

  const guestState = qrInfo?.guest?.state;
  const guestDaysRemaining = qrInfo?.guest?.daysRemaining;
  const shouldPromptRegister = qrInfo?.guest?.shouldPromptRegister;
  const guestNotice = guestState === "active"
    ? "Guest access active. Register to save your uploads permanently."
    : guestState === "grace"
      ? "Your guest access is in grace period. Register now to keep your uploads."
      : guestState === "expired"
        ? "This guest session has expired. Please register or start a new session."
        : null;

  function chooseFile(nextFile) {
    setError(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const isAllowed =
      nextFile.type.startsWith("image/") ||
      nextFile.type.startsWith("video/");

    if (!isAllowed) {
      setError("Only photos and videos are allowed.");
      return;
    }

    setFile(nextFile);
  }

  function simulateProgress() {
    setProgress(8);

    const interval = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) {
          window.clearInterval(interval);
          return current;
        }

        return current + 8;
      });
    }, 250);

    return interval;
  }

  async function handleUpload(event) {
    event.preventDefault();

    if (!file) {
      setError("Please choose a photo or video first.");
      return;
    }

    let interval;

    try {
      setUploading(true);
      setError(null);
      interval = simulateProgress();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);

      const res = await fetch(`${base}/api/public/qr/${qrToken}/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || data?.message || "Upload failed");
        setProgress(0);
        return;
      }

      setProgress(100);

      setTimeout(() => {
        navigate(`/qr/${qrToken}/success`, {
          state: {
            upload: data.upload,
            message: data.message,
            qrInfo
          }
        });
      }, 450);
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
      setProgress(0);
    } finally {
      if (interval) window.clearInterval(interval);
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
        <section className="card p-5 max-w-2xl bg-slate-950/90 border border-white/10 space-y-5">
          <div className="h-10 bg-slate-900 rounded-2xl animate-pulse" />
          <div className="h-4 w-3/4 bg-slate-900 rounded-2xl animate-pulse" />
          <div className="h-72 bg-slate-900 rounded-[28px] animate-pulse" />
        </section>
      </main>
    );
  }

  return (
      <main className="page-shell py-10">
        <section className="hero-copy-panel max-w-4xl">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">QR upload</p>
          <h1 className="mt-3 text-5xl font-black font-serif">Share a memory with this QR</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">Choose a photo or video, add a caption, and keep the QR upload flow intact for public guests.</p>
        </section>

        <section className="card p-5 max-w-2xl bg-slate-950/90 border border-white/10 mt-6">
          <button type="button" onClick={() => navigate("/scan")} className="btn-ghost mb-4">
            ← Scan
          </button>

          <p className="text-sm uppercase tracking-[0.32em] text-primary">{qrInfo?.qrType || "QR"}</p>
          <h1 className="mt-3 text-3xl font-black font-serif">{title}</h1>
          <p className="mt-2 text-slatebody">{subtitle}</p>

          {guestNotice && (
            <div className={`mt-4 rounded-3xl border px-4 py-4 ${guestState === 'expired' ? 'border-red-500 bg-red-500/10 text-red-200' : 'border-primary/30 bg-primary/5 text-primary'}`}>
              <p className="text-sm font-semibold">{guestNotice}</p>
              {typeof guestDaysRemaining === 'number' && guestDaysRemaining >= 0 && (
                <p className="mt-1 text-sm text-slatebody">About {guestDaysRemaining} days remaining.</p>
              )}
              {shouldPromptRegister && guestState !== 'expired' && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => navigate('/signup')} className="btn-primary">
                    Register now
                  </button>
                  <button type="button" onClick={() => navigate('/login')} className="btn-ghost">
                    Sign in
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleUpload} className="mt-6 grid gap-5">
            {guestState === 'expired' ? (
              <section className="card rounded-3xl border border-red-500 bg-red-500/10 p-6 text-center">
                <p className="text-lg font-semibold text-red-200">This guest session has expired.</p>
                <p className="mt-2 text-slatebody">Please register or start a new session to continue uploading.</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button type="button" onClick={() => navigate('/signup')} className="btn-primary w-full sm:w-auto">
                    Register
                  </button>
                  <button type="button" onClick={() => navigate('/scan')} className="btn-ghost w-full sm:w-auto">
                    Start new session
                  </button>
                </div>
              </section>
            ) : (
              <>
            <label className="field rounded-[28px] border border-borderline bg-slate-950/70 p-6 text-center cursor-pointer">
              {!previewUrl ? (
                <>
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black text-3xl">＋</span>
                  <strong className="mt-4 block text-lg">Choose photo or video</strong>
                  <small className="mt-2 block text-slatebody">Camera or gallery supported</small>
                </>
              ) : file?.type.startsWith("image/") ? (
                <img src={previewUrl} alt="Preview" className="mx-auto h-64 w-full max-w-full rounded-3xl object-cover" />
              ) : (
                <video src={previewUrl} controls className="mx-auto h-64 w-full max-w-full rounded-3xl object-cover" />
              )}
              <input
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
            </label>

            {file && (
              <button type="button" onClick={() => chooseFile(null)} className="btn-ghost w-full">
                Remove file
              </button>
            )}

            <textarea
              placeholder="Add a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="field min-h-[120px] bg-slate-950/70 text-white"
              disabled={uploading}
            />

            {uploading && (
              <div className="relative h-4 overflow-hidden rounded-full bg-slate-900">
                <div className="absolute inset-y-0 left-0 bg-primary transition-all" style={{ width: `${progress}%` }} />
                <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-black">{progress}%</span>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button disabled={uploading} type="submit" className="btn-primary w-full">
              {uploading ? "Uploading..." : "Upload Memory"}
            </button>

            <button type="button" onClick={() => navigate("/scan")} className="btn-ghost w-full">
              Scan another QR
            </button>
            </>
            )}
          </form>
        </section>
      </main>
  );
}

// Styling is provided by the old Travel Share class-based theme.