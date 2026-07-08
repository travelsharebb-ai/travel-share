import { useLanguage } from "../lib/i18n";
import React, { useEffect, useState, useRef } from "react";

export default function LocationField({
  value,
  onChange,
  latitude,
  longitude,
  onLatChange,
  onLngChange,
  placeholder={t("admin.moderation.location")}
}) {
  const { t } = useLanguage();
  const coordsPresent = latitude && longitude;
  const mapsQuery = coordsPresent ? `${latitude},${longitude}` : value;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || "")}`;
  const earthHref = `https://earth.google.com/web/search/${encodeURIComponent(mapsQuery || "")}`;

  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
  const abortRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    if (!token) return; // no token -> no autocomplete
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const q = encodeURIComponent(query);
        const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${token}&autocomplete=true&limit=6` , { signal: controller.signal });
        if (!resp.ok) return;
        const data = await resp.json();
        setSuggestions((data.features || []).map((f) => ({ id: f.id, place: f.place_name, center: f.center })));
      } catch (e) {
        if (e.name !== 'AbortError') console.error('Place autocomplete failed', e);
      }
    })();

    return () => controller.abort();
  }, [query, token]);

  function chooseSuggestion(s) {
    setQuery(s.place);
    setSuggestions([]);
    onChange && onChange(s.place);
    if (s.center && s.center.length === 2) {
      onLngChange && onLngChange(String(s.center[0]));
      onLatChange && onLatChange(String(s.center[1]));
    }
  }

  return (
    <div className="relative">
      <input className="field" placeholder={placeholder} value={query || ""} onChange={(e) => { setQuery(e.target.value); onChange && onChange(e.target.value); }} aria-autocomplete={token ? "list" : "none"} />
      {token && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-borderline bg-panel p-1" role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} role="option" tabIndex={0} className="cursor-pointer p-2 hover:bg-skysoft" onClick={() => chooseSuggestion(s)} onKeyDown={(e) => { if (e.key === 'Enter') chooseSuggestion(s); }}>{s.place}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid gap-2 sm:flex sm:items-center">
        <div className="flex gap-2 items-center">
          <input className="field w-36" placeholder={t("hardcoded.lat")} value={latitude || ""} onChange={(e) => onLatChange && onLatChange(e.target.value)} />
          <input className="field w-36" placeholder={t("hardcoded.lng")} value={longitude || ""} onChange={(e) => onLngChange && onLngChange(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={mapsHref}>{t("hardcoded.openInGoogleMaps")}</a>
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={earthHref}>{t("hardcoded.openInGoogleEarth")}</a>
        </div>
      </div>
    </div>
  );
}
