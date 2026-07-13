import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { Compass, MapPin, QrCode, ShoppingBag, Sparkles } from "lucide-react";
import { PageLayout, PageHeader, Section, Card, EmptyState } from "../components/ui";
import { useLanguage } from "../lib/i18n";
import { currentUser } from "../lib/api";

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "Not available";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function resolveGuestLifecycle(session = {}) {
  return session.lifecycle || session;
}

function formatMessage(template, values = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => {
    if (values[key] === undefined || values[key] === null) return `{${key}}`;
    return values[key];
  });
}

export default function GuestDashboard() {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const user = currentUser();
  const guestSession = user?.guestSession || {};
  const storedGuestAccessLink = typeof window !== 'undefined'
    ? localStorage.getItem('travelShareGuestAccessLink')
    : null;
  const guestAccessLink = guestSession?.accessLink || storedGuestAccessLink || "";
  const [copied, setCopied] = useState(false);
  const lifecycle = resolveGuestLifecycle(guestSession);
  const status = lifecycle.status || guestSession.status || "active";
  const createdAt = lifecycle.createdAt || guestSession.createdAt;
  const activeUntilRaw = lifecycle.activeUntil || guestSession.activeUntil || (createdAt ? new Date(new Date(createdAt).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null);
  const expiresAtRaw = lifecycle.expiresAt || guestSession.expiresAt || (createdAt ? new Date(new Date(createdAt).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString() : null);
  const expiresAt = formatDate(expiresAtRaw);
  const activeUntil = formatDate(activeUntilRaw);
  const activeDaysRemaining = activeUntilRaw ? daysUntil(activeUntilRaw) : null;
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  const daysRemaining = typeof lifecycle.daysRemaining === "number"
    ? lifecycle.daysRemaining
    : typeof guestSession.daysRemaining === "number"
    ? guestSession.daysRemaining
    : daysUntil(expiresAtRaw, now);
  const badgeText = status === "active"
    ? t("guest.activeGuest", "Active Guest")
    : status === "grace"
    ? t("guest.gracePeriod", "Grace Period")
    : t("guest.expired", "Expired");
  const noteText = status === "active"
    ? t("guest.activeBody", "You have full guest access and can upload memories from QR codes.")
    : status === "grace"
    ? t("guest.graceBody", "Grace period active. You can still upload memories and register until day 14.")
    : t("guest.expiredBody", "This guest session has expired. Please sign up or log in to continue.");

  const fullAccessStatus = status === "active"
    ? activeUntilRaw
      ? formatMessage(t("guest.fullAccessEnds", "Full access ends: {date}"), { date: activeUntil })
      : t("guest.fullAccessActive", "Your full guest access is active.")
    : status === "grace"
    ? t("guest.fullAccessGraceActive", "Grace period active.")
    : t("guest.fullAccessExpired", "Full access expired.");

  const registerGraceStatus = status === "expired"
    ? t("guest.sessionExpired", "Guest session expired. Please sign up or log in.")
    : formatMessage(t("guest.registerBeforeExpiry", "Register before {expiresAt} to keep your uploads permanently."), { expiresAt });

  const registerAction = status === "expired"
    ? (
      <div className="mt-4 flex flex-wrap gap-3">
        <Link to="/signup" className="btn-primary btn-signup">
          {t("guest.registerSignUp", "Sign up")}
        </Link>
        <Link to="/login" className="btn-ghost">
          {t("guest.registerLogIn", "Log in")}
        </Link>
      </div>
    )
      : (
      <Link to="/signup" className="btn-primary btn-signup">
        {t("guest.registerToKeepUploads", "Register to keep your uploads")}
      </Link>
    );

  return (
    <PageLayout>
      <PageHeader
        hero
        eyebrow={t("guestDashboard.eyebrow", "Guest access")}
        title={guestSession.displayName ? `${guestSession.displayName}` : t("guestDashboard.title", "Your guest dashboard")}
        subtitle={t("guestDashboard.subtitle", "Explore the app like a member while your guest session is active.")}
      />

      <Section>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          <section>
            <Card>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{badgeText}</p>
                  <h2 className="mt-3 text-3xl font-black font-serif">{t("guestDashboard.statusTitle", "Guest session status")}</h2>
                  <p className="mt-2 text-slatebody max-w-2xl">{noteText}</p>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4 text-right">
                  <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.sessionSummary", "Guest session summary")}</p>
                  <p className="mt-3 text-3xl font-black">{badgeText}</p>
                  <p className="mt-2 text-slatebody text-sm">{noteText}</p>
                  {status !== "expired" && expiresAt && (
                    <p className="mt-4 text-slatebody text-sm">{formatMessage(t("guest.sessionExpires", "Guest session expires: {date}"), { date: expiresAt })}</p>
                  )}
                  {status !== "expired" && daysRemaining !== null && (
                    <p className="mt-2 text-slatebody text-sm">{formatMessage(t("guest.daysLeftToRegister", "Days left to register: {days}"), { days: daysRemaining })}</p>
                  )}
                  <div className="mt-4">{registerAction}</div>
                </div>
              </div>
            </Card>
          </section>
          <aside>
            <Card>
              <div>
                <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.quickActionsBadge", "Quick actions")}</p>
                <h2 className="mt-3 text-2xl font-black">{t("guestDashboard.quickActionsTitle", "Keep exploring")}</h2>
              </div>
              <div className="mt-6 grid gap-3">
                <Link className="btn-ghost w-full" to="/scan"><QrCode size={18} /> {t("guestDashboard.scanQr", "Scan QR")}</Link>
                <Link className="btn-ghost w-full" to="/map"><MapPin size={18} /> {t("guestDashboard.exploreMap", "Explore Map")}</Link>
                <Link className="btn-ghost w-full" to="/events"><Compass size={18} /> {t("guestDashboard.browseEvents", "Browse Events")}</Link>
                <Link className="btn-ghost w-full" to="/store"><ShoppingBag size={18} /> {t("guestDashboard.viewStore", "View Store")}</Link>
              </div>
            </Card>
          </aside>
        </div>
      </Section>

      <Section>
        <Card>
          <h3 className="text-lg font-semibold">{t("guestDashboard.accessLinkTitle", "Guest access link")}</h3>
          <div className="mt-4">
            {guestAccessLink ? (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <input id="guest-dashboard-access-link" name="guestAccessLink" aria-label={t("guestDashboard.accessLinkTitle", "Guest access link")} className="field guest-link-field flex-1" readOnly value={guestAccessLink} />
                  <button className="btn-secondary" onClick={async () => {
                    try {
                      const ok = await copyToClipboard(guestAccessLink);
                      setCopied(ok);
                      if (ok) setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      setCopied(false);
                    }
                  }}>{t("guestDashboard.copyLink", "Copy link")}</button>
                </div>
                {copied && <p className="mt-2 text-sm text-green-400">{t("guestDashboard.linkCopied", "Guest access link copied")}</p>}
              </>
            ) : (
              <p className="text-slatebody">{t("guestDashboard.noLinkAvailable", "Guest access link is not available for this session. Create a new guest access session or resume using your saved guest link.")}</p>
            )}
          </div>
        </Card>
      </Section>

      <Section>
        <Card>
          <div className="rounded-3xl border border-borderline bg-slate-950/90 p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.guestAccessRules", "Guest access rules")}</p>
            <ul className="mt-4 space-y-3 text-slatebody text-sm">
              <li>• {t("guest.fullAccessRule", "Full guest access lasts 3 days.")}</li>
              <li>• {t("guest.gracePeriodRule", "Grace period continues until day 14.")}</li>
              <li>• {t("guest.uploadsAllowedUntilExpiry", "Uploads are allowed until the guest session expires.")}</li>
              <li>• {t("guest.registerToKeepUploads", "Register before expiry to keep your uploads permanently.")}</li>
              <li>• {t("guest.purchasesRequireAccount", "Purchases and protected downloads require an account.")}</li>
            </ul>
          </div>
        </Card>
      </Section>

      <Section>
        <Card>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.uploadsBadge", "Guest uploads")}</p>
              <h3 className="mt-3 text-2xl font-black font-serif">{t("guestDashboard.uploadsTitle", "Your recent memories")}</h3>
              <p className="mt-2 text-slatebody">{t("guestDashboard.uploadsDescription", "Upload photos, videos, and captions from QR codes. Registered accounts keep these permanently.")}</p>
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/90 p-5">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.whatGuestsCanDo", "What guests can do")}</p>
              <ul className="mt-4 space-y-3 text-slatebody text-sm">
                <li>• {t("guestDashboard.canUpload", "Upload memories from QR codes.")}</li>
                <li>• {t("guestDashboard.canBrowse", "Browse public events and map pins.")}</li>
                <li>• {t("guestDashboard.canPreviewStore", "Preview the store, but purchases may require an account.")}</li>
                <li>• {t("guestDashboard.canRegister", "Register to keep uploads and unlock full access.")}</li>
              </ul>
            </div>
          </div>
        </Card>
      </Section>

      {status === "expired" && (
        <Section>
          <EmptyState
            title={t("guestDashboard.expiredTitle", "Guest access expired")}
            description={t("guestDashboard.expiredDescription", "Your guest session has ended. Register or log in to continue using TravelShare.")}
            action={<Link to="/signup" className="btn-primary btn-signup">{t("guestDashboard.registerToKeepUploads", "Register to keep your uploads")}</Link>}
            icon={<Sparkles />}
          />
        </Section>
      )}
    </PageLayout>
  );
}
