import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function PublicTripJoin() {
  const { qrToken } = useParams();

  useEffect(() => {
    fetch(`/api/public/qr/${qrToken}`)
      .then(res => res.json())
      .then(data => console.log(data));
  }, [qrToken]);

  return (
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="hero-copy-panel max-w-3xl space-y-6">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Public trip access</p>
        <h1 className="text-5xl font-black font-serif">Opening your shared trip</h1>
        <p className="text-slatebody leading-7">
          The QR is being resolved now. Once it loads, you’ll be able to add memories directly to the shared album.
        </p>
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-slatebody">Trip Loading...</p>
          <p className="mt-3 text-sm text-primary">Token: {qrToken}</p>
        </div>
      </section>
    </main>
  );
}