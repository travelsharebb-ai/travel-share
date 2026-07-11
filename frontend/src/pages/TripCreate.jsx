import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n";
import LocationField from "../components/LocationField.jsx";

export default function TripCreate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", destination: "", startDate: "", endDate: "", defaultLocationVisibility: "approximate" });
  const [destinationLatitude, setDestinationLatitude] = useState("");
  const [destinationLongitude, setDestinationLongitude] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function update(k, v) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        destination: form.destination,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        defaultLocationVisibility: form.defaultLocationVisibility
      };

      const data = await api("/api/trips", { method: "POST", body: JSON.stringify(payload) });
      const id = data?.trip?.id || data?.id;
      if (id) navigate(`/trips/${id}`);
      else navigate("/dashboard");
    } catch (err) {
      setError(err.message || t("tripCreate.errorCreate", "Could not create trip."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("tripCreate.heroBadge", "Trips")}</p>
        <h1 className="mt-3 text-3xl font-black">{t("tripCreate.title", "Create trip")}</h1>
        <p className="mt-2 text-slatebody">{t("tripCreate.description", "Create a trip to collect memories and uploads. Fields are minimal for Phase 6.")}</p>
      </section>

      <section className="card p-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="form-label block" htmlFor="trip-title">{t("tripCreate.labelTitle", "Title")}</label>
            <input id="trip-title" name="title" className="input mt-2" value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>

          <div>
            <label className="form-label block" htmlFor="trip-destination">{t("tripCreate.labelDestination", "Destination")}</label>
            <div className="mt-2">
              <LocationField
                id="trip-destination"
                name="destination"
                value={form.destination}
                onChange={(value) => update("destination", value)}
                latitude={destinationLatitude}
                longitude={destinationLongitude}
                onLatChange={setDestinationLatitude}
                onLngChange={setDestinationLongitude}
                placeholder={t("tripCreate.destinationPlaceholder", "Search for a destination or address")}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label block" htmlFor="trip-start-date">{t("tripCreate.labelStartDate", "Start date")}</label>
              <input id="trip-start-date" name="startDate" type="date" className="input mt-2" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div>
              <label className="form-label block" htmlFor="trip-end-date">{t("tripCreate.labelEndDate", "End date")}</label>
              <input id="trip-end-date" name="endDate" type="date" className="input mt-2" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label block" htmlFor="trip-default-location-visibility">{t("tripCreate.labelDefaultLocationVisibility", "Default location visibility")}</label>
            <select id="trip-default-location-visibility" name="defaultLocationVisibility" className="input mt-2" value={form.defaultLocationVisibility} onChange={(e) => update("defaultLocationVisibility", e.target.value)}>
              <option value="exact">{t("tripCreate.visibility.exact", "Exact")}</option>
              <option value="approximate">{t("tripCreate.visibility.approximate", "Approximate")}</option>
              <option value="city">{t("tripCreate.visibility.city", "City")}</option>
              <option value="hidden">{t("tripCreate.visibility.hidden", "Hidden")}</option>
            </select>
          </div>

          {error && <div className="text-sm text-rose-500">{error || t("tripCreate.errorCreate", "Could not create trip.")}</div>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? t("tripCreate.creating", "Creating…") : t("tripCreate.submit", "Create trip")}</button>
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>{t("tripCreate.cancel", "Cancel")}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
