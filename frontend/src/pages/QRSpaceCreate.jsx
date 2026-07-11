import { ArrowLeft, QrCode } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api, createQRSpace, currentUser } from "../lib/api";
import { useLanguage } from "../lib/i18n";

const TARGET_OPTIONS = [
  { value: "general", key: "qrSpaces.targetGeneral" },
  { value: "event", key: "qrSpaces.targetEvent" },
  { value: "trip", key: "qrSpaces.targetTrip" },
  { value: "album", key: "qrSpaces.targetAlbum" },
  { value: "location", key: "qrSpaces.targetLocation" }
];

export default function QRSpaceCreate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = currentUser();
  const isGuest = user?.role === "guest";

  const initialTargetType = useMemo(() => {
    const value = searchParams.get("targetType");
    return ["general", "event", "trip", "album", "location"].includes(value) ? value : "general";
  }, [searchParams]);

  const [form, setForm] = useState({
    title: "",
    targetType: initialTargetType,
    targetId: searchParams.get("targetId") || "",
    visibility: "unlisted",
    expiresAt: "",
    allowGuests: true,
    allowRegisteredUsers: true,
    requireApproval: true,
    locationName: "",
    latitude: "",
    longitude: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [trips, setTrips] = useState([]);

  useEffect(() => {
    let active = true;
    api("/api/trips")
      .then((data) => {
        if (!active) return;
        setTrips(Array.isArray(data.trips) ? data.trips : []);
      })
      .catch(() => {
        if (!active) return;
        setTrips([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = {
        title: form.title,
        targetType: form.targetType,
        visibility: form.visibility,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        allowGuests: form.allowGuests,
        allowRegisteredUsers: form.allowRegisteredUsers,
        requireApproval: form.requireApproval
      };

      if (["event", "trip", "album"].includes(form.targetType)) {
        payload.targetId = form.targetId.trim();
      }

      if (form.targetType === "location") {
        payload.locationName = form.locationName.trim() || null;
        payload.latitude = form.latitude === "" ? null : Number(form.latitude);
        payload.longitude = form.longitude === "" ? null : Number(form.longitude);
      }

      const data = await createQRSpace(payload);
      navigate(`/qr-spaces/${data.qrSpace.id}`, { state: data });
    } catch (err) {
      setError(err.message || t("qrSpaces.error"));
    } finally {
      setSaving(false);
    }
  }

  if (isGuest) {
    return (
      <main className="page-shell space-y-6">
        <section className="hero-copy-panel">
          <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.create")}</p>
          <h1 className="mt-3 text-4xl font-black font-serif">{t("qrSpaces.createAccountRequired")}</h1>
          <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("qrSpaces.guestCreateBlocked")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link className="btn-primary" to="/signup">{t("guest.registerSignUp")}</Link>
            <Link className="btn-ghost" to="/dashboard">{t("qrSpaces.backToDashboard")}</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <Link className="btn-ghost inline-flex items-center gap-2" to="/qr-spaces">
          <ArrowLeft size={16} />
          <span>{t("common.back")}</span>
        </Link>
        <p className="mt-5 text-sm uppercase tracking-[0.32em] text-primary">{t("qrSpaces.create")}</p>
        <h1 className="mt-3 text-5xl font-black font-serif">{t("qrSpaces.createTitle")}</h1>
        <p className="mt-4 max-w-3xl text-slatebody leading-7">{t("qrSpaces.subtitle")}</p>
      </section>

      <form onSubmit={submit} className="card grid gap-5 p-5">
        {error ? <div className="rounded-3xl border border-red-500 bg-red-500/10 p-4 text-red-200">{error}</div> : null}

        <label className="grid gap-2">
          <span className="form-label">{t("qrSpaces.name")}</span>
          <input id="qr-space-title" name="title" className="field" value={form.title} onChange={(event) => update("title", event.target.value)} required />
        </label>

        <label className="grid gap-2">
          <span className="form-label">{t("qrSpaces.targetType")}</span>
          <select id="qr-space-target-type" name="targetType" className="field" value={form.targetType} onChange={(event) => update("targetType", event.target.value)}>
            {TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.key)}
              </option>
            ))}
          </select>
        </label>

        {["trip", "album"].includes(form.targetType) ? (
          <label className="grid gap-2">
            <span className="form-label">{form.targetType === "album" ? t("qrSpaces.targetAlbum") : t("qrSpaces.targetTrip")}</span>
            <select id="qr-space-target-id" name="targetId" className="field" value={form.targetId} onChange={(event) => update("targetId", event.target.value)} required>
              <option value="">{t("qrSpaces.chooseTripAlbum", "Choose a trip album")}</option>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>{trip.title || t("trips.untitled", "Untitled trip")}</option>
              ))}
            </select>
            <small className="form-help">{t("qrSpaces.albumTargetHelp", "Album QR spaces save uploads into the selected trip album.")}</small>
          </label>
        ) : null}

        {form.targetType === "event" ? (
          <label className="grid gap-2">
            <span className="form-label">{t("qrSpaces.targetId")}</span>
            <input id="qr-space-event-target-id" name="targetId" className="field" value={form.targetId} onChange={(event) => update("targetId", event.target.value)} required />
            <small className="form-help">{t("qrSpaces.targetIdHelp")}</small>
          </label>
        ) : null}

        {form.targetType === "location" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2">
              <span className="form-label">{t("qrSpaces.locationName")}</span>
              <input id="qr-space-location-name" name="locationName" className="field" value={form.locationName} onChange={(event) => update("locationName", event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="form-label">{t("qrSpaces.latitude")}</span>
              <input id="qr-space-latitude" name="latitude" className="field" type="number" step="any" value={form.latitude} onChange={(event) => update("latitude", event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="form-label">{t("qrSpaces.longitude")}</span>
              <input id="qr-space-longitude" name="longitude" className="field" type="number" step="any" value={form.longitude} onChange={(event) => update("longitude", event.target.value)} />
            </label>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="form-label">{t("qrSpaces.visibility")}</span>
            <select id="qr-space-visibility" name="visibility" className="field" value={form.visibility} onChange={(event) => update("visibility", event.target.value)}>
              <option value="public">{t("qrSpaces.visibilityPublic")}</option>
              <option value="unlisted">{t("qrSpaces.visibilityUnlisted")}</option>
              <option value="private">{t("qrSpaces.visibilityPrivate")}</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="form-label">{t("qrSpaces.expiresAt")}</span>
            <input id="qr-space-expires-at" name="expiresAt" className="field" type="datetime-local" value={form.expiresAt} onChange={(event) => update("expiresAt", event.target.value)} />
          </label>
        </div>

        <div className="form-option-panel">
          <label className="flex items-center gap-3">
            <input id="qr-space-allow-guests" name="allowGuests" className="form-checkbox" type="checkbox" checked={form.allowGuests} onChange={(event) => update("allowGuests", event.target.checked)} />
            <span>{t("qrSpaces.allowGuests")}</span>
          </label>
          <label className="flex items-center gap-3">
            <input id="qr-space-allow-registered-users" name="allowRegisteredUsers" className="form-checkbox" type="checkbox" checked={form.allowRegisteredUsers} onChange={(event) => update("allowRegisteredUsers", event.target.checked)} />
            <span>{t("qrSpaces.allowRegisteredUsers")}</span>
          </label>
          <label className="flex items-center gap-3">
            <input id="qr-space-require-approval" name="requireApproval" className="form-checkbox" type="checkbox" checked={form.requireApproval} onChange={(event) => update("requireApproval", event.target.checked)} />
            <span>{t("qrSpaces.requireApproval")}</span>
          </label>
        </div>

        <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={saving}>
          <QrCode size={18} />
          <span>{saving ? t("qrSpaces.loading") : t("qrSpaces.generate")}</span>
        </button>
      </form>
    </main>
  );
}
