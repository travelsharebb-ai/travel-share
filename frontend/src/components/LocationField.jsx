import { useLanguage } from "../lib/i18n";
import React, { useEffect, useId, useState, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { reverseGeocode } from "../lib/geocode";

export default function LocationField({
  id,
  name,
  value,
  onChange,
  latitude,
  longitude,
  onLatChange,
  onLngChange,
  placeholder
}) {
  const { t } = useLanguage();
  const generatedId = useId();
  const fieldId = id || `location-${generatedId}`;
  const fieldName = name || fieldId;
  const latitudeId = `${fieldId}-latitude`;
  const longitudeId = `${fieldId}-longitude`;
  const inputPlaceholder = placeholder || t("admin.moderation.location");
  const coordsPresent = latitude !== undefined && latitude !== null && latitude !== "" && longitude !== undefined && longitude !== null && longitude !== "";
  const mapsQuery = coordsPresent ? `${latitude},${longitude}` : value;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery || "")}`;
  const earthHref = `https://earth.google.com/web/search/${encodeURIComponent(mapsQuery || "")}`;
  const appMapHref = coordsPresent ? `/map?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}` : "/map";

  const [query, setQuery] = useState(value || "");
  const [suggestions, setSuggestions] = useState([]);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
  const abortRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    if (!token) return; // no token -> no autocomplete
    if (!query || query.length < 3 || query === t("map.currentLocation", "Current location")) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      (async () => {
        try {
          const results = await searchLocationSuggestions(query, token, controller.signal);
          setSuggestions(results);
        } catch (e) {
          if (e.name !== 'AbortError') console.error('Place autocomplete failed', e);
        }
      })();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, token]);

  function chooseSuggestion(s) {
    setLocationMessage("");
    setQuery(s.place);
    setSuggestions([]);
    onChange && onChange(s.place);
    if (s.center && s.center.length === 2) {
      onLngChange && onLngChange(String(s.center[0]));
      onLatChange && onLatChange(String(s.center[1]));
    }
  }

  function centerOnMe() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage(t("upload.locationUnavailable", "Location is not available on this device."));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = String(position.coords.latitude);
          const lng = String(position.coords.longitude);
          onLatChange && onLatChange(lat);
          onLngChange && onLngChange(lng);
          setLocationMessage(t("upload.resolvingAddress", "Finding address..."));
          const place = await reverseGeocode(lat, lng, { exactAddressOnly: true });
          if (place) {
            setQuery(place);
            onChange && onChange(place);
            setLocationMessage("");
          } else {
            const fallbackLocation = t("map.currentLocation", "Current location");
            setQuery(fallbackLocation);
            onChange && onChange(fallbackLocation);
            setLocationMessage(t("upload.addressLookupFailed", "Coordinates were found, but no address was returned. Type or choose an address."));
          }
        } catch (error) {
          console.error("Location lookup failed", error);
          const fallbackLocation = t("map.currentLocation", "Current location");
          setQuery(fallbackLocation);
          onChange && onChange(fallbackLocation);
          setLocationMessage(t("upload.addressLookupFailed", "Coordinates were found, but no address was returned. Type or choose an address."));
        } finally {
          setSuggestions([]);
          setLocating(false);
        }
      },
      () => {
        setLocationMessage(t("upload.locationPermissionDenied", "Unable to read your location. You can enter it manually."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  function clearLocation() {
    setQuery("");
    setSuggestions([]);
    setLocationMessage("");
    onChange && onChange("");
    onLatChange && onLatChange("");
    onLngChange && onLngChange("");
  }

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={fieldId}
          name={fieldName}
          className="field pr-12"
          placeholder={inputPlaceholder}
          value={query || ""}
          onChange={(e) => { setQuery(e.target.value); onChange && onChange(e.target.value); }}
          aria-autocomplete={token ? "list" : "none"}
          aria-label={inputPlaceholder}
        />
        <button
          className="location-clear-button absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center p-0"
          type="button"
          onClick={clearLocation}
          aria-label={t("upload.clearLocation", "Clear location")}
          title={t("upload.clearLocation", "Clear location")}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {locationMessage ? <p className="form-help mt-2">{locationMessage}</p> : null}
      {token && suggestions.length > 0 && (
        <ul className="location-suggestions absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border p-1" role="listbox">
          {suggestions.map((s) => (
            <li key={s.id} role="option" tabIndex={0} className="location-suggestion-option cursor-pointer p-2" onClick={() => chooseSuggestion(s)} onKeyDown={(e) => { if (e.key === 'Enter') chooseSuggestion(s); }}>{s.place}</li>
          ))}
        </ul>
      )}
      <div className="mt-2 grid gap-2 sm:flex sm:items-center">
        <div className="flex gap-2 items-center">
          <input
            id={latitudeId}
            name={`${fieldName}Latitude`}
            className="field w-36"
            placeholder={t("hardcoded.lat")}
            aria-label={t("hardcoded.lat")}
            value={latitude || ""}
            onChange={(e) => onLatChange && onLatChange(e.target.value)}
          />
          <input
            id={longitudeId}
            name={`${fieldName}Longitude`}
            className="field w-36"
            placeholder={t("hardcoded.lng")}
            aria-label={t("hardcoded.lng")}
            value={longitude || ""}
            onChange={(e) => onLngChange && onLngChange(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-2 text-sm" type="button" onClick={centerOnMe} disabled={locating}>
            {locating ? t("upload.locating", "Locating...") : t("map.centerOnMe", "Center on Me")}
          </button>
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={mapsHref}>{t("hardcoded.openInGoogleMaps")}</a>
          <a className="text-sm text-primary" target="_blank" rel="noreferrer" href={earthHref}>{t("hardcoded.openInGoogleEarth")}</a>
          <a className="text-sm text-primary" href={appMapHref}>{t("map.openTravelShareMap", "Open TravelShare Map")}</a>
        </div>
      </div>
    </div>
  );
}

async function searchLocationSuggestions(query, token, signal) {
  const mapboxSuggestions = await searchMapboxSuggestions(query, token, signal);
  const hasBarbadosStreetLikeResult = mapboxSuggestions.some((item) => item.kind === "address" || item.kind === "poi");
  if (hasBarbadosStreetLikeResult && mapboxSuggestions.length >= 4) return mapboxSuggestions;

  const osmSuggestions = await searchNominatimSuggestions(query, signal);
  return mergeSuggestions(mapboxSuggestions, osmSuggestions).slice(0, 8);
}

async function searchMapboxSuggestions(query, token, signal) {
  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    limit: "8",
    country: "bb",
    proximity: "-59.5432,13.1939",
    types: "address,poi,place,locality,neighborhood"
  });
  const q = encodeURIComponent(`${query} Barbados`);
  const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?${params.toString()}`, { signal });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (data.features || []).map((f) => ({
    id: `mapbox-${f.id}`,
    place: f.place_name,
    center: f.center,
    kind: Array.isArray(f.place_type) ? f.place_type[0] : "place"
  }));
}

async function searchNominatimSuggestions(query, signal) {
  if (!query || query.length < 4) return [];
  const params = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "6",
    countrycodes: "bb",
    q: query
  });
  const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, { signal });
  if (!resp.ok) return [];
  const data = await resp.json();
  return (Array.isArray(data) ? data : []).map((item) => ({
    id: `osm-${item.osm_type}-${item.osm_id}`,
    place: item.display_name,
    center: [Number(item.lon), Number(item.lat)],
    kind: item.type || "place"
  })).filter((item) => item.place && item.center.every(Number.isFinite));
}

function mergeSuggestions(primary, fallback) {
  const seen = new Set();
  return [...primary, ...fallback].filter((item) => {
    const key = item.place.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
