import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell.jsx";
import { api } from "../lib/api";
import { useLanguage } from "../lib/i18n";

export default function VerifyEmailChange() {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [messageKey, setMessageKey] = useState("");
  const message = {
    "verifyEmail.missingToken": t("verifyEmail.missingToken", "Missing verification token."),
    "verifyEmail.successMessage": t("verifyEmail.successMessage", "Your email has been verified."),
    "verifyEmail.errorMessage": t("verifyEmail.errorMessage", "Unable to verify your email change.")
  }[messageKey] || "";

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessageKey("verifyEmail.missingToken");
      return;
    }

    async function verify() {
      try {
        await api(`/api/auth/verify-email-change?token=${encodeURIComponent(token)}`);
        setStatus("success");
        setMessageKey("verifyEmail.successMessage");
      } catch (err) {
        setStatus("error");
        setMessageKey("verifyEmail.errorMessage");
      }
    }

    verify();
  }, [searchParams]);

  return (
    <Shell>
      <main className="page-shell flex min-h-[70vh] items-center justify-center">
        <div className="card w-full max-w-xl space-y-6 p-6 text-center">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("verifyEmail.emailVerificationBadge", "Email verification")}</p>
          <h1 className="font-serif text-4xl font-black">
              {status === "loading" ? t("verifyEmail.verifying", "Verifying your email…") : status === "success" ? t("verifyEmail.verified", "Email verified") : t("verifyEmail.failed", "Verification failed")}
          </h1>
          <p className="text-slatebody">
              {status === "loading"
                ? t("verifyEmail.loadingMessage", "Please wait while we confirm your email change.")
                : message}
          </p>
          {status === "error" && (
            <div className="rounded-3xl border border-rose-500 bg-rose-950/10 p-4 text-left text-sm text-rose-200">
              <p>{message}</p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="btn-ghost w-full" to="/login">{t("verifyEmail.goToLogin", "Go to Login")}</Link>
            <Link className="btn-primary w-full" to="/settings">{t("verifyEmail.goToSettings", "Go to Settings")}</Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}
