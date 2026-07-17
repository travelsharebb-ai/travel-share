import { useEffect, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { Link, useNavigate } from "react-router-dom";
import { api, currentUser, updateStoredUser } from "../lib/api";
import { setTheme, getTheme, getStoredThemeMode, setStoredThemeMode, applyThemeMode, getResolvedThemeMode } from "../lib/theme.js";
import { useLanguage } from "../lib/i18n";
import GuestPinResetRequestForm from "../components/GuestPinResetRequestForm.jsx";
import SecretInput from "../components/SecretInput.jsx";

function daysUntil(value, now = new Date()) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function Settings() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    uploadAlerts: true,
    locationPrivacy: "approximate",
    theme: getResolvedThemeMode(),
    themeMode: getStoredThemeMode()
  });

  const [user, setUser] = useState(currentUser());
  const [name, setName] = useState(user?.name || "");
  const [currentEmail, setCurrentEmail] = useState(user?.email || "");
  const [pendingEmail, setPendingEmail] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(user?.emailVerifiedAt || null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState({ loading: false, error: "", success: "" });
  const [passwordSetupStatus, setPasswordSetupStatus] = useState({ loading: false, error: "", success: "", devResetUrl: "" });
  const [accountSecurityLoaded, setAccountSecurityLoaded] = useState(
    user?.role === "guest" || typeof user?.hasLocalPassword === "boolean"
  );
  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "", confirmPin: "" });
  const [pinStatus, setPinStatus] = useState({ loading: false, error: "", success: "" });
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [passwordResetStatus, setPasswordResetStatus] = useState({ loading: false, error: "", success: "" });
  const [now, setNow] = useState(() => new Date());
  const storedGuestAccessLink = typeof window !== 'undefined'
    ? localStorage.getItem('travelShareGuestAccessLink')
    : null;
  const guestAccessLink = (user?.guestSession?.accessLink || storedGuestAccessLink) || null;
  const guestDaysRemaining = typeof user?.guestSession?.daysRemaining === 'number'
    ? user.guestSession.daysRemaining
    : daysUntil(user?.guestSession?.expiresAt, now);

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "theme") setTheme(value);
    if (key === "themeMode") {
      // persist and apply the chosen mode
      setStoredThemeMode(value);
      applyThemeMode(value);
      // update resolved theme immediately
      setSettings((current) => ({ ...current, theme: getResolvedThemeMode(), themeMode: value }));
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api("/api/auth/me");
        if (!mounted) return;
        const u = data.user || data;
        setUser(u);
        setName(u.name || "");
        setCurrentEmail(u.email || "");
        setPendingEmail(u.pendingEmail || null);
        setEmailVerifiedAt(u.emailVerifiedAt || null);
        setAccountSecurityLoaded(true);
      } catch (err) {
        // ignore
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveProfile() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const body = { name };
      const res = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      const updatedUser = res.user || res;
      setUser(updatedUser);
      setName(updatedUser.name || "");
      updateStoredUser(updatedUser);
      setMessage({ keys: ["profileUpdated"] });
    } catch (err) {
      setError("save");
    } finally {
      setLoading(false);
    }
  }

  async function saveChanges() {
    if (!user) return;
    if (user.role === "guest") {
      setError("guest");
      return;
    }
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const nextName = name.trim();
      const nextEmail = newEmail.trim();
      const nameChanged = nextName && nextName !== (user.name || "");
      const emailChanged = nextEmail && nextEmail !== currentEmail;
      if (!nameChanged && !emailChanged) {
        return setMessage({ keys: ["noChanges"] });
      }

      let updatedUser = user;
      const messageKeys = [];
      let verificationLink = "";

      if (nameChanged) {
        const res = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: nextName }) });
        updatedUser = res.user || res;
        setUser(updatedUser);
        setName(updatedUser.name || "");
        setCurrentEmail(updatedUser.email || "");
        setEmailVerifiedAt(updatedUser.emailVerifiedAt || null);
        updateStoredUser(updatedUser);
        messageKeys.push("nameUpdated");
      }

      if (emailChanged) {
        const res = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ email: nextEmail }) });
        const emailResult = res.user || res;
        updatedUser = emailResult;
        setUser(emailResult);
        setPendingEmail(emailResult.pendingEmail || null);
        setEmailVerifiedAt(emailResult.emailVerifiedAt || null);
        updateStoredUser(emailResult);
        setNewEmail("");
        if (res.devVerificationUrl) {
          messageKeys.push("devVerification");
          verificationLink = res.devVerificationUrl;
        } else {
          messageKeys.push("verificationSent");
        }
      }

      if (messageKeys.length) {
        setMessage({ keys: messageKeys, link: verificationLink });
      }
    } catch (err) {
      setError("save");
    } finally {
      setLoading(false);
    }
  }

  async function requestEmailChange() {
    if (!newEmail) return setError("emailRequired");
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ email: newEmail }) });
      // backend returns devVerificationUrl in non-prod or console providers
      const updatedUser = res.user || res;
      setUser(updatedUser);
      setPendingEmail(updatedUser.pendingEmail || null);
      setNewEmail("");
      updateStoredUser(updatedUser);
      if (res.devVerificationUrl) {
        setMessage({ keys: ["devVerification"], link: res.devVerificationUrl });
      } else {
        setMessage({ keys: ["verificationSent"] });
      }
    } catch (err) {
      setError("save");
    } finally {
      setLoading(false);
    }
  }

  async function copyGuestAccessLink() {
    if (!guestAccessLink) return;
    const ok = await copyToClipboard(guestAccessLink);
    setCopied(ok);
    if (ok) {
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordStatus({ loading: true, error: "", success: "" });
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ loading: false, error: t("security.passwordMismatch"), success: "" });
      return;
    }
    try {
      await api("/api/auth/me/password", { method: "PATCH", body: JSON.stringify(passwordForm) });
      const nextUser = { ...user, mustResetPassword: false };
      setUser(nextUser);
      updateStoredUser(nextUser);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStatus({ loading: false, error: "", success: t("security.passwordChanged") });
    } catch (requestError) {
      setPasswordStatus({ loading: false, error: requestError.message || t("security.passwordChangeFailed"), success: "" });
    }
  }

  async function changeGuestPin(event) {
    event.preventDefault();
    setPinStatus({ loading: true, error: "", success: "" });
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinStatus({ loading: false, error: t("security.pinMismatch"), success: "" });
      return;
    }
    try {
      await api("/api/public/guest/pin", { method: "PATCH", body: JSON.stringify(pinForm) });
      setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
      setPinStatus({ loading: false, error: "", success: t("security.pinChanged") });
    } catch (requestError) {
      setPinStatus({ loading: false, error: requestError.message || t("security.pinChangeFailed"), success: "" });
    }
  }

  async function requestPasswordSetup() {
    setPasswordSetupStatus({ loading: true, error: "", success: "", devResetUrl: "" });
    try {
      const response = await api("/api/auth/me/password-setup", { method: "POST", body: JSON.stringify({}) });
      setPasswordSetupStatus({
        loading: false,
        error: "",
        success: t("security.passwordSetupSent"),
        devResetUrl: response.devResetUrl || ""
      });
    } catch (requestError) {
      setPasswordSetupStatus({
        loading: false,
        error: requestError.message || t("security.passwordSetupFailed"),
        success: "",
        devResetUrl: ""
      });
    }
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    setPasswordResetStatus({ loading: true, error: "", success: "" });
    try {
      await api("/api/auth/me/password-reset-request", {
        method: "POST",
        body: JSON.stringify({ message: passwordResetMessage })
      });
      setPasswordResetMessage("");
      setPasswordResetStatus({ loading: false, error: "", success: t("security.resetRequests.passwordSent") });
    } catch (requestError) {
      setPasswordResetStatus({ loading: false, error: requestError.message || t("security.resetRequests.failed"), success: "" });
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.accountSettings', 'Account settings')}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t('settingsPage.refineExperience', 'Refine your Travel Share experience')}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">
          {t('settingsPage.keepPolished', 'Keep your profile polished, update preferences, and control privacy from one premium settings panel.')}
        </p>
      </section>

      {user?.role === 'guest' && (
        <section>
          <div className="card p-5">
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestStatus', t("guestDashboard.eyebrow"))}</p>
            <h2 className="mt-3 text-3xl font-black font-serif">{t('settingsPage.guestDashboardTitle', 'Guest session status')}</h2>
            <p className="mt-2 text-slatebody">{t('settingsPage.guestSettingsDescription', 'Your guest account is limited, but you can still browse maps, events, and store previews.')}</p>
            {user.guestSession ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestStatusLabel', 'Status')}</p>
                  <p className="mt-2 text-lg font-bold capitalize">{user.guestSession.status === "active" ? t("settingsPage.guestStatuses.active") : user.guestSession.status === "grace" ? t("settingsPage.guestStatuses.grace") : t("settingsPage.guestStatuses.expired")}</p>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestDaysRemaining', 'Days remaining')}</p>
                  <p className="mt-2 text-lg font-bold">{user?.guestSession ? guestDaysRemaining : '—'}</p>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestExpires', 'Expires')}</p>
                  <p className="mt-2 text-lg font-bold">{user.guestSession.expiresAt ? new Date(user.guestSession.expiresAt).toLocaleDateString(language) : '—'}</p>
                </div>
              </div>
              ) : null}
            <div className="mt-4">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.eyebrow")}</p>
              <div className="mt-3">
                {typeof window !== 'undefined' && (guestAccessLink || user?.guestSession?.resumeAvailable) ? (
                  <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                    <p className="text-sm">{t("hardcoded.saveThisAccessLinkToResumeTheGuest")}</p>
                    <div className="mt-3 flex items-center gap-3">
                      {guestAccessLink ? (
                        <input id="settings-guest-access-link" name="guestAccessLink" aria-label={t("hardcoded.guestAccessLink")} className="field guest-link-field flex-1" readOnly value={guestAccessLink} />
                      ) : (
                        <p className="text-slatebody">{t("hardcoded.guestAccessLinkIsNotAvailableForThis")}</p>
                      )}
                      {guestAccessLink && (
                        <button className="btn-ghost" onClick={copyGuestAccessLink}>{t("hardcoded.copyLink")}</button>
                      )}
                    </div>
                    {copied && <p className="mt-2 text-sm text-green-400">{t("hardcoded.guestAccessLinkCopied")}</p>}
                    <p className="mt-2 text-sm text-slatebody">{t("hardcoded.keepThisLinkPrivateAnyoneWithThisLink")}</p>
                    <div className="mt-3">
                      <Link to="/signup" className="btn-primary btn-signup">{t('settingsPage.guestRegisterCta', 'Register to keep your uploads')}</Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-slatebody">{t("hardcoded.guestAccessLinkIsNotAvailableForThis")}</p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {user?.role === "guest" ? (
        <form className="card p-5 bg-slate-950/90 border border-white/10" onSubmit={changeGuestPin}>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.guestSecurity")}</p>
          <h2 className="mt-2 text-3xl font-black font-serif">{t("security.changePin")}</h2>
          <p className="mt-2 text-slatebody">{t("security.changePinHelp")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <SecretInput kind="pin" className="field" name="currentPin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder={t("security.currentPin")} value={pinForm.currentPin} onChange={(event) => setPinForm((value) => ({ ...value, currentPin: event.target.value }))} />
            <SecretInput kind="pin" className="field" name="newPin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder={t("security.newPin")} value={pinForm.newPin} onChange={(event) => setPinForm((value) => ({ ...value, newPin: event.target.value }))} />
            <SecretInput kind="pin" className="field" name="confirmPin" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required placeholder={t("security.confirmPin")} value={pinForm.confirmPin} onChange={(event) => setPinForm((value) => ({ ...value, confirmPin: event.target.value }))} />
          </div>
          {pinStatus.error ? <p className="mt-3 text-sm text-red-400" role="alert">{pinStatus.error}</p> : null}
          {pinStatus.success ? <p className="mt-3 text-sm text-green-400" role="status">{pinStatus.success}</p> : null}
          <button className="btn-primary mt-4" disabled={pinStatus.loading}>{pinStatus.loading ? t("common.loading") : t("security.changePin")}</button>
        </form>
      ) : !accountSecurityLoaded ? (
        <section className="card p-5 bg-slate-950/90 border border-white/10" aria-busy="true">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.accountSecurity")}</p>
          <p className="mt-3 text-slatebody">{t("common.loading")}</p>
        </section>
      ) : user?.hasLocalPassword === false ? (
        <section className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.accountSecurity")}</p>
          <h2 className="mt-2 text-3xl font-black font-serif">{t("security.setPasswordTitle")}</h2>
          <p className="mt-2 text-slatebody">{t("security.oauthPasswordHelp")}</p>
          {passwordSetupStatus.error ? <p className="mt-3 text-sm text-red-400" role="alert">{passwordSetupStatus.error}</p> : null}
          {passwordSetupStatus.success ? <p className="mt-3 text-sm text-green-400" role="status">{passwordSetupStatus.success}</p> : null}
          {passwordSetupStatus.devResetUrl ? (
            <p className="mt-3 break-all text-sm text-slatebody">
              {t("security.devResetUrl")} <a className="text-primary underline" href={passwordSetupStatus.devResetUrl}>{passwordSetupStatus.devResetUrl}</a>
            </p>
          ) : null}
          <button type="button" className="btn-primary mt-4" disabled={passwordSetupStatus.loading} onClick={requestPasswordSetup}>
            {passwordSetupStatus.loading ? t("common.loading") : t("security.sendPasswordSetupLink")}
          </button>
        </section>
      ) : (
        <form className="card p-5 bg-slate-950/90 border border-white/10" onSubmit={changePassword}>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.accountSecurity")}</p>
          <h2 className="mt-2 text-3xl font-black font-serif">{t("security.changePassword")}</h2>
          <p className="mt-2 text-slatebody">{user?.mustResetPassword ? t("security.forcedPasswordReset") : t("security.changePasswordHelp")}</p>
          <div className="mt-4 grid gap-3">
            <SecretInput className="field" name="currentPassword" autoComplete="current-password" required placeholder={t("security.currentPassword")} value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))} />
            <SecretInput className="field" name="newPassword" autoComplete="new-password" minLength={10} required placeholder={t("security.newPassword")} value={passwordForm.newPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))} />
            <SecretInput className="field" name="confirmPassword" autoComplete="new-password" minLength={10} required placeholder={t("security.confirmPassword")} value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, confirmPassword: event.target.value }))} />
          </div>
          <p className="mt-3 text-sm text-slatebody">{t("security.passwordRequirements")}</p>
          {passwordStatus.error ? <p className="mt-3 text-sm text-red-400" role="alert">{passwordStatus.error}</p> : null}
          {passwordStatus.success ? <p className="mt-3 text-sm text-green-400" role="status">{passwordStatus.success}</p> : null}
          <button className="btn-primary mt-4" disabled={passwordStatus.loading}>{passwordStatus.loading ? t("common.loading") : t("security.changePassword")}</button>
        </form>
      )}

      {user?.role === "guest" ? (
        <section className="card p-5 bg-slate-950/90 border border-white/10">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.resetRequests.guestSettingsEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-black font-serif">{t("security.resetRequests.guestTitle")}</h2>
          <p className="mt-2 text-slatebody">{t("security.resetRequests.guestSettingsHelp")}</p>
          <GuestPinResetRequestForm initialGuestName={user?.name || user?.guestSession?.displayName || ""} />
        </section>
      ) : (
        <form className="card p-5 bg-slate-950/90 border border-white/10" onSubmit={requestPasswordReset}>
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("security.resetRequests.accountHelpEyebrow")}</p>
          <h2 className="mt-2 text-3xl font-black font-serif">{t("security.resetRequests.passwordTitle")}</h2>
          <p className="mt-2 text-slatebody">{t("security.resetRequests.passwordHelp")}</p>
          <textarea className="field mt-4 min-h-28 w-full" name="passwordResetMessage" minLength={5} maxLength={1000} required placeholder={t("security.resetRequests.message")} value={passwordResetMessage} onChange={(event) => setPasswordResetMessage(event.target.value)} />
          {passwordResetStatus.error ? <p className="mt-3 text-sm text-red-400" role="alert">{passwordResetStatus.error}</p> : null}
          {passwordResetStatus.success ? <p className="mt-3 text-sm text-green-400" role="status">{passwordResetStatus.success}</p> : null}
          <button className="btn-primary mt-4" disabled={passwordResetStatus.loading}>{passwordResetStatus.loading ? t("common.loading") : t("security.resetRequests.submitPassword")}</button>
        </form>
      )}

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.profile', 'Profile')}</p>
            <h2 className="mt-2 text-3xl font-black font-serif">{t('settingsPage.accountOverview', 'Account overview')}</h2>
          </div>
          <div className="space-y-4 text-slatebody">
            <div>
              <label htmlFor="settings-profile-name" className="text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.name', 'Name')}</label>
              <input
                id="settings-profile-name"
                name="name"
                className="field w-full mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.email', 'Email')}</label>
              <div className="mt-2">
                <p className="text-white">{currentEmail}</p>
                <p className="text-sm text-slatebody/70">{emailVerifiedAt ? t('settingsPage.verified', 'Verified') : t('settingsPage.notVerified', 'Not verified')}</p>
              </div>
            </div>
            <div>
              <label htmlFor="settings-new-email" className="text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.changeEmail', 'Change email')}</label>
              <div className="flex gap-2 mt-2">
                <input id="settings-new-email" name="newEmail" className="field flex-1" placeholder={t('settingsPage.newEmailPlaceholder', 'new@example.com')} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <button className="btn-primary" type="button" onClick={requestEmailChange} disabled={loading}>{t('settingsPage.requestEmailChange', 'Request email change')}</button>
              </div>
              {pendingEmail && (
                <p className="mt-2 text-sm text-slatebody">{t('settingsPage.pendingVerification', 'Pending verification: {email}', { email: pendingEmail })}</p>
              )}
            </div>
            {message && <p className="mt-2 text-sm text-green-400">{message.keys.map((key) => key === "profileUpdated" ? t("settingsPage.profileUpdated") : key === "nameUpdated" ? t("settingsPage.nameUpdated") : key === "noChanges" ? t("settingsPage.noChanges") : key === "devVerification" ? t("settingsPage.devVerification", "Your email verification is pending. Visit {link}.", { link: message.link || "" }) : t("settingsPage.verificationSent")).join(" ")}</p>}
            {error && <p className="mt-2 text-sm text-red-400">{error === "guest" ? t("settingsPage.guestCannotUpdate") : error === "emailRequired" ? t("settingsPage.enterNewEmail") : t("settingsPage.saveError")}</p>}
            <div className="mt-2">
              <button className="btn-ghost mr-2" onClick={() => { setName(user?.name || ""); setNewEmail(""); setMessage(null); setError(null); }}>{t('settingsPage.cancel', 'Cancel')}</button>
                  <button className="btn-primary" onClick={saveChanges} disabled={loading}>{loading ? t('settingsPage.saving', 'Saving...') : t('settingsPage.saveProfile', 'Save profile')}</button>
            </div>
            <div className="rounded-3xl border border-borderline bg-slate-950/70 p-4 text-slatebody">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.membership', 'Membership')}</p>
              <p className="mt-2 text-white">{t('settingsPage.plan', 'Travel Share Standard')}</p>
              <p className="mt-1 text-sm">{t('settingsPage.planHelp', 'Manage your plan and upgrade anytime in the Store.')}</p>
            </div>
          </div>
        </div>

        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.quickAction', 'Quick action')}</p>
          <div className="rounded-3xl border border-borderline bg-slate-950/70 p-5 text-slatebody">
              <p className="font-semibold">{settings.theme === "light" ? t('settingsPage.lightModeActive', 'Light mode active') : t('settingsPage.darkModeActive', 'Dark mode active')}</p>
              <p className="mt-2 text-sm">{settings.theme === "light" ? t('settingsPage.lightThemeHelp', 'Light theme is applied — you can switch back anytime.') : t('settingsPage.darkThemeHelp', 'Dark mode is enabled for a premium viewing experience.')}</p>
          </div>
          <button className="btn-ghost w-full" onClick={() => navigate('/privacy')}>{t('settingsPage.viewPrivacyHelp', 'View privacy help')}</button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.notifications', 'Notifications')}</p>
            <h2 className="mt-2 text-2xl font-black font-serif">{t('settingsPage.stayInLoop', 'Stay in the loop')}</h2>
          </div>
          <Toggle name="emailNotifications" label={t('settingsPage.emailNotifications', 'Email notifications')} checked={settings.emailNotifications} onChange={(v) => update("emailNotifications", v)} />
          <Toggle name="uploadAlerts" label={t('settingsPage.uploadAlerts', 'Upload alerts')} checked={settings.uploadAlerts} onChange={(v) => update("uploadAlerts", v)} />
        </div>

        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.privacy', 'Privacy')}</p>
            <h2 className="mt-2 text-2xl font-black font-serif">{t('settingsPage.controlFootprint', 'Control your footprint')}</h2>
          </div>
          <div className="space-y-4">
            <label htmlFor="settings-location-privacy" className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.defaultLocationPrivacy', 'Default location privacy')}</label>
            <select
              id="settings-location-privacy"
              name="locationPrivacy"
              value={settings.locationPrivacy}
              onChange={(e) => update("locationPrivacy", e.target.value)}
              className="field w-full"
            >
              <option value="exact">{t('settingsPage.exact', 'Exact')}</option>
              <option value="approximate">{t('settingsPage.approximate', 'Approximate')}</option>
              <option value="hidden">{t('settingsPage.hidden', 'Hidden')}</option>
            </select>
          </div>
            <div className="space-y-4">
              <label htmlFor="settings-theme-mode" className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settings.themeMode', 'Theme mode')}</label>
              <select
                id="settings-theme-mode"
                name="themeMode"
                value={settings.themeMode}
                onChange={(e) => update("themeMode", e.target.value)}
                className="field w-full"
              >
                <option value="sun">{t('settings.themeSun', 'Sunrise / Sunset Auto')}</option>
                <option value="light">{t('settings.themeLight', 'Light')}</option>
                <option value="dark">{t('settings.themeDark', 'Dark')}</option>
                <option value="system">{t('settings.themeSystem', 'System')}</option>
              </select>
              <p className="text-sm text-slatebody mt-2">{t('settings.themeModeHelp', 'Choose how TravelShare switches between light and dark mode.')}</p>
            </div>
        </div>
      </section>

      <button className="btn-primary w-full py-4" onClick={saveChanges} disabled={loading}>{loading ? t('settingsPage.saving', 'Saving...') : t('settingsPage.saveChanges', 'Save changes')}</button>
    </main>
  );
}

function Toggle({ name, label, checked, onChange }) {
  const id = `settings-${name}`;
  return (
    <label htmlFor={id} style={styles.toggle}>
      <span>{label}</span>
      <input id={id} name={name} className="form-checkbox" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const styles = {
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }
};
