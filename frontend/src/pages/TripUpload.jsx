import { useLanguage } from "../lib/i18n";
import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function TripUpload() {
  const { t } = useLanguage();
  const { tripId } = useParams();
  const location = useLocation();
  const mapLocation = location.state?.mapLocation || null;
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");

  const locationPrivacy = mapLocation?.locationVisibility || 'approximate';

  const privacyLabel = locationPrivacy === 'exact'
    ? 'Exact Location'
    : locationPrivacy === 'city'
      ? 'City-Level Only'
      : 'Approximate Location';

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
                <div><strong>{t("map.addressLabelShort")}</strong> {mapLocation.address || 'Coordinates only'}</div>
                <div><strong>{t("hardcoded.city")}</strong> {mapLocation.city || 'Unknown'}</div>
                <div><strong>{t("hardcoded.region")}</strong> {mapLocation.region || 'Unknown'}</div>
                <div><strong>{t("hardcoded.country")}</strong> {mapLocation.country || 'Unknown'}</div>
                <div><strong>{t("hardcoded.privacy")}</strong> {privacyLabel}</div>
                <div><strong>{t("map.latitudeLabel")}</strong> {mapLocation.latitude != null ? mapLocation.latitude.toFixed(5) : 'Unknown'}</div>
                <div><strong>{t("map.longitudeLabel")}</strong> {mapLocation.longitude != null ? mapLocation.longitude.toFixed(5) : 'Unknown'}</div>
                <div><strong>{t("hardcoded.source")}</strong> {mapLocation.source}</div>
              </div>
            </div>
          ) : null}
        <label className="field block rounded-3xl border border-borderline bg-slate-950/70 p-5 text-center cursor-pointer">
          <span className="block text-xl font-black text-primary">
            {file ? file.name : "Choose photo or video"}
          </span>
          <span className="block mt-2 text-slatebody text-sm">{t("hardcoded.jpegPngMp4OrMov")}</span>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            hidden
          />
        </label>

        <textarea
          className="field min-h-[140px]"
          placeholder={t("common.addCaption")}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn-primary w-full" onClick={() => {}} disabled={!file}>{t("common.uploadMemory")}</button>
          <button type="button" className="btn-ghost w-full" onClick={() => navigate(`/trips/${tripId}`)}>{t("hardcoded.backToTrip")}</button>
        </div>
        {!file && (
          <p className="text-sm text-slatebody">{t("hardcoded.chooseAFileFirstUploadIsCurrentlyPrepared")}</p>
        )}
      </section>
    </main>
  );
}