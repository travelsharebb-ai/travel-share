import { useParams } from "react-router-dom";

export default function ShareAlbum() {
  const { token } = useParams();

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel max-w-4xl">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Shared Album</p>
        <h1 className="mt-3 text-5xl font-black font-serif">Travel Share Album</h1>
        <p className="mt-4 max-w-2xl text-slatebody leading-7">A public album shared with you. Use the share link to view photos and videos from the trip.</p>
      </section>

      <section className="card p-5 bg-slate-950/90 border border-white/10">
        <h2 className="text-2xl font-black font-serif">Album Token</h2>
        <p className="mt-3 rounded-3xl border border-borderline bg-slate-900 p-4 text-slatebody break-words">{token}</p>
        <p className="mt-4 text-slatebody">Photos and videos will appear here once the share link is connected.</p>
      </section>
    </main>
  );
}

// Styling is provided by the old Travel Share class-based theme.