export async function reverseGeocode(lat, lng, options = {}) {
  const mapboxAddress = await reverseGeocodeWithMapbox(lat, lng, options);
  if (mapboxAddress) return mapboxAddress;

  if (options.exactAddressOnly) {
    const osmAddress = await reverseGeocodeWithNominatim(lat, lng);
    if (osmAddress) return osmAddress;

    const googleAddress = await reverseGeocodeWithGoogleMapsJs(lat, lng);
    if (googleAddress) return googleAddress;

    return reverseGeocodeWithMapbox(lat, lng, { exactAddressOnly: false });
  }

  return null;
}

async function reverseGeocodeWithMapbox(lat, lng, options = {}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
  if (!token) return null;
  if (options.exactAddressOnly) {
    const address = await fetchMapboxReverseGeocode(lat, lng, token, "address", options);
    if (address) return address;

    const poi = await fetchMapboxReverseGeocode(lat, lng, token, "poi", options);
    if (poi) return poi;
  } else {
    const address = await fetchMapboxReverseGeocode(lat, lng, token, "", options);
    if (address) return address;
  }

  return null;
}

async function fetchMapboxReverseGeocode(lat, lng, token, types, options = {}) {
  const typeQuery = types ? `&types=${types}` : "";
  const limit = types ? 5 : 1;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${token}&limit=${limit}${typeQuery}`, { signal: controller.signal });
    if (!resp.ok) {
      console.warn("Mapbox reverse geocode failed", resp.status);
      return null;
    }
    const data = await resp.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const feature = options.exactAddressOnly ? pickBestMapboxAddress(features) : features[0];
    return feature?.place_name || null;
  } catch (e) {
    console.warn("Mapbox reverse geocode failed", e);
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

let googleReverseGeocodeDisabled = false;

async function reverseGeocodeWithGoogleMapsJs(lat, lng) {
  if (googleReverseGeocodeDisabled || typeof window === "undefined") return null;
  const GoogleGeocoder = window.google?.maps?.Geocoder;
  if (!GoogleGeocoder) return null;

  const geocoder = new GoogleGeocoder();
  const location = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), 8000);
    geocoder.geocode({ location }, (results, status) => {
      window.clearTimeout(timeoutId);
      if (status === "REQUEST_DENIED") {
        googleReverseGeocodeDisabled = true;
        resolve(null);
        return;
      }
      if (status !== "OK" || !Array.isArray(results)) {
        resolve(null);
        return;
      }
      const result = pickBestGoogleAddress(results);
      resolve(result?.formatted_address || null);
    });
  });
}

async function reverseGeocodeWithNominatim(lat, lng) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      lat: String(lat),
      lon: String(lng),
      zoom: "18"
    });
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, { signal: controller.signal });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.address?.country_code && data.address.country_code !== "bb") return null;
    return data?.display_name || null;
  } catch (e) {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function pickBestGoogleAddress(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const ranked = results
    .map((result) => ({ result, score: scoreGoogleAddress(result) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.result || null;
}

function scoreGoogleAddress(result) {
  if (!result || !Array.isArray(result.types)) return 0;
  let score = 0;
  if (result.types.includes("street_address")) score += 100;
  if (result.types.includes("premise")) score += 90;
  if (result.types.includes("subpremise")) score += 90;
  if (result.types.includes("point_of_interest") || result.types.includes("establishment")) score += 75;
  if (hasStreetNumberAndRoute(result)) score += 50;
  if (result.types.includes("route")) score += 30;
  if (result.types.some((type) => ["locality", "administrative_area_level_1", "country", "postal_code"].includes(type))) score -= 100;
  return score;
}

function hasStreetNumberAndRoute(result) {
  return Array.isArray(result.address_components)
    && result.address_components.some((part) => part.types?.includes("street_number"))
    && result.address_components.some((part) => part.types?.includes("route"));
}

function pickBestMapboxAddress(features) {
  if (!Array.isArray(features) || features.length === 0) return null;
  return features.find((item) => item.place_type?.includes("address"))
    || features.find((item) => item.place_type?.includes("poi"))
    || features.find((item) => item.address && item.text)
    || features[0];
}
