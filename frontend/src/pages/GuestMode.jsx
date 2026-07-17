import { useLanguage } from "../lib/i18n";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, Calendar, Lock, QrCode } from "lucide-react";
import { useState } from "react";
import AppTopbar from "../components/AppTopbar";
import { clearGuestToken, createGuestSessionProfile, resumeGuestSession, getGuestToken, setGuestSession, setGuestToken, validateGuestSession } from "../lib/api";
import { copyToClipboard } from "../lib/clipboard";
import GuestPinResetRequestForm from "../components/GuestPinResetRequestForm.jsx";
import SecretInput from "../components/SecretInput.jsx";

function HeaderBlock({ eyebrow, title, copy }) {
  return (
    <section>
      <p className="text-sm font-black uppercase text-primary">{eyebrow}</p>
      <h1 className="mt-2 break-words font-serif text-4xl font-black">{title}</h1>
      {copy && <p className="mt-2 max-w-3xl text-slatebody">{copy}</p>}
    </section>
  );
}

export default function GuestMode() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [guestMode, setGuestMode] = useState("choices");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [passcodeInput, setPasscodeInput] = useState("");
  const [resumeMethod, setResumeMethod] = useState("name");
  const [resumeName, setResumeName] = useState("");
  const [resumeTokenInput, setResumeTokenInput] = useState("");
  const [resumePasscode, setResumePasscode] = useState("");
  const [resumeLink, setResumeLink] = useState(null);
  const [savedSessionProblem, setSavedSessionProblem] = useState(null);
  const [copiedResumeLink, setCopiedResumeLink] = useState(false);
  const [showResetRequest, setShowResetRequest] = useState(false);

  async function createProfileAndAccess(e) {
    e?.preventDefault();
    setErrorKey(null);
    if (displayName.trim().length < 2) {
      setErrorKey("name");
      return;
    }
    if (!/^[0-9]{4}$/.test(passcodeInput.trim())) {
      setErrorKey("passcode");
      return;
    }
    setLoading(true);
    try {
      const data = await createGuestSessionProfile({ displayName: displayName.trim(), passcode: passcodeInput.trim() });
      const createdGuestToken = data?.guestSession?.token;
      const resumeToken = data.resumeToken || data.guestSession?.resumeToken || data.guestSession?.resume?.token;
      const accessLink = data.accessLink || data.guestSession?.accessLink || data.guestAccessLink || (resumeToken ? `${window.location.origin}/guest/access/${resumeToken}` : "");
      if (!createdGuestToken) {
        throw new Error("guest-session-not-created");
      }
      if (accessLink) {
        localStorage.setItem("travelShareGuestAccessLink", accessLink);
        setResumeLink(accessLink);
      }
      setGuestToken(createdGuestToken);
      setGuestSession(data.guestSession);
      setGuestMode("created");
    } catch (err) {
      setErrorKey(err.message === "guest-session-not-created" ? "guestMode.error.notCreated" : "guestMode.error.createFailed");
    } finally {
      setLoading(false);
    }
  }

  function copyResumeLink() {
    if (!resumeLink) return;
    copyToClipboard(resumeLink).then((ok) => {
      if (ok) {
        setCopiedResumeLink(true);
        setTimeout(() => setCopiedResumeLink(false), 2000);
      }
    }).catch(() => {});
  }

  async function continueViaResume(e) {
    e?.preventDefault();
    setErrorKey(null);
    if (resumeMethod === "name" && resumeName.trim().length < 2) {
      setErrorKey("name");
      return;
    }
    if (resumeMethod === "token" && !resumeTokenInput.trim()) {
      setErrorKey("guestMode.error.accessLinkRequired");
      return;
    }
    if (!/^[0-9]{4}$/.test(resumePasscode.trim())) {
      setErrorKey("passcode");
      return;
    }
    setLoading(true);
    try {
      const data = await resumeGuestSession({
        displayName: resumeMethod === "name" ? resumeName.trim() : undefined,
        resumeToken: resumeMethod === "token" ? resumeTokenInput.trim() : undefined,
        passcode: resumePasscode.trim()
      });
      if (data?.guestToken) {
        const accessLink = data.accessLink || data.guestSession?.accessLink;
        if (accessLink) {
          localStorage.setItem("travelShareGuestAccessLink", accessLink);
        }
        setGuestToken(data.guestToken);
        setGuestSession(data.guestSession);
        navigate("/dashboard", { replace: true });
        return;
      }
      setErrorKey("guestMode.error.resumeFailed");
    } catch (err) {
      setErrorKey("guestMode.error.resumeFailed");
    } finally {
      setLoading(false);
    }
  }

  async function continueGuestSession() {
    setErrorKey(null);
    setLoading(true);
    try {
      const response = await validateGuestSession();
      if (response.valid && response?.guestSession?.token) {
          if (response.guestSession?.accessLink) {
            localStorage.setItem("travelShareGuestAccessLink", response.guestSession.accessLink);
          }
        setGuestToken(response.guestSession.token);
        setGuestSession(response.guestSession);
        navigate("/dashboard", { replace: true });
        return;
      }
      clearGuestToken();
      const expired = response.error?.toLowerCase().includes("expire") || response.error?.toLowerCase().includes("expired");
      setSavedSessionProblem(expired ? "expired" : "invalid");
      setGuestMode(expired ? "expired" : "invalid");
      setErrorKey("guestMode.error.restoreFailed");
    } catch (err) {
      clearGuestToken();
      setSavedSessionProblem("invalid");
      setGuestMode("invalid");
      setErrorKey("guestMode.error.restoreFailed");
    } finally {
      setLoading(false);
    }
  }

  const tokenExists = Boolean(getGuestToken());
  const showResumeForm = guestMode === "resume";
  const showCreatedSummary = guestMode === "created";
  const showSavedProblem = guestMode === "invalid" || guestMode === "expired";
  const errorMessage = {
    name: t("hardcoded.enterAGuestNameAndA4Digit"),
    passcode: t("guestMode.error.passcode", "Enter a 4-digit passcode."),
    "guestMode.error.notCreated": t("guestMode.error.notCreated", "Guest session was not created. Please try again."),
    "guestMode.error.createFailed": t("guestMode.error.createFailed", "Unable to create guest access."),
    "guestMode.error.accessLinkRequired": t("guestMode.error.accessLinkRequired", "Enter your guest access link or token."),
    "guestMode.error.resumeFailed": t("guestMode.error.resumeFailed", "Unable to resume guest session."),
    "guestMode.error.restoreFailed": t("guestMode.error.restoreFailed", "Saved guest session could not be restored.")
  }[errorKey];

  return (
    <>
      <AppTopbar variant="public" />
      <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <HeaderBlock
          eyebrow={t("hardcoded.guestAccess")}
          title={t("hardcoded.useTravelshareWithoutSigningUp")}
          copy={t("hardcoded.guestsCanEnterFromQrLinks")}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <MapPin className="text-primary" size={32} />
          <h2 className="mt-3 font-serif text-2xl font-black">{t("hardcoded.touristGuest")}</h2>
          <p className="mt-2 text-slatebody">{t("hardcoded.scanATripQrUploadPhotosVideosAdd")}</p>
        </div>

        <div className="card p-5">
          <Calendar className="text-primary" size={32} />
          <h2 className="mt-3 font-serif text-2xl font-black">{t("hardcoded.eventGuest")}</h2>
          <p className="mt-2 text-slatebody">{t("hardcoded.openPublicEventsScanZoneQrCodesContribute")}</p>
        </div>

        <div className="card p-5">
          <Lock className="text-primary" size={32} />
          <h2 className="mt-3 font-serif text-2xl font-black">{t("hardcoded.after3Days")}</h2>
          <p className="mt-2 text-slatebody">{t("hardcoded.fullGuestAccessLastsFor3DaysThen")}</p>
        </div>
      </section>

      <section className="hero-copy-panel flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setGuestMode("create");
              setErrorKey(null);
              setSavedSessionProblem(null);
            }}
          >
            <MapPin size={18} />{t("hardcoded.continueAsGuest")}</button>
          {tokenExists && (
            <button type="button" className="btn-ghost" onClick={continueGuestSession} disabled={loading}>
              <QrCode size={18} />{t("hardcoded.continueSavedGuestSessionOnThisDevice")}</button>
          )}
          <button type="button" className="btn-ghost" onClick={() => { setGuestMode("resume"); setResumeMethod("name"); setErrorKey(null); }}>
            <Lock size={18} />{t("hardcoded.resumeExistingGuestSession")}</button>
          <Link className="btn-primary" to="/discover">
            <MapPin size={18} />{t("hardcoded.discoverPublicEvents")}</Link>
          <Link className="btn-primary btn-signup guest-host-cta" to="/signup">{t("hardcoded.createAccountToHost")}</Link>
        </div>
      </section>

      {showSavedProblem && (
        <section className="card p-5 border border-red-400 bg-red-950/5 text-slatebody">
          <h3 className="font-serif text-2xl font-black">{t("hardcoded.savedGuestSessionCouldNotBeRestored")}</h3>
          <p className="mt-2 text-slatebody">
            {savedSessionProblem === "expired"
              ? t("guestMode.savedSessionExpired", "Your saved guest session has expired. You can resume with an access link or start a new guest access.")
              : t("guestMode.savedSessionInvalid", "Saved guest session could not be restored. Start a new guest access or resume with a guest access link.")}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-primary" onClick={() => { setGuestMode("resume"); setResumeMethod("token"); setErrorKey(null); }}>{t("hardcoded.resumeWithGuestAccessLink")}</button>
            <button type="button" className="btn-ghost" onClick={() => { setGuestMode("create"); setErrorKey(null); setSavedSessionProblem(null); }}>{t("hardcoded.startNewGuestAccess")}</button>
            <Link className="btn-ghost" to="/login">{t("hardcoded.signUpLogIn")}</Link>
          </div>
        </section>
      )}

      {guestMode === "create" && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl font-black">{t("hardcoded.createGuestAccess")}</h3>
              <p className="mt-2 text-slatebody">{t("hardcoded.enterAGuestNameAndA4Digit")}</p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => { setGuestMode("choices"); setErrorKey(null); setDisplayName(""); setPasscodeInput(""); }}>{t("common.back")}</button>
          </div>
          <form className="mt-4 grid gap-3 max-w-xl" onSubmit={createProfileAndAccess}>
            <input
              name="guestDisplayName"
              className="field"
              placeholder={t("settingsPage.name")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
              minLength={2}
              required
            />
            <SecretInput
              kind="pin"
              name="guestPasscode"
              className="field"
              placeholder={t("hardcoded.4DigitPasscodeEG1234")}
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              inputMode="numeric"
              autoComplete="new-password"
              pattern="[0-9]{4}"
              maxLength={4}
              required
            />
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" type="submit" disabled={loading}>{t("hardcoded.createGuestAccess")}</button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setDisplayName("");
                  setPasscodeInput("");
                  setErrorKey(null);
                }}
              >{t("map.reset")}</button>
            </div>
            {errorMessage && <p className="text-reject mt-2">{errorMessage}</p>}
          </form>
        </section>
      )}

      {showCreatedSummary && (
        <section className="card p-5">
          <h3 className="font-serif text-2xl font-black">{t("hardcoded.guestAccessCreated")}</h3>
          <p className="mt-2 text-slatebody">{t("hardcoded.saveThisAccessLinkToResumeTheGuest")}</p>
          {resumeLink ? (
            <div className="mt-4 rounded-3xl border border-borderline bg-slate-950/5 p-4">
              <p className="text-sm text-slatebody">{t("hardcoded.guestAccessLink")}</p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input id="guest-mode-resume-link" name="guestResumeLink" aria-label={t("hardcoded.guestAccessLink")} className="field guest-link-field flex-1" readOnly value={resumeLink} />
                <button type="button" className="btn-ghost" onClick={copyResumeLink}>{t("hardcoded.copyAccessLink")}</button>
              </div>
              {copiedResumeLink && <p className="mt-2 text-sm text-green-400">{t("hardcoded.guestAccessLinkCopied")}</p>}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" className="btn-primary" onClick={() => {
                setErrorKey(null);
                const token = getGuestToken();
                if (!token) {
                  setErrorKey("guestMode.error.notCreated");
                  return;
                }
                navigate("/dashboard", { replace: true });
              }}>{t("hardcoded.continueToDashboard")}</button>
            <button type="button" className="btn-ghost" onClick={() => { setGuestMode("choices"); setErrorKey(null); }}>{t("hardcoded.returnToGuestOptions")}</button>
          </div>
          {errorMessage && <p className="text-reject mt-3">{errorMessage}</p>}
        </section>
      )}

      {showResumeForm && (
        <section className="card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-serif text-2xl font-black">{t("hardcoded.resumeExistingGuestSession")}</h3>
              <p className="mt-2 text-slatebody">
                {resumeMethod === "name"
                  ? t("hardcoded.enterThe4DigitPasscodeYouSetWhen")
                  : t("hardcoded.pasteYourGuestAccessLinkOrTokenAnd")}
              </p>
            </div>
            <button type="button" className="btn-ghost" onClick={() => { setGuestMode("choices"); setErrorKey(null); setResumeName(""); setResumeTokenInput(""); setResumePasscode(""); }}>{t("common.back")}</button>
          </div>
          <form className="mt-4 grid gap-3 max-w-xl" onSubmit={continueViaResume}>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={resumeMethod === "name" ? "btn-primary" : "btn-ghost"}
                onClick={() => { setResumeMethod("name"); setErrorKey(null); }}
              >
                1. {t("guestMode.resumeWithName")}
              </button>
              <button
                type="button"
                className={resumeMethod === "token" ? "btn-primary" : "btn-ghost"}
                onClick={() => { setResumeMethod("token"); setErrorKey(null); }}
              >
                2. {t("guestMode.resumeWithLinkToken")}
              </button>
            </div>
            {resumeMethod === "name" ? (
              <input
                name="guestResumeName"
                className="field"
                aria-label={t("settingsPage.name")}
                placeholder={t("settingsPage.name")}
                value={resumeName}
                onChange={(e) => setResumeName(e.target.value)}
                autoComplete="username"
                minLength={2}
                required
              />
            ) : (
              <input
                name="guestResumeToken"
                className="field"
                aria-label={t("hardcoded.guestAccessLink")}
                placeholder={t("hardcoded.pasteGuestAccessLinkOrToken")}
                value={resumeTokenInput}
                onChange={(e) => setResumeTokenInput(e.target.value)}
                autoComplete="off"
                required
              />
            )}
            <SecretInput
              kind="pin"
              name="guestResumePasscode"
              className="field"
              placeholder={t("hardcoded.4DigitPasscode")}
              value={resumePasscode}
              onChange={(e) => setResumePasscode(e.target.value)}
              inputMode="numeric"
              autoComplete="current-password"
              pattern="[0-9]{4}"
              maxLength={4}
              required
            />
            <div className="flex gap-3">
              <button className="btn-primary" type="submit" disabled={loading}>{t("hardcoded.continue")}</button>
              <Link className="btn-ghost" to="/guest/reset-pin">{t("security.forgotPin")}</Link>
            </div>
            <p className="text-sm text-slatebody">{t("security.forgotPinExplanation")}</p>
            {errorMessage && <p className="text-reject mt-2">{errorMessage}</p>}
          </form>
          <div className="mt-4 max-w-2xl border-t border-borderline pt-4">
            <button type="button" className="btn-ghost" onClick={() => setShowResetRequest((value) => !value)}>
              {showResetRequest ? t("security.resetRequests.hideGuestRequest") : t("security.resetRequests.requestGuest")}
            </button>
            {showResetRequest ? <GuestPinResetRequestForm initialGuestName={resumeName} /> : null}
          </div>
        </section>
      )}

      {guestMode === "choices" && (
        <section className="card p-5">
          <h3 className="font-serif text-2xl font-black">{t("hardcoded.welcomeToGuestAccess")}</h3>
          <p className="mt-2 text-slatebody">{t("hardcoded.chooseHowYouWouldLikeToJoinTravelshare")}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-primary" onClick={() => { setGuestMode("create"); setErrorKey(null); }}>{t("hardcoded.continueAsGuest")}</button>
            {tokenExists && (
              <button type="button" className="btn-ghost" onClick={continueGuestSession} disabled={loading}>{t("hardcoded.continueSavedGuestSessionOnThisDevice")}</button>
            )}
            <button type="button" className="btn-ghost" onClick={() => { setGuestMode("resume"); setResumeMethod("name"); setErrorKey(null); }}>{t("hardcoded.resumeExistingGuestSession")}</button>
            <Link className="btn-ghost" to="/login">{t("hardcoded.signUpLogIn")}</Link>
          </div>
          {tokenExists && (
            <p className="mt-3 text-sm text-slatebody">{t("hardcoded.aSavedGuestSessionIsAvailableOnThis")}</p>
          )}
        </section>
      )}
      </main>
    </>
  );
}
