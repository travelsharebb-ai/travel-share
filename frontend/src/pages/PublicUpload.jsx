import { useLanguage } from "../lib/i18n";
import { currentUser, getToken } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import LocationField from "../components/LocationField";

export default function PublicUpload() {
  const { t } = useLanguage();
  const { qrToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [qrInfo, setQrInfo] = useState(location.state || null);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationVisibility, setLocationVisibility] = useState("approximate");
  const [loading, setLoading] = useState(!location.state);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorKey, setErrorKey] = useState(null);

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
          setErrorKey("publicUpload.error.qrNotFound");
          return;
        }

        setQrInfo({
          qrType: data.type,
          qrData: data.data,
          guest: data.guest
        });
      } catch (err) {
        console.error(err);
        setErrorKey("publicUpload.error.qrLoadFailed");
      } finally {
        setLoading(false);
      }
    }

    loadQrInfo();
  }, [base, qrInfo, qrToken]);

  const title =
    qrInfo?.qrType === "event"
      ? qrInfo?.qrData?.title || t("publicUpload.eventTitle", "Event Upload")
      : qrInfo?.qrType === "trip"
        ? qrInfo?.qrData?.title || t("publicUpload.tripTitle", "Trip Upload")
        : qrInfo?.qrType === "zone"
          ? qrInfo?.qrData?.name || t("publicUpload.zoneTitle", "Zone Upload")
          : t("common.uploadMemory", "Upload memory");

  const subtitle =
    qrInfo?.qrType === "event"
      ? qrInfo?.qrData?.location || t("publicUpload.eventSubtitle", "Share your event memory")
      : qrInfo?.qrType === "trip"
        ? qrInfo?.qrData?.destination || t("publicUpload.tripSubtitle", "Share your trip memory")
        : qrInfo?.qrType === "zone"
          ? qrInfo?.qrData?.event?.title || t("publicUpload.zoneSubtitle", "Share from this event zone")
          : t("publicUpload.defaultSubtitle", "Share your photo or video");

  const user = currentUser();
  const isRegisteredUser = Boolean(getToken() && user && user.role !== "guest");
  const shouldShowGuestAccess = !isRegisteredUser && Boolean(qrInfo?.guest);
  const guestState = shouldShowGuestAccess ? qrInfo?.guest?.state : null;
  const guestDaysRemaining = shouldShowGuestAccess ? qrInfo?.guest?.daysRemaining : null;
  const shouldPromptRegister = shouldShowGuestAccess && qrInfo?.guest?.shouldPromptRegister;
  const guestNotice = guestState === "active"
    ? t("publicUpload.guestActive", "Guest access active. Register to save your uploads permanently.")
    : guestState === "grace"
      ? t("publicUpload.guestGrace", "Your guest access is in grace period. Register now to keep your uploads.")
      : guestState === "expired"
        ? t("publicUpload.guestExpired", "This guest session has expired. Please register or start a new session.")
        : null;
  const errorMessage = {
    "publicUpload.error.qrNotFound": t("publicUpload.error.qrNotFound", "QR not found."),
    "publicUpload.error.qrLoadFailed": t("publicUpload.error.qrLoadFailed", "Failed to load QR details."),
    "publicUpload.error.fileType": t("publicUpload.error.fileType", "Only photos and videos are allowed."),
    "publicUpload.error.fileRequired": t("publicUpload.error.fileRequired", "Please choose a photo or video first."),
    "publicUpload.error.uploadFailed": t("publicUpload.error.uploadFailed", "Upload failed. Please try again."),
    "upload.locationRequired": t("upload.locationRequired", "Add a location name, latitude, and longitude so this memory can appear on the map.")
  }[errorKey];

  function chooseFile(nextFile) {
    setErrorKey(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const isAllowed =
      nextFile.type.startsWith("image/") ||
      nextFile.type.startsWith("video/");

    if (!isAllowed) {
      setErrorKey("publicUpload.error.fileType");
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
      setErrorKey("publicUpload.error.fileRequired");
      return;
    }
    if (!locationName.trim() || latitude === "" || longitude === "") {
      setErrorKey("upload.locationRequired");
      return;
    }

    let interval;

    try {
      setUploading(true);
      setErrorKey(null);
      interval = simulateProgress();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);
      formData.append("locationName", locationName);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      formData.append("locationVisibility", locationVisibility);

      const res = await fetch(`${base}/api/public/qr/${qrToken}/uploads`, {
        method: "POST",
        credentials: "include",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorKey("publicUpload.error.uploadFailed");
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
      setErrorKey("publicUpload.error.uploadFailed");
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
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.qrUpload")}</p>
          <h1 className="mt-3 text-5xl font-black font-serif">{t("hardcoded.shareAMemoryWithThisQr")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("hardcoded.chooseAPhotoOrVideoAddACaption")}</p>
        </section>

        <section className="card p-5 max-w-2xl bg-slate-950/90 border border-white/10 mt-6">
          <button type="button" onClick={() => navigate("/scan")} className="btn-ghost mb-4">{t("hardcoded.scan")}</button>

          <p className="text-sm uppercase tracking-[0.32em] text-primary">{qrInfo?.qrType || t("publicUpload.qrLabel", "QR")}</p>
          <h1 className="mt-3 text-3xl font-black font-serif">{title}</h1>
          <p className="mt-2 text-slatebody">{subtitle}</p>

          {guestNotice && (
            <div className={`mt-4 rounded-3xl border px-4 py-4 ${guestState === 'expired' ? 'border-red-500 bg-red-500/10 text-red-200' : 'border-primary/30 bg-primary/5 text-primary'}`}>
              <p className="text-sm font-semibold">{guestNotice}</p>
              {typeof guestDaysRemaining === 'number' && guestDaysRemaining >= 0 && (
                <p className="mt-1 text-sm text-slatebody">{t("publicUpload.daysRemaining", "About {count} days remaining.", { count: guestDaysRemaining })}</p>
              )}
              {shouldPromptRegister && guestState !== 'expired' && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button type="button" onClick={() => navigate('/signup')} className="btn-primary">{t("hardcoded.registerNow")}</button>
                  <button type="button" onClick={() => navigate('/login')} className="btn-ghost">{t("hardcoded.signIn")}</button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleUpload} className="mt-6 grid gap-5">
            {guestState === 'expired' ? (
              <section className="card rounded-3xl border border-red-500 bg-red-500/10 p-6 text-center">
                <p className="text-lg font-semibold text-red-200">{t("hardcoded.thisGuestSessionHasExpired")}</p>
                <p className="mt-2 text-slatebody">{t("hardcoded.pleaseRegisterOrStartANewSessionTo")}</p>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button type="button" onClick={() => navigate('/signup')} className="btn-primary w-full sm:w-auto">{t("hardcoded.register")}</button>
                  <button type="button" onClick={() => navigate('/scan')} className="btn-ghost w-full sm:w-auto">{t("hardcoded.startNewSession")}</button>
                </div>
              </section>
            ) : (
              <>
            <label className="form-panel block cursor-pointer p-6 text-center">
              {!previewUrl ? (
                <>
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-black text-3xl">＋</span>
                  <strong className="mt-4 block text-lg">{t("common.choosePhotoOrVideo")}</strong>
                  <small className="mt-2 block text-slatebody">{t("hardcoded.cameraOrGallerySupported")}</small>
                </>
              ) : file?.type.startsWith("image/") ? (
                <img src={previewUrl} alt={t("common.preview")} className="mx-auto h-64 w-full max-w-full rounded-3xl object-cover" />
              ) : (
                <video src={previewUrl} controls className="mx-auto h-64 w-full max-w-full rounded-3xl object-cover" />
              )}
              <input
                id="public-upload-file"
                name="media"
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={(e) => chooseFile(e.target.files?.[0] || null)}
                style={{ display: "none" }}
              />
            </label>

            {file && (
              <button type="button" onClick={() => chooseFile(null)} className="btn-ghost w-full">{t("hardcoded.removeFile")}</button>
            )}

            <textarea
              id="public-upload-caption"
              name="caption"
              placeholder={t("common.addCaption")}
              aria-label={t("common.addCaption")}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="field min-h-[120px]"
              disabled={uploading}
            />

            <div className="form-panel grid gap-4 p-4">
              <div>
                <div>
                  <p className="form-label">{t("upload.locationTitle", "Upload location")}</p>
                  <p className="form-help mt-1">{t("upload.locationHelp", "Location is required so approved memories can appear on the map and heatmap.")}</p>
                </div>
              </div>
              <LocationField
                id="public-upload-location"
                name="locationName"
                value={locationName}
                onChange={setLocationName}
                latitude={latitude}
                longitude={longitude}
                onLatChange={setLatitude}
                onLngChange={setLongitude}
                placeholder={t("upload.locationPlaceholder", "Search for the upload location or address")}
              />
              <label className="grid gap-2">
                <span className="form-label">{t("settingsPage.defaultLocationPrivacy", "Default location privacy")}</span>
                <select id="public-upload-location-privacy" name="locationVisibility" className="field" value={locationVisibility} onChange={(e) => setLocationVisibility(e.target.value)} disabled={uploading}>
                  <option value="approximate">{t("settingsPage.approximate", "Approximate")}</option>
                  <option value="city">{t("settingsPage.city", "City")}</option>
                  <option value="exact">{t("settingsPage.exact", "Exact")}</option>
                </select>
              </label>
            </div>

            {uploading && (
              <div className="relative h-4 overflow-hidden rounded-full bg-slate-900">
                <div className="absolute inset-y-0 left-0 bg-primary transition-all" style={{ width: `${progress}%` }} />
                <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-black">{progress}%</span>
              </div>
            )}

            {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

            <button disabled={uploading} type="submit" className="btn-primary w-full">
              {uploading ? t("upload.uploading", "Uploading...") : t("common.uploadMemory")}
            </button>

            <button type="button" onClick={() => navigate("/scan")} className="btn-ghost w-full">{t("common.scanAnotherQr")}</button>
            </>
            )}
          </form>
        </section>
      </main>
  );
}

// Styling is provided by the old Travel Share class-based theme.
