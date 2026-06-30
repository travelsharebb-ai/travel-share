import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function TripUpload() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");

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