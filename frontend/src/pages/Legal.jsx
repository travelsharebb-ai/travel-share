import { useLanguage } from "../lib/i18n";
import Shell from "../components/Shell";

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";

export default function Legal({ type }) {
  const { t } = useLanguage();
  return (
    <Shell>
      <main className="page-shell">
        <article className="card max-w-4xl space-y-4 p-5 sm:p-8">
          <h1 className="font-serif text-4xl font-black">
            {type === "privacy" ? t("hardcoded.privacyPolicy") : t("hardcoded.terms")}
          </h1>
          <p className="text-slatebody">{t("hardcoded.travelshareIsDesignedForPrivateConsentForwardTravel")}</p>
          <p className="text-slatebody">{t("hardcoded.weDoNotSellUploadedContentOrUse")}</p>
          <p className="text-slatebody">{t("hardcoded.reportAbuseTo")} <a href={`mailto:${supportEmail}`} className="text-primary">{supportEmail}</a>.
          </p>
        </article>
      </main>
    </Shell>
  );
}
