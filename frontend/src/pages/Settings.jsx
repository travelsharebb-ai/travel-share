import { useEffect, useState } from "react";
import { copyToClipboard } from "../lib/clipboard";
import { Link, useNavigate } from "react-router-dom";
import { api, currentUser, updateStoredUser } from "../lib/api";
import { setTheme, getTheme, getStoredThemeMode, setStoredThemeMode, applyThemeMode, getResolvedThemeMode } from "../lib/theme.js";
import { useLanguage } from "../lib/i18n";

function daysUntil(value, now = new Date()) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function Settings() {
  const { t } = useLanguage();
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
      setMessage(t("settingsPage.profileUpdated", "Profile updated."));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveChanges() {
    if (!user) return;
    if (user.role === "guest") {
      setError(t("settingsPage.guestCannotUpdate", "Guest accounts cannot update profile settings."));
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
        return setMessage(t("settingsPage.noChanges", "No changes to save."));
      }

      let updatedUser = user;
      const messages = [];

      if (nameChanged) {
        const res = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: nextName }) });
        updatedUser = res.user || res;
        setUser(updatedUser);
        setName(updatedUser.name || "");
        setCurrentEmail(updatedUser.email || "");
        setEmailVerifiedAt(updatedUser.emailVerifiedAt || null);
        updateStoredUser(updatedUser);
        messages.push(t('settingsPage.nameUpdated', 'Name updated.'));
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
          messages.push(t("settingsPage.devVerification", "DEV: verification link: {link}").replace("{link}", res.devVerificationUrl));
        } else {
          messages.push(t("settingsPage.verificationSent", "Verification email sent to the new address."));
        }
      }

      if (messages.length) {
        setMessage(messages.join(" "));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function requestEmailChange() {
    if (!newEmail) return setError(t('settingsPage.enterNewEmail', 'Enter a new email address.'));
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
        setMessage(t("settingsPage.devVerification", "DEV: verification link: {link}").replace("{link}", res.devVerificationUrl));
      } else {
        setMessage(t("settingsPage.verificationSent", "Verification email sent to the new address."));
      }
    } catch (err) {
      setError(err.message);
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
                  <p className="mt-2 text-lg font-bold capitalize">{user.guestSession.status || 'guest'}</p>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestDaysRemaining', 'Days remaining')}</p>
                  <p className="mt-2 text-lg font-bold">{user?.guestSession ? guestDaysRemaining : '—'}</p>
                </div>
                <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-primary">{t('settingsPage.guestExpires', 'Expires')}</p>
                  <p className="mt-2 text-lg font-bold">{user.guestSession.expiresAt ? new Date(user.guestSession.expiresAt).toLocaleDateString() : '—'}</p>
                </div>
              </div>
              ) : null}
            <div className="mt-4">
              <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("guestDashboard.eyebrow")}</p>
              <div className="mt-3">
                {typeof window !== 'undefined' && (guestAccessLink || user?.guestSession?.resumeAvailable) ? (
                  <div className="rounded-3xl border border-borderline bg-slate-950/90 p-4">
                    <p className="text-sm">Use this link with your 4-digit passcode to return to this guest session from another device.</p>
                    <div className="mt-3 flex items-center gap-3">
                      {guestAccessLink ? (
                        <input className="field guest-link-field flex-1" readOnly value={guestAccessLink} />
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

      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.profile', 'Profile')}</p>
            <h2 className="mt-2 text-3xl font-black font-serif">{t('settingsPage.accountOverview', 'Account overview')}</h2>
          </div>
          <div className="space-y-4 text-slatebody">
            <div>
              <label className="text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.name', 'Name')}</label>
              <input
                className="field w-full mt-2 bg-slate-950/70 text-white"
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
              <label className="text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.changeEmail', 'Change email')}</label>
              <div className="flex gap-2 mt-2">
                <input className="field flex-1 bg-slate-950/70 text-white" placeholder={t('settingsPage.newEmailPlaceholder', 'new@example.com')} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                    <button className="btn-primary" type="button" onClick={requestEmailChange} disabled={loading}>{t('settingsPage.requestEmailChange', 'Request email change')}</button>
              </div>
              {pendingEmail && (
                <p className="mt-2 text-sm text-slatebody">{t('settingsPage.pendingVerification', 'Pending verification: {email}').replace('{email}', pendingEmail)}</p>
              )}
            </div>
            {message && <p className="mt-2 text-sm text-green-400">{message}</p>}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
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
          <Toggle label={t('settingsPage.emailNotifications', 'Email notifications')} checked={settings.emailNotifications} onChange={(v) => update("emailNotifications", v)} />
          <Toggle label={t('settingsPage.uploadAlerts', 'Upload alerts')} checked={settings.uploadAlerts} onChange={(v) => update("uploadAlerts", v)} />
        </div>

        <div className="card p-5 bg-slate-950/90 border border-white/10 space-y-5">
          <div>
            <p className="text-sm uppercase tracking-[0.32em] text-primary">{t('settingsPage.privacy', 'Privacy')}</p>
            <h2 className="mt-2 text-2xl font-black font-serif">{t('settingsPage.controlFootprint', 'Control your footprint')}</h2>
          </div>
          <div className="space-y-4">
            <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settingsPage.defaultLocationPrivacy', 'Default location privacy')}</label>
            <select
              value={settings.locationPrivacy}
              onChange={(e) => update("locationPrivacy", e.target.value)}
              className="field w-full bg-slate-950/70 text-white"
            >
              <option value="exact">{t('settingsPage.exact', 'Exact')}</option>
              <option value="approximate">{t('settingsPage.approximate', 'Approximate')}</option>
              <option value="hidden">{t('settingsPage.hidden', 'Hidden')}</option>
            </select>
          </div>
            <div className="space-y-4">
              <label className="block text-sm uppercase tracking-[0.28em] text-slatebody/70">{t('settings.themeMode', 'Theme mode')}</label>
              <select
                value={settings.themeMode}
                onChange={(e) => update("themeMode", e.target.value)}
                className="field w-full bg-slate-950/70 text-white"
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

function Toggle({ label, checked, onChange }) {
  return (
    <label style={styles.toggle}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

const styles = {
  toggle: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }
};