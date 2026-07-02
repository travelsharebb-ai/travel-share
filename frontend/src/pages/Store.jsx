import { useEffect, useState } from "react";
import { api, currentUser, getToken } from "../lib/api.js";

function formatPrice(priceCents) {
  return Number(priceCents || 0) === 0 ? "Free" : `$${(priceCents / 100).toFixed(2)}`;
}

export default function Store() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [processingItemId, setProcessingItemId] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const user = currentUser();
      const isAuthenticated = Boolean(getToken()) && user?.role !== "guest";
      const data = isAuthenticated ? await api("/api/store") : await api("/api/public/store-preview");
      setItems(data.items || []);
    } catch (err) {
      setItems([]);
      setError(err.message || "Unable to load store items.");
    } finally {
      setLoading(false);
    }
  }

  async function unlockItem(itemId) {
    setProcessingItemId(itemId);
    setError(null);
    setStatus(null);

    try {
      await api(`/api/store/${itemId}/purchase`, { method: "POST", body: JSON.stringify({}) });
      setStatus("Item unlocked successfully.");
      await loadItems();
    } catch (err) {
      setError(err.message || "Unable to unlock item.");
    } finally {
      setProcessingItemId(null);
    }
  }

  async function checkoutItem(itemId) {
    setProcessingItemId(itemId);
    setError(null);
    setStatus(null);

    try {
      const data = await api(`/api/store/${itemId}/checkout`, {
        method: "POST",
        body: JSON.stringify({ provider: "stripe" })
      });
      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank");
        setStatus("Checkout opened in a new tab. Complete payment to unlock the item.");
      } else {
        setStatus("Checkout started. Complete payment in the new window.");
      }
    } catch (err) {
      setError(err.message || "Unable to start checkout.");
    } finally {
      setProcessingItemId(null);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">Travel Share marketplace</p>
        <h1 className="mt-3 text-5xl font-black font-serif">Premium upgrades for every journey</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          Discover premium assets, event boosts, and unlocked photo frames for your memories. Use the Store to unlock items, then apply frames to your trip uploads.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary w-full sm:w-auto" onClick={loadItems} disabled={loading}>
            Refresh store
          </button>
          <button className="btn-ghost w-full sm:w-auto" onClick={() => window.location.assign("/trips")}>Browse trips</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Featured upgrades</p>
          <h2 className="mt-3 text-3xl font-black font-serif">Build a travel experience that feels curated</h2>
          <p className="mt-4 text-slatebody leading-7">
            Unlock free photo frames instantly, preview premium upgrades, and manage your Travel Share assets from one polished store.
          </p>
          <div className="mt-6 space-y-3">
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">Skin & frame unlocks</p>
              <p className="mt-1 text-sm">Apply unlocked frames to image uploads in your trip galleries.</p>
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">Premium add-ons</p>
              <p className="mt-1 text-sm">Paid upgrades use checkout endpoints when Stripe or PayPal is configured.</p>
            </div>
          </div>
        </div>

        <aside className="card p-5 bg-slate-950/90 border border-white/10 space-y-4">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">Store tips</p>
          <div className="space-y-3 text-slatebody text-sm">
            <p>✨ Free frames unlock instantly with one click.</p>
            <p>🚀 Paid upgrades open checkout in a new tab when configured.</p>
            <p>🔒 Owned items are marked and ready to use in your uploads.</p>
          </div>
          <button className="btn-indigo w-full" onClick={() => window.location.assign("/settings")}>Manage account</button>
        </aside>
      </section>

      {status ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/80 p-4 text-emerald-100">{status}</div>
      ) : null}
      {error ? (
        <div className="rounded-3xl border border-report/30 bg-slate-950/80 p-4 text-report">{error}</div>
      ) : null}

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
          {items.map((item) => {
            const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
            const previewUrl = metadata.frameAssetUrl || item.previewUrl || item.assetUrl || null;
            const isOwned = item.owned || false;
            const isFree = Number(item.priceCents || 0) === 0;
            const isProcessing = processingItemId === item.id;
            const user = currentUser();
            const isAuthenticated = Boolean(getToken()) && user?.role !== "guest";

            return (
              <div key={item.id} className="card p-5 bg-slate-950/90 border border-white/10 hover:-translate-y-0.5 transition-transform">
                <div className="overflow-hidden rounded-3xl bg-slate-900">
                  {previewUrl ? (
                    <img src={previewUrl} alt={item.name} className="h-44 w-full object-cover" />
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
                    <span className="text-lg font-black">{formatPrice(item.priceCents)}</span>
                    {!isAuthenticated ? (
                      <button className="btn-ghost" disabled>
                        Preview only
                      </button>
                    ) : isOwned ? (
                      <button className="btn-ghost" disabled>
                        Owned
                      </button>
                    ) : isFree ? (
                      <button className="btn-primary" onClick={() => unlockItem(item.id)} disabled={isProcessing}>
                        {isProcessing ? "Unlocking…" : "Unlock"}
                      </button>
                    ) : (
                      <button className="btn-primary" onClick={() => checkoutItem(item.id)} disabled={isProcessing}>
                        {isProcessing ? "Processing…" : "Checkout"}
                      </button>
                    )}
                  </div>
                  {!isAuthenticated ? (
                    <p className="text-xs text-slatebody">Guest preview only. Sign in to unlock items and use them on your uploads.</p>
                  ) : isOwned ? (
                    <p className="text-xs text-slatebody">You own this item. Apply unlocked frames in your trip uploads.</p>
                  ) : isFree ? (
                    <p className="text-xs text-slatebody">Free item. Unlock instantly and then apply it in your upload gallery.</p>
                  ) : (
                    <p className="text-xs text-slatebody">Paid item. Checkout via Stripe or PayPal to unlock.</p>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
