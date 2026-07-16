import { useLanguage } from "../lib/i18n";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppTopbar from "../components/AppTopbar";
import { resumeGuestSession, setGuestSession, setGuestToken } from "../lib/api";

export default function GuestAccess() {
  const { t } = useLanguage();
  const { resumeToken } = useParams();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await resumeGuestSession({ resumeToken, passcode });
      if (data?.guestToken) {
        const accessLink = data.accessLink || data.guestSession?.accessLink || `${window.location.origin}/guest/access/${resumeToken}`;
        if (accessLink) {
          localStorage.setItem("travelShareGuestAccessLink", accessLink);
        }
        setGuestToken(data.guestToken);
        setGuestSession(data.guestSession);
        navigate("/dashboard", { replace: true });
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AppTopbar variant="public" />
      <main className="page-shell flex min-h-[80vh] items-center justify-center pb-10">
      <div className="card p-6 max-w-lg w-full">
          <h1 className="text-2xl font-black font-serif">{t("hardcoded.resumeGuestAccess")}</h1>
          <p className="mt-2 text-slatebody">{t("hardcoded.enterThe4DigitPasscodeYouSetWhen")}</p>
          <form className="mt-4 grid gap-3" onSubmit={submit}>
            <input id="guest-access-passcode" name="passcode" type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{4}" maxLength={4} required aria-label={t("hardcoded.4DigitPasscode")} className="field" placeholder={t("hardcoded.4DigitPasscode")} value={passcode} onChange={(e) => setPasscode(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn-primary" type="submit" disabled={loading}>{t("hardcoded.continue")}</button>
            </div>
            {error && <p className="text-red-400 mt-2">{t("guestAccess.resumeFailed", "Unable to resume session")}</p>}
          </form>
      </div>
    </main>
    </>
  );
}
