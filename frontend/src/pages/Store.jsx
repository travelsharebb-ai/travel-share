import { useEffect, useState } from "react";

export default function Store() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/public/store-preview")
      .then((res) => res.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Travel Share marketplace</p>
        <h1 className="mt-3 text-5xl font-black font-serif">Premium upgrades for every journey</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          Discover premium assets, event boosts, and upgraded QR experiences that make every album feel modern, luxe, and ready for sharing.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary w-full sm:w-auto">Browse marketplace</button>
          <button className="btn-ghost w-full sm:w-auto">Explore premium tiers</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Featured upgrades</p>
          <h2 className="mt-3 text-3xl font-black font-serif">Build a travel experience that feels curated</h2>
          <p className="mt-4 text-slatebody leading-7">
            From premium themes to event analytics boosters, the Store puts the best Travel Share upgrades within reach.
          </p>
          <div className="mt-6 space-y-3">
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">Unlimited QR designs</p>
              <p className="mt-1 text-sm">Swap QR themes for every guest experience.</p>
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">Event spotlight upgrade</p>
              <p className="mt-1 text-sm">Turn any event into a polished sharing hub.</p>
            </div>
          </div>
        </div>

        <aside className="card p-5 bg-slate-950/90 border border-white/10 space-y-4">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Top benefits</p>
          <div className="space-y-3 text-slatebody text-sm">
            <p>✨ Glowing gallery upgrades and premium visuals</p>
            <p>🚀 Faster album sharing and unlockable pro features</p>
            <p>🔒 Exclusive content control for your events</p>
          </div>
          <button className="btn-indigo w-full">See featured items</button>
        </aside>
      </section>

      {loading ? (
        <div className="card p-5 text-slatebody">Loading store items…</div>
      ) : items.length === 0 ? (
        <div className="card p-5 bg-slate-950/90 border border-white/10 text-slatebody">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">No products yet</p>
          <h2 className="mt-3 text-2xl font-black font-serif">Your premium store is ready</h2>
          <p className="mt-3 text-slatebody">Add curated themes, event boosts, and exclusive upgrades when you’re ready.</p>
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="card p-5 bg-slate-950/90 border border-white/10 hover:-translate-y-0.5 transition-transform">
              <div className="overflow-hidden rounded-3xl bg-slate-900">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={item.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 items-center justify-center bg-slate-900 text-slatebody">No preview available</div>
                )}
              </div>
              <div className="mt-5 space-y-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{item.type || "Upgrade"}</p>
                  <h3 className="mt-2 text-2xl font-black font-serif">{item.name}</h3>
                </div>
                <p className="text-slatebody leading-6">{item.description || "A premium Travel Share upgrade to enhance your albums and event pages."}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-black">{Number(item.priceCents || 0) === 0 ? "Free" : `$${(item.priceCents / 100).toFixed(2)}`}</span>
                  <button className="btn-primary">View item</button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
 