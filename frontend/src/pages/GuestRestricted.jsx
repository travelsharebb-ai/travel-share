import { Link } from "react-router-dom";
import { useLanguage } from "../lib/i18n";

export default function GuestRestricted({ feature }) {
  const { t } = useLanguage();

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("hardcoded.guestAccess")}</p>
        <h1 className="mt-3 text-4xl font-black font-serif">{t(`nav.${feature}`)}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("guestDashboard.canRegister")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn-primary" to="/signup">{t("guest.registerSignUp")}</Link>
          <Link className="btn-ghost" to="/login">{t("guest.registerLogIn")}</Link>
          <Link className="btn-ghost" to="/dashboard">{t("qrSpaces.backToDashboard")}</Link>
        </div>
      </section>
    </main>
  );
}
