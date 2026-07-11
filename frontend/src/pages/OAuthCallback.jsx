import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { exchangeOAuthCode, setSession } from "../lib/api";
import { useLanguage } from "../lib/i18n";
import { PageLayout, PageHeader, Section, Card, LoadingState } from "../components/ui";

function decodeUserPayload(payload) {
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  const user = JSON.parse(new TextDecoder().decode(bytes));

  if (!user || typeof user !== "object" || Array.isArray(user)) {
    throw new Error("Invalid OAuth user payload");
  }

  return user;
}

function defaultRedirect(user) {
  if (["admin", "platform_admin"].includes(user?.role)) return "/admin";
  if (user?.role === "organizer") return "/events";
  return "/dashboard";
}

function safeInternalRedirect(value, fallback) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const destination = new URL(value, window.location.origin);
    if (destination.origin !== window.location.origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}

export default function OAuthCallback() {
  const { t } = useLanguage();
  const location = useLocation();
  const [status, setStatus] = useState({ type: "loading" });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const handoffCode = params.get("code")?.trim();
    const token = params.get("token")?.trim();
    const encodedUser = params.get("user")?.trim();
    const callbackError = params.get("error");
    const provider = params.get("provider");
    const requestedRedirect = params.get("redirect");

    // Remove callback data, especially credentials, without adding a history entry.
    window.history.replaceState(
      window.history.state,
      "",
      `${location.pathname}${location.hash}`
    );

    if (params.has("error")) {
      setStatus({
        type: "error",
        reason: "provider",
        detail: callbackError?.trim() || null,
        provider
      });
      return undefined;
    }

    if (!handoffCode && (!token || !encodedUser)) {
      setStatus({ type: "error", reason: "missing", detail: null, provider });
      return undefined;
    }

    let cancelled = false;
    let redirectTimer;

    async function completeSignIn() {
      let session;
      try {
        if (handoffCode) {
          session = await exchangeOAuthCode(handoffCode);
        } else {
          session = { token, user: decodeUserPayload(encodedUser) };
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({
            type: "error",
            reason: handoffCode ? "provider" : "invalidUser",
            detail: handoffCode ? error.message : null,
            provider
          });
        }
        return;
      }

      if (!session?.token || !session?.user || typeof session.user !== "object" || Array.isArray(session.user)) {
        if (!cancelled) setStatus({ type: "error", reason: "invalidUser", detail: null, provider });
        return;
      }

      try {
        setSession(session);
      } catch {
        if (!cancelled) setStatus({ type: "error", reason: "storage", detail: null, provider });
        return;
      }

      const fallback = defaultRedirect(session.user);
      const destination = safeInternalRedirect(session.redirect || requestedRedirect, fallback);
      if (cancelled) return;
      setStatus({ type: "success" });
      redirectTimer = window.setTimeout(() => {
        window.location.replace(destination);
      }, 300);
    }

    completeSignIn();
    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [location.hash, location.pathname, location.search]);

  const isError = status.type === "error";
  const title = isError
    ? status.reason === "provider"
      ? t("oauthCallback.errorTitle")
      : t("oauthCallback.invalidTitle")
    : status.type === "success"
      ? t("oauthCallback.successTitle")
      : t("oauthCallback.loadingTitle");

  function errorMessage() {
    if (status.detail) return status.detail;
    if (status.reason === "provider") return t("oauthCallback.errorDefault");
    if (status.reason === "invalidUser") return t("oauthCallback.invalidUserMessage");
    if (status.reason === "storage") return t("oauthCallback.storageMessage");
    return t("oauthCallback.missingMessage");
  }

  return (
    <PageLayout>
      <PageHeader
        title={title}
        subtitle={
          isError
            ? errorMessage()
            : status.type === "success"
              ? t("oauthCallback.successMessage")
              : t("oauthCallback.loadingDescription")
        }
      />
      <Section>
        <Card>
          {isError ? (
            <div className="space-y-4">
              <p className="break-words rounded-lg bg-red-50 p-3 text-sm font-bold text-reject">
                {errorMessage()}
              </p>
              <Link className="btn-primary inline-flex" to="/login" replace>
                {t("oauthCallback.returnToLogin")}
              </Link>
            </div>
          ) : (
            <LoadingState
              message={
                status.type === "success"
                  ? t("oauthCallback.successMessage")
                  : t("oauthCallback.loadingMessage")
              }
            />
          )}
        </Card>
      </Section>
    </PageLayout>
  );
}
