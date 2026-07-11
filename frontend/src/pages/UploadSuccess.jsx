import { useLanguage } from "../lib/i18n";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function UploadSuccess() {
  const { t } = useLanguage();
  const { qrToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const qrInfo = location.state?.qrInfo;
  const message = location.state?.message || "Your memory was uploaded successfully.";

  const title =
    qrInfo?.qrType === "event"
      ? qrInfo?.qrData?.title
      : qrInfo?.qrType === "trip"
        ? qrInfo?.qrData?.title
        : qrInfo?.qrType === "zone"
          ? qrInfo?.qrData?.name
          : "Travel Share";

  return (
    <main className="page-shell flex min-h-[calc(100vh-74px)] items-center justify-center py-10">
      <section className="card p-6 max-w-md bg-slate-950/90 border border-white/10 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary text-black text-4xl font-black">
          ✓
        </div>
        <p className="mt-5 text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.memoryUploaded")}</p>
        <h1 className="mt-3 text-4xl font-black font-serif">{t("hardcoded.thankYou")}</h1>
        <p className="mt-3 text-slatebody">{message}</p>

        {title && (
          <div className="mt-6 rounded-3xl border border-borderline bg-slate-950/70 p-4 text-left text-slatebody">
            <small className="uppercase tracking-[0.28em] text-slatebody/70">{t("hardcoded.addedTo")}</small>
            <p className="mt-2 text-lg font-black text-white">{title}</p>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button className="btn-primary w-full" onClick={() => navigate(`/qr/${qrToken}/upload`)}>{t("hardcoded.uploadAnother")}</button>
          <button className="btn-ghost w-full" onClick={() => navigate("/scan")}>{t("hardcoded.scanAnotherQr")}</button>
          <button className="btn-indigo w-full" onClick={() => navigate("/")}>{t("hardcoded.backHome")}</button>
        </div>
      </section>
    </main>
  );
}