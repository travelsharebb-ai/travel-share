import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, API_URL, currentUser, getToken } from "../lib/api.js";
import { useLanguage } from "../lib/i18n";

function formatPrice(priceCents, t) {
  return Number(priceCents || 0) === 0 ? t("store.price.free", "Free") : `$${(priceCents / 100).toFixed(2)}`;
}

export default function Store() {
  const { t } = useLanguage();
  const user = currentUser();
  const isGuestUser = user?.role === "guest";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [processingItemId, setProcessingItemId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [modalStatus, setModalStatus] = useState(null);
  const [previewTrips, setPreviewTrips] = useState([]);
  const [previewUploads, setPreviewUploads] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [selectedUploadId, setSelectedUploadId] = useState(null);
  const [imageErrorIds, setImageErrorIds] = useState(new Set());
  const [ownedOnly, setOwnedOnly] = useState(false);

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
      setError(err.message || t("store.error.loadItems", "Unable to load store items."));
    } finally {
      setLoading(false);
    }
  }

  function resolveAssetUrl(assetUrl) {
    if (!assetUrl) return null;
    try {
      return new URL(assetUrl, API_URL).toString();
    } catch (err) {
      return assetUrl;
    }
  }

  const filteredItems = useMemo(
    () => items.filter((item) => !ownedOnly || item.owned),
    [items, ownedOnly]
  );

  const sortedItems = useMemo(() => {
    const order = { basic: 0, premium: 1, seasonal: 2, "pending-naming": 3 };
    const copy = (filteredItems || []).slice();
    copy.sort((a, b) => {
      const metaA = a.metadata || {};
      const metaB = b.metadata || {};
      const catA = String((metaA.category || a.type || "").toLowerCase());
      const catB = String((metaB.category || b.type || "").toLowerCase());
      const rankA = order.hasOwnProperty(catA) ? order[catA] : 99;
      const rankB = order.hasOwnProperty(catB) ? order[catB] : 99;
      if (rankA !== rankB) return rankA - rankB;
      // same category: sort by name ascending
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    return copy;
  }, [filteredItems]);

  function handleImageError(itemId) {
    setImageErrorIds((prev) => new Set(prev).add(itemId));
  }

  async function loadUserTrips() {
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await api("/api/trips");
      if (Array.isArray(data.trips)) {
        setPreviewTrips(data.trips);
        if (data.trips.length) {
          const firstTripId = data.trips[0].id;
          setSelectedTripId(firstTripId);
          await loadTripUploads(firstTripId);
        } else {
          setPreviewUploads([]);
          setSelectedTripId(null);
          setSelectedUploadId(null);
        }
      }
    } catch (err) {
      setModalError(err.message || t("store.error.loadTrips", "Unable to load upload trips."));
      setPreviewTrips([]);
      setPreviewUploads([]);
      setSelectedTripId(null);
      setSelectedUploadId(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function loadTripUploads(tripId) {
    if (!tripId) return;
    setModalLoading(true);
    setModalError(null);
    try {
      const data = await api(`/api/trips/${tripId}/uploads`);
      if (Array.isArray(data.uploads)) {
        setPreviewUploads(data.uploads);
        setSelectedUploadId(data.uploads[0]?.id || null);
      } else {
        setPreviewUploads([]);
        setSelectedUploadId(null);
      }
    } catch (err) {
      setModalError(err.message || t("store.error.loadUploads", "Unable to load uploads."));
      setPreviewUploads([]);
      setSelectedUploadId(null);
    } finally {
      setModalLoading(false);
    }
  }

  function openPreview(item) {
    setSelectedItem(item);
    setModalError(null);
    setModalStatus(null);
    setPreviewTrips([]);
    setPreviewUploads([]);
    setSelectedTripId(null);
    setSelectedUploadId(null);
    const user = currentUser();
    const isAuthenticated = Boolean(getToken()) && user?.role !== "guest";
    if (isAuthenticated && item.owned && item.type === "image_skin") {
      loadUserTrips();
    }
  }

  function closePreview() {
    setSelectedItem(null);
    setModalError(null);
    setModalStatus(null);
    setPreviewTrips([]);
    setPreviewUploads([]);
    setSelectedTripId(null);
    setSelectedUploadId(null);
  }

  async function applySelectedSkin() {
    if (!selectedItem || !selectedUploadId) return;
    setModalLoading(true);
    setModalError(null);
    setModalStatus(null);
    try {
      await api(`/api/uploads/${selectedUploadId}/skin`, {
        method: "PATCH",
        body: JSON.stringify({ skinId: selectedItem.id })
      });
      setModalStatus("Skin applied to selected upload.");
    } catch (err) {
      setModalError(err.message || t("store.error.applySkin", "Unable to apply skin."));
    } finally {
      setModalLoading(false);
    }
  }

  async function unlockItem(itemId) {
    setProcessingItemId(itemId);
    setError(null);
    setStatus(null);

    try {
      await api(`/api/store/${itemId}/purchase`, { method: "POST", body: JSON.stringify({}) });
      setStatus(t("store.status.itemUnlocked", "Item unlocked successfully."));
      await loadItems();
    } catch (err) {
      setError(err.message || t("store.error.unlockItem", "Unable to unlock item."));
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
        setStatus(t("store.status.checkoutOpened", "Checkout opened in a new tab. Complete payment to unlock the item."));
      } else {
        setStatus(t("store.status.checkoutStarted", "Checkout started. Complete payment in the new window."));
      }
    } catch (err) {
      setError(err.message || t("store.error.checkout", "Unable to start checkout."));
    } finally {
      setProcessingItemId(null);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.hero.badge", "Travel Share marketplace")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("store.hero.title", "Premium upgrades for every journey")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          {t("store.hero.description", "Discover premium assets, event boosts, and unlocked photo frames for your memories. Use the Store to unlock items, then apply frames to your trip uploads.")}
        </p>
        {isGuestUser && (
          <div className="mt-6 rounded-3xl border border-sky-400/20 bg-white/95 p-5 text-slate-950 shadow-sm dark:border-violet-500/20 dark:bg-slate-950/95 dark:text-slate-100">
            <p className="font-semibold">{t("guest.registerToBuyOrDownload", "Register to buy or download")}</p>
            <p className="mt-2 text-slatebody text-sm">{t("guest.purchasesRequireAccount", "Purchases require an account.")}</p>
            <p className="mt-2 text-slatebody text-sm">{t("guest.downloadsRequireAccount", "Downloads require an account.")}</p>
              <div className="mt-4">
              <Link to="/signup" className="btn-primary btn-signup">
                {t("guest.clickToRegister", "Click to register")}
              </Link>
            </div>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="btn-primary w-full sm:w-auto" onClick={loadItems} disabled={loading}>
            {t("store.hero.refresh", "Refresh store")}
          </button>
          <button className="btn-ghost w-full sm:w-auto" onClick={() => window.location.assign("/trips")}>{t("store.hero.browseTrips", t("common.browseTrips"))}</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.featured.badge", "Featured upgrades")}</p>
          <h2 className="mt-3 text-3xl font-black font-serif">{t("store.featured.title", "Build a travel experience that feels curated")}</h2>
          <p className="mt-4 text-slatebody leading-7">
            {t("store.featured.description", "Unlock free photo frames instantly, preview premium upgrades, and manage your Travel Share assets from one polished store.")}
          </p>
          <div className="mt-6 space-y-3">
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">{t("store.featured.skinUnlocksTitle", "Skin & frame unlocks")}</p>
              <p className="mt-1 text-sm">{t("store.featured.skinUnlocksDescription", "Apply unlocked frames to image uploads in your trip galleries.")}</p>
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="font-semibold text-white">{t("store.featured.premiumAddOnsTitle", "Premium add-ons")}</p>
              <p className="mt-1 text-sm">{t("store.featured.premiumAddOnsDescription", "Paid upgrades use checkout endpoints when Stripe or PayPal is configured.")}</p>
            </div>
          </div>
        </div>

        <aside className="card p-5 bg-slate-950/90 border border-white/10 space-y-4">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.tips.badge", "Store tips")}</p>
          <div className="space-y-3 text-slatebody text-sm">
            <p>{t("store.tips.freeFrames", "✨ Free frames unlock instantly with one click.")}</p>
            <p>{t("store.tips.paidUpgrades", "🚀 Paid upgrades open checkout in a new tab when configured.")}</p>
            <p>{t("store.tips.ownedItems", "🔒 Owned items are marked and ready to use in your uploads.")}</p>
          </div>
          <button className="btn-indigo w-full" onClick={() => window.location.assign("/settings")}>{t("store.tips.manageAccount", "Manage account")}</button>
        </aside>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-borderline bg-slate-950/90 p-5">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.view.badge", "Store view")}</p>
          <p className="mt-2 text-slatebody text-sm">{t("store.view.description", "Filter by owned skins or browse the full catalog.")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`btn-ghost ${ownedOnly ? "bg-slate-800 text-white" : ""}`}
            onClick={() => setOwnedOnly((current) => !current)}
          >
            {ownedOnly ? t("store.view.showingOwned", "Showing owned") : t("store.view.showOwnedOnly", "Show owned only")}
          </button>
          <button type="button" className="btn-ghost" onClick={loadItems} disabled={loading}>
            {t("store.view.refresh", "Refresh")}
          </button>
        </div>
      </section>

      {status ? (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/80 p-4 text-emerald-100">{status}</div>
      ) : null}
      {error ? (
        <div className="rounded-3xl border border-report/30 bg-slate-950/80 p-4 text-report">{error}</div>
      ) : null}

      {loading ? (
        <div className="card p-5 text-slatebody">{t("store.loadingItems", "Loading store items…")}</div>
      ) : items.length === 0 ? (
        <div className="card p-5 bg-slate-950/90 border border-white/10 text-slatebody">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.empty.noProducts.badge", "No products yet")}</p>
          <h2 className="mt-3 text-2xl font-black font-serif">{t("store.empty.noProducts.title", "Your premium store is ready")}</h2>
          <p className="mt-3 text-slatebody">{t("store.empty.noProducts.description", "Add curated themes, event boosts, and exclusive upgrades when you’re ready.")}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card p-5 bg-slate-950/90 border border-white/10 text-slatebody">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.empty.noOwned.badge", "No owned skins")}</p>
          <h2 className="mt-3 text-2xl font-black font-serif">{t("store.empty.noOwned.title", "No matching skins found")}</h2>
          <p className="mt-3 text-slatebody">{t("store.empty.noOwned.description", "Try clearing the owned-only filter or check back later for new skin releases.")}</p>
        </div>
      ) : (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {sortedItems.map((item) => {
            const metadata = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
            const previewUrl = resolveAssetUrl(metadata.frameAssetUrl || item.previewUrl || item.assetUrl);
            const isOwned = Boolean(item.owned);
            const isFree = Number(item.priceCents || 0) === 0;
            const isPremium = item.priceCents > 0;
            const isProcessing = processingItemId === item.id;
            const user = currentUser();
            const isAuthenticated = Boolean(getToken()) && user?.role !== "guest";
            const category = metadata.category || item.type || "Skin";
            const imageMissing = !previewUrl || imageErrorIds.has(item.id);

            return (
              <article key={item.id} className="card overflow-hidden border border-white/10 bg-slate-950/90 shadow-sm shadow-black/20 transition-transform hover:-translate-y-0.5">
                <button
                  type="button"
                  onClick={() => openPreview(item)}
                  className="group w-full text-left"
                >
                  <div className="overflow-hidden bg-slate-900">
                    {!imageMissing ? (
                      <img
                        src={previewUrl}
                        alt={item.name}
                        className="h-44 w-full object-cover transition duration-300 ease-out group-hover:scale-105"
                        onError={() => handleImageError(item.id)}
                      />
                    ) : (
                      <div className="flex h-44 flex-col items-center justify-center gap-2 bg-slate-900 text-slatebody">
                        <span className="text-sm font-semibold text-slate-300">{t("store.preview.unavailable", "Preview unavailable")}</span>
                        <span className="text-xs text-slate-500">{t("store.preview.tapToView", "Tap to view details")}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.32em] text-primary">{category}</p>
                        <h3 className="mt-2 text-2xl font-black font-serif text-white">{item.name}</h3>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${isOwned ? "bg-emerald-500/15 text-emerald-200 store-badge-owned" : isFree ? "bg-sky-500/15 text-sky-200 store-badge-included" : "bg-violet-500/15 text-violet-200 store-badge-premium"}`}>
                        {isOwned ? t("store.badge.owned", "Owned") : isFree ? t("store.badge.included", "Included") : t("store.badge.premium", "Premium")}
                      </span>
                    </div>
                    <p className="text-slatebody leading-6">{item.description || t("store.item.defaultDescription", "A premium Travel Share upgrade to enhance your albums and event photos.")}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-500">
                      {isOwned ? <span className="text-emerald-300 store-status-ready">{t("store.status.readyToApply", "Ready to apply")}</span> : !isAuthenticated ? <span className="text-slatebody">{t("store.status.previewOnly", "Preview only")}</span> : isFree ? <span className="text-sky-300 store-status-free">{t("store.status.freeUnlock", "Free unlock")}</span> : <span className="text-violet-300 store-status-locked">{t("store.status.lockedPremium", "Locked premium")}</span>}
                    </div>
                  </div>
                </button>
                <div className="p-5 pt-0">
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-lg font-black">{formatPrice(item.priceCents, t)}</span>
                    {!isAuthenticated ? (
                      <button type="button" className="btn-ghost" onClick={() => openPreview(item)}>
                        {t("store.action.preview", "Preview")}
                      </button>
                    ) : isOwned ? (
                      <button type="button" className="btn-primary" onClick={() => openPreview(item)}>
                        {t("store.action.manage", "Manage")}
                      </button>
                    ) : isFree ? (
                      <button type="button" className="btn-primary" onClick={() => unlockItem(item.id)} disabled={isProcessing}>
                        {isProcessing ? t("store.action.unlocking", "Unlocking…") : t("store.action.unlock", "Unlock")}
                      </button>
                    ) : (
                      <button type="button" className="btn-primary" onClick={() => checkoutItem(item.id)} disabled={isProcessing}>
                        {isProcessing ? t("store.action.processing", "Processing…") : t("store.action.checkout", "Checkout")}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
                        {selectedItem ? (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 store-preview-overlay">
                            <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl store-preview-modal">
                              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                                <div>
                                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.modal.skinDetails", "Skin details")}</p>
                                  <h2 className="mt-2 text-3xl font-black font-serif">{selectedItem.name}</h2>
                                </div>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  onClick={closePreview}
                                  aria-label={t("store.modal.closePreviewAria", "Close skin preview")}
                                >
                                  {t("store.modal.close", "Close")}
                                </button>
                              </div>
                              <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_0.6fr]">
                                <div className="space-y-5">
                                  <div className="overflow-hidden rounded-3xl bg-slate-900 store-preview-image-card">
                                    {resolveAssetUrl(selectedItem.metadata?.frameAssetUrl || selectedItem.previewUrl || selectedItem.assetUrl) && !imageErrorIds.has(selectedItem.id) ? (
                                      <img
                                        src={resolveAssetUrl(selectedItem.metadata?.frameAssetUrl || selectedItem.previewUrl || selectedItem.assetUrl)}
                                        alt={selectedItem.name}
                                        className="h-80 w-full object-cover"
                                        onError={() => handleImageError(selectedItem.id)}
                                      />
                                    ) : (
                                      <div className="flex h-80 flex-col items-center justify-center gap-2 bg-slate-900 text-slatebody">
                                        <span className="text-lg font-semibold text-slate-200">{t("store.modal.previewUnavailable", "Preview unavailable")}</span>
                                        <span className="text-sm text-slate-500">{t("store.modal.previewLoadError", "This skin preview could not be loaded.")}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="rounded-3xl border border-borderline bg-slate-950/80 p-5 store-preview-desc-card">
                                    <div className="flex flex-wrap items-center gap-3">
                                      <span className="text-sm uppercase tracking-[0.32em] text-primary">{selectedItem.type || t("store.modal.upgradeType", "Upgrade")}</span>
                                      {selectedItem.owned ? (
                                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-emerald-200 store-badge-owned">
                                          {t("store.modal.owned", "Owned")}
                                        </span>
                                      ) : selectedItem.priceCents === 0 ? (
                                        <span className="rounded-full bg-sky-500/15 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-sky-200 store-badge-included">
                                          {t("store.modal.included", "Included")}
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-violet-500/15 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-violet-200 store-badge-premium">
                                          {t("store.modal.premium", "Premium")}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-4 text-slatebody leading-7">{selectedItem.description || t("store.modal.defaultDescription", "A premium Travel Share upgrade to enhance your albums and photo galleries.")}</p>
                                  </div>
                                </div>
                                <div className="space-y-5">
                                  <div className="rounded-3xl border border-borderline bg-slate-950/80 p-5 store-preview-status-panel">
                                    <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.modal.status", "Status")}</p>
                                    <div className="mt-4 space-y-3">
                                      <div className="rounded-3xl bg-slate-900 p-4 store-preview-status-item">
                                        <p className="text-sm text-slatebody">{selectedItem.priceCents === 0 ? t("store.modal.freeSkin", "Free skin") : t("store.modal.price", "Price: {price}").replace("{price}", formatPrice(selectedItem.priceCents, t))}</p>
                                        <p className="mt-2 text-lg font-black">{selectedItem.owned ? t("store.modal.ownedUnlocked", "Owned & unlocked") : selectedItem.priceCents === 0 ? t("store.modal.included", "Included") : t("store.modal.locked", "Locked")}</p>
                                      </div>
                                      {!getToken() ? (
                                        <div className="rounded-3xl bg-slate-900 p-4 text-slatebody store-preview-status-item">
                                              <p className="font-semibold">{t("guest.registerToBuyOrDownload", "Register to buy or download")}</p>
                                              <p className="mt-2 text-sm">{t("guest.purchasesRequireAccount", "Purchases require an account.")}</p>
                                              <p className="mt-2 text-sm">{t("guest.downloadsRequireAccount", "Downloads require an account.")}</p>
                                              <button
                                                type="button"
                                                className="btn-primary mt-4 w-full"
                                                onClick={() => window.location.assign("/signup")}
                                              >
                                                {t("guest.clickToRegister", "Click to register")}
                                              </button>
                                        </div>
                                      ) : selectedItem.owned ? (
                                        <div className="rounded-3xl bg-slate-900 p-4 text-slatebody store-preview-status-item">
                                          <p className="font-semibold">{t("store.modal.ownedSkin", "Owned skin")}</p>
                                          <p className="mt-2 text-sm">{t("store.modal.useControlsBelow", "Use the controls below to apply this skin to an upload from your trips.")}</p>
                                        </div>
                                      ) : selectedItem.priceCents === 0 ? (
                                        <div className="rounded-3xl bg-slate-900 p-4 text-slatebody store-preview-status-item">
                                          <p className="font-semibold">{t("store.modal.freeUnlock", "Free unlock")}</p>
                                          <p className="mt-2 text-sm">{t("store.modal.freeUnlockHelp", "Click unlock to add this skin to your account, then apply it from your uploads.")}</p>
                                        </div>
                                      ) : (
                                        <div className="rounded-3xl bg-slate-900 p-4 text-slatebody store-preview-status-item">
                                          <p className="font-semibold">{t("store.modal.premiumSkin", "Premium skin")}</p>
                                          <p className="mt-2 text-sm">{t("store.modal.premiumSkinHelp", "Checkout to unlock this premium skin. Once owned, you can apply it to photo uploads.")}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {selectedItem.owned && Boolean(getToken()) && selectedItem.type === "image_skin" ? (
                                    <div className="rounded-3xl border border-borderline bg-slate-950/80 p-5 store-preview-apply-panel">
                                      <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("store.modal.applyToUpload", "Apply to upload")}</p>
                                      {modalLoading ? (
                                        <p className="mt-4 text-slatebody">{t("store.modal.loadingUploads", "Loading uploads…")}</p>
                                      ) : previewTrips.length === 0 ? (
                                        <div className="mt-4 space-y-3 text-slatebody store-preview-apply-empty">
                                          <p>{t("store.modal.noTripsFound", "No trips or uploads were found for your account.")}</p>
                                          <p>{t("store.modal.uploadPhotoFirst", "Upload a photo first, then apply this skin from the trip upload page.")}</p>
                                          <button type="button" className="btn-primary w-full" onClick={() => window.location.assign("/trips")}>{t("common.browseTrips")}</button>
                                        </div>
                                      ) : (
                                        <div className="mt-4 space-y-4">
                                          <div>
                                            <label className="block text-sm uppercase tracking-[0.32em] text-primary" htmlFor="skin-trip-select">{t("store.modal.selectTripLabel", "Select trip")}</label>
                                            <select
                                              id="skin-trip-select"
                                              className="mt-2 w-full rounded-3xl border border-borderline bg-slate-900 p-3 text-slatebody"
                                              value={selectedTripId || ""}
                                              onChange={(event) => {
                                                const tripId = event.target.value;
                                                setSelectedTripId(tripId);
                                                loadTripUploads(tripId);
                                              }}
                                            >
                                              {previewTrips.map((trip) => (
                                                <option key={trip.id} value={trip.id}>
                                                  {trip.title || t("store.modal.untitledTrip", "Untitled trip")} ({trip._count?.uploads || 0} {t("store.modal.uploadsLabel", "uploads")})
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="block text-sm uppercase tracking-[0.32em] text-primary" htmlFor="skin-upload-select">
                                              {t("store.modal.choosePhotoLabel", "Choose photo")}
                                            </label>
                                            {previewUploads.length ? (
                                              <select
                                                id="skin-upload-select"
                                                className="mt-2 w-full rounded-3xl border border-borderline bg-slate-900 p-3 text-slatebody"
                                                value={selectedUploadId || ""}
                                                onChange={(event) => setSelectedUploadId(event.target.value)}
                                              >
                                                {previewUploads.map((upload) => (
                                                  <option key={upload.id} value={upload.id}>
                                                    {upload.caption ? `${upload.caption.slice(0, 50)}${upload.caption.length > 50 ? "…" : ""}` : upload.fileType || t("store.modal.photoFallback", "Photo")}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <p className="mt-2 text-slatebody">{t("store.modal.noUploadsFound", "No uploads were found in this trip.")}</p>
                                            )}
                                          </div>
                                          <button
                                            type="button"
                                            className="btn-primary w-full"
                                            disabled={!selectedUploadId || modalLoading}
                                            onClick={applySelectedSkin}
                                          >
                                            {modalLoading ? t("store.modal.applying", "Applying…") : t("store.modal.applySkinButton", "Apply skin to selected photo")}
                                          </button>
                                          {modalStatus ? <p className="text-emerald-300">{modalStatus}</p> : null}
                                          {modalError ? <p className="text-report">{modalError}</p> : null}
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
    </main>
  );
}
