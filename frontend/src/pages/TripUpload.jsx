import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function TripUpload() {
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
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Upload memory</p>
          <h1 className="mt-3 text-4xl font-black font-serif">Add a moment to your trip</h1>
          <p className="mt-4 max-w-2xl text-slatebody leading-7">
            Choose an image or video, add a caption, and keep your travel album polished with the classic Travel Share style.
          </p>
        </div>
      </section>

      <section className="card p-5 space-y-5">
          {mapLocation ? (
            <div className="card rounded-3xl border border-borderline bg-slate-950/70 p-5 text-sm text-slatebody">
              <p className="font-semibold text-white mb-2">Selected map location</p>
              <div className="grid gap-2">
                <div><strong>Address:</strong> {mapLocation.address || 'Coordinates only'}</div>
                <div><strong>City:</strong> {mapLocation.city || 'Unknown'}</div>
                <div><strong>Region:</strong> {mapLocation.region || 'Unknown'}</div>
                <div><strong>Country:</strong> {mapLocation.country || 'Unknown'}</div>
                <div><strong>Privacy:</strong> {privacyLabel}</div>
                <div><strong>Latitude:</strong> {mapLocation.latitude != null ? mapLocation.latitude.toFixed(5) : 'Unknown'}</div>
                <div><strong>Longitude:</strong> {mapLocation.longitude != null ? mapLocation.longitude.toFixed(5) : 'Unknown'}</div>
                <div><strong>Source:</strong> {mapLocation.source}</div>
              </div>
            </div>
          ) : null}
        <label className="field block rounded-3xl border border-borderline bg-slate-950/70 p-5 text-center cursor-pointer">
          <span className="block text-xl font-black text-primary">
            {file ? file.name : "Choose photo or video"}
          </span>
          <span className="block mt-2 text-slatebody text-sm">JPEG, PNG, MP4 or MOV</span>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            hidden
          />
        </label>

        <textarea
          className="field min-h-[140px]"
          placeholder="Add a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn-primary w-full" onClick={() => {}} disabled={!file}>
            Upload memory
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => navigate(`/trips/${tripId}`)}>
            Back to Trip
          </button>
        </div>
        {!file && (
          <p className="text-sm text-slatebody">
            Choose a file first. Upload is currently prepared for the existing trip upload flow without creating a fake endpoint.
          </p>
        )}
      </section>
    </main>
  );
}