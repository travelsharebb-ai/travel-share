import { useLanguage } from "../lib/i18n";
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PageLayout, PageHeader, Section, Card, LoadingState } from "../components/ui";

export default function OAuthCallback() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { search } = useLocation();

  useEffect(() => {
    // Preserve existing OAuth callback behavior: let the backend or existing auth code handle tokens.
    // Common pattern: after OAuth, backend sets session and redirects. If query contains redirect, follow it.
    const params = new URLSearchParams(search);
    const redirect = params.get("redirect") || "/dashboard";
    // Give a short pause and then navigate to the app.
    const t = setTimeout(() => navigate(redirect, { replace: true }), 800);
    return () => clearTimeout(t);
  }, [search, navigate]);

  return (
    <PageLayout>
      <PageHeader title={t("hardcoded.signingYouIn")} subtitle="Processing your OAuth sign-in..." />
      <Section>
        <Card>
          <LoadingState message="Processing login..." />
        </Card>
      </Section>
    </PageLayout>
  );
}