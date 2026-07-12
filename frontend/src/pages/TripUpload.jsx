import { useLanguage } from "../lib/i18n";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import LocationField from "../components/LocationField";

export default function TripUpload() {
  const { t } = useLanguage();
  const { tripId } = useParams();
  const location = useLocation();
  const mapLocation = location.state?.mapLocation || null;
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [trip, setTrip] = useState(null);
  const [locationName, setLocationName] = useState(mapLocation?.address || mapLocation?.city || "");
  const [latitude, setLatitude] = useState(mapLocation?.latitude != null ? String(mapLocation.latitude) : "");
  const [longitude, setLongitude] = useState(mapLocation?.longitude != null ? String(mapLocation.longitude) : "");
  const [locationVisibility, setLocationVisibility] = useState(mapLocation?.locationVisibility || "approximate");
  const [uploading, setUploading] = useState(false);
  const [errorKey, setErrorKey] = useState("");

  useEffect(() => {
    let active = true;
    api(`/api/trips/${tripId}`)
      .then((data) => {
        if (!active) return;
        setTrip(data.trip || null);
      })
      .catch(() => {
        if (!active) return;
        setErrorKey("trips.error");
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  const privacyLabel = locationVisibility === 'exact'
    ? t("tripUpload.exactLocation", "Exact location")
    : locationVisibility === 'city'
      ? t("tripUpload.cityOnly", "City-level only")
      : t("tripUpload.approximateLocation", "Approximate location");
  const sourceLabel = mapLocation?.source === "search"
    ? t("map.search", "Search")
    : ["geolocation", "userLocation", "saved"].includes(mapLocation?.source)
      ? t("tripUpload.currentLocationSource", "Current location")
      : mapLocation?.source === "mapCenter"
        ? t("map.mapCenter", "Map center")
        : ["addPost", "map"].includes(mapLocation?.source)
          ? t("map.addPostLocation", "Add post location")
          : t("tripUpload.unknownSource", "Unknown source");
  const errorMessage = {
    "trips.error": t("trips.error", "Unable to load trips."),
    "tripUpload.fileRequired": t("tripUpload.fileRequired", "Choose a file first. Upload is currently prepared for photos and videos."),
    "upload.tripNotReady": t("upload.tripNotReady", "Trip upload link is not ready yet."),
    "upload.locationRequired": t("upload.locationRequired", "Add a location name, latitude, and longitude so this memory can appear on the map."),
    "upload.error": t("upload.error", "Upload failed. Please try again.")
  }[errorKey];

  async function uploadMemory() {
    setErrorKey("");
    if (!file) {
      setErrorKey("tripUpload.fileRequired");
      return;
    }
    if (!trip?.qrToken) {
      setErrorKey("upload.tripNotReady");
      return;
    }
    if (!locationName.trim() || latitude === "" || longitude === "") {
      setErrorKey("upload.locationRequired");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caption", caption);
      formData.append("locationName", locationName);
      formData.append("latitude", latitude);
      formData.append("longitude", longitude);
      formData.append("locationVisibility", locationVisibility);
      await api(`/api/public/qr/${trip.qrToken}/uploads`, {
        method: "POST",
        body: formData,
        timeoutMs: 30000
      });
      navigate(`/trips/${tripId}`);
    } catch {
      setErrorKey("upload.error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("common.uploadMemory")}</p>
          <h1 className="mt-3 text-4xl font-black font-serif">{t("hardcoded.addAMomentToYourTrip")}</h1>
          <p className="mt-4 max-w-2xl text-slatebody leading-7">{t("hardcoded.chooseAnImageOrVideoAddACaption")}</p>
        </div>
      </section>

      <section className="card p-5 space-y-5">
          {mapLocation ? (
            <div className="card rounded-3xl border border-borderline bg-slate-950/70 p-5 text-sm text-slatebody">
              <p className="font-semibold text-white mb-2">{t("hardcoded.selectedMapLocation")}</p>
              <div className="grid gap-2">
                <div><strong>{t("map.addressLabelShort")}</strong> {mapLocation.address || t("tripUpload.coordinatesOnly", "Coordinates only")}</div>
                <div><strong>{t("hardcoded.city")}</strong> {mapLocation.city || t("tripUpload.unknown", "Unknown")}</div>
                <div><strong>{t("hardcoded.region")}</strong> {mapLocation.region || t("tripUpload.unknown", "Unknown")}</div>
                <div><strong>{t("hardcoded.country")}</strong> {mapLocation.country || t("tripUpload.unknown", "Unknown")}</div>
                <div><strong>{t("hardcoded.privacy")}</strong> {privacyLabel}</div>
                <div><strong>{t("map.latitudeLabel")}</strong> {mapLocation.latitude != null ? mapLocation.latitude.toFixed(5) : t("tripUpload.unknown", "Unknown")}</div>
                <div><strong>{t("map.longitudeLabel")}</strong> {mapLocation.longitude != null ? mapLocation.longitude.toFixed(5) : t("tripUpload.unknown", "Unknown")}</div>
                <div><strong>{t("hardcoded.source")}</strong> {sourceLabel}</div>
              </div>
            </div>
          ) : null}
        <label className="form-panel block cursor-pointer p-5 text-center">
          <span className="block text-xl font-black text-primary">
            {file ? file.name : t("common.choosePhotoOrVideo")}
          </span>
          <span className="block mt-2 text-slatebody text-sm">{t("hardcoded.jpegPngMp4OrMov")}</span>
          <input
            id="trip-upload-file"
            name="media"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            hidden
          />
        </label>

        <textarea
          id="trip-upload-caption"
          name="caption"
          className="field min-h-[140px]"
          placeholder={t("common.addCaption")}
          aria-label={t("common.addCaption")}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="form-panel grid gap-4 p-4">
          <div>
            <div>
              <p className="form-label">{t("upload.locationTitle", "Upload location")}</p>
              <p className="form-help mt-1">{t("upload.locationHelp", "Location is required so approved memories can appear on the map and heatmap.")}</p>
            </div>
          </div>
          <LocationField
            id="trip-upload-location"
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
            <select id="trip-upload-location-privacy" name="locationVisibility" className="field" value={locationVisibility} onChange={(e) => setLocationVisibility(e.target.value)} disabled={uploading}>
              <option value="approximate">{t("settingsPage.approximate", "Approximate")}</option>
              <option value="city">{t("settingsPage.city", "City")}</option>
              <option value="exact">{t("settingsPage.exact", "Exact")}</option>
            </select>
          </label>
        </div>

        {errorMessage ? <p className="text-sm text-red-400">{errorMessage}</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn-primary w-full" onClick={uploadMemory} disabled={!file || uploading}>{uploading ? t("upload.uploading", "Uploading...") : t("common.uploadMemory")}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => navigate(`/trips/${tripId}`)}>{t("hardcoded.backToTrip")}</button>
        </div>
        {!file && (
          <p className="text-sm text-slatebody">{t("hardcoded.chooseAFileFirstUploadIsCurrentlyPrepared")}</p>
        )}
      </section>
    </main>
  );
}
