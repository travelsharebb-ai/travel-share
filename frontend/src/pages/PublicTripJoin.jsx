import { useLanguage } from "../lib/i18n";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

export default function PublicTripJoin() {
  const { t } = useLanguage();
  const { qrToken } = useParams();

  useEffect(() => {
    fetch(`/api/public/qr/${qrToken}`)
      .then(res => res.json())
      .then(data => console.log(data));
  }, [qrToken]);

  return (
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="hero-copy-panel max-w-3xl space-y-6">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.publicTripAccess")}</p>
        <h1 className="text-5xl font-black font-serif">{t("hardcoded.openingYourSharedTrip")}</h1>
        <p className="text-slatebody leading-7">{t("hardcoded.theQrIsBeingResolvedNowOnceIt")}</p>
        <div className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-slatebody">{t("hardcoded.tripLoading")}</p>
          <p className="mt-3 text-sm text-primary">{t("publicTripJoin.tokenLabel", "Token")}: {qrToken}</p>
        </div>
      </section>
    </main>
  );
}
