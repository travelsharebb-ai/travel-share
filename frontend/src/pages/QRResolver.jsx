import { useLanguage } from "../lib/i18n";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function QRResolver() {
  const { t } = useLanguage();
  const params = useParams();
  const qrToken = params.qrToken || params.code || params.token || "";
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    async function run() {
      try {
        setError(null);

        if (!qrToken || ["undefined", "null"].includes(String(qrToken).toLowerCase())) {
          setError(t("hardcoded.qrCodeMissingOrInvalid"));
          return;
        }

        const base = import.meta.env.VITE_API_URL || "";

        const res = await fetch(`${base}/api/public/qr/${encodeURIComponent(qrToken)}`, {
          credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
          console.error("QR error:", data);
          setError(t("hardcoded.qrNotFound"));
          return;
        }

        if (!data?.type || !data?.data) {
          setError(t("hardcoded.qrCodeMissingOrInvalid"));
          return;
        }

        const routeState = {
          qrType: data.type,
          qrData: data.data,
          guest: data.guest
        };

        if (data.type === "event" && data.data?.id) {
          navigate(`/events/${data.data.id}`, { state: routeState });
          return;
        }

        if (data.type === "trip" && data.data?.id) {
          navigate(`/trips/${data.data.id}`, { state: routeState });
          return;
        }

        navigate(`/qr/${qrToken}/upload`, { state: routeState });
      } catch (err) {
        console.error("QR Resolver crash:", err);
        setError(t("hardcoded.failedToOpenQr"));
      }
    }

    run();
  }, [qrToken, navigate, t]);

  return (
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="card p-5 max-w-lg bg-slate-950/90 border border-white/10 text-center">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.openingQr")}</p>
        <h1 className="mt-3 text-3xl font-black font-serif">{t("hardcoded.preparingYourExperience")}</h1>
        <p className="mt-3 text-slatebody">{t("hardcoded.pleaseWaitWhileWeLoadYourQrJourney")}</p>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </section>
    </main>
  );
}
