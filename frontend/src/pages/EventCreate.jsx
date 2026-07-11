import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useLanguage } from "../lib/i18n";

export default function EventCreate() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", description: "", category: "", location: "", startDate: "", endDate: "", visibility: "public" });
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
        description: form.description || null,
        category: form.category || null,
        location: form.location || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        visibility: form.visibility || "public"
      };

      const data = await api("/api/events", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      // Expecting { event } or { id }
      const id = data?.event?.id || data?.id;
      if (id) {
        navigate(`/events/${id}`);
      } else {
        navigate("/events");
      }
    } catch (err) {
      setError(err.message || t("eventCreate.errorCreate", "Could not create event."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page-shell space-y-6">
      <section className="hero-copy-panel">
        <p className="text-sm uppercase tracking-[0.32em] text-primary">{t("eventCreate.heroBadge", "Organizer")}</p>
        <h1 className="mt-3 text-3xl font-black">{t("eventCreate.title", "Create event")}</h1>
        <p className="mt-2 text-slatebody">{t("eventCreate.description", "Create a simple event. Fields are intentionally minimal for Phase 6.")}</p>
      </section>

      <section className="card p-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="form-label block" htmlFor="event-title">{t("eventCreate.labelTitle", "Title")}</label>
            <input id="event-title" name="title" className="input mt-2" value={form.title} onChange={(e) => update("title", e.target.value)} required />
          </div>

          <div>
            <label className="form-label block" htmlFor="event-description">{t("eventCreate.labelDescription", "Description")}</label>
            <textarea id="event-description" name="description" className="input mt-2" value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label block" htmlFor="event-category">{t("eventCreate.labelCategory", "Category")}</label>
              <input id="event-category" name="category" className="input mt-2" value={form.category} onChange={(e) => update("category", e.target.value)} />
            </div>
            <div>
              <label className="form-label block" htmlFor="event-location">{t("eventCreate.labelLocation", "Location")}</label>
              <input id="event-location" name="location" className="input mt-2" value={form.location} onChange={(e) => update("location", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="form-label block" htmlFor="event-start-date">{t("eventCreate.labelStartDate", "Start date")}</label>
              <input id="event-start-date" name="startDate" type="datetime-local" className="input mt-2" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            </div>
            <div>
              <label className="form-label block" htmlFor="event-end-date">{t("eventCreate.labelEndDate", "End date")}</label>
              <input id="event-end-date" name="endDate" type="datetime-local" className="input mt-2" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label block" htmlFor="event-visibility">{t("eventCreate.labelVisibility", "Visibility")}</label>
            <select id="event-visibility" name="visibility" className="input mt-2" value={form.visibility} onChange={(e) => update("visibility", e.target.value)}>
              <option value="public">{t("eventCreate.visibility.public", "Public")}</option>
              <option value="private">{t("eventCreate.visibility.private", "Private")}</option>
            </select>
          </div>

          {error && <div className="text-sm text-rose-500">{error || t("eventCreate.errorCreate", "Could not create event.")}</div>}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? t("eventCreate.creating", "Creating…") : t("eventCreate.submit", "Create event")}</button>
            <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>{t("eventCreate.cancel", "Cancel")}</button>
          </div>
        </form>
      </section>
    </main>
  );
}
