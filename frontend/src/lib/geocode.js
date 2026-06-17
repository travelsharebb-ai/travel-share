export async function reverseGeocode(lat, lng) {
  // Prefer server-side geocode proxy when available
  try {
    const proxy = await fetch("/api/public/settings").then((r) => r.ok ? r.json().catch(() => null) : null).catch(() => null);
    const serverAvailable = proxy && proxy.settings && proxy.settings.serverGeocode;
    if (serverAvailable) {
      const resp = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`);
      if (resp.ok) {
        const data = await resp.json();
        return data?.features?.[0]?.place_name || null;
      }
      // If server proxy responds but no data, fall through to client token method
    }
  } catch (err) {
    // ignore and fallback
  }

  const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
  if (!token) return null;
  try {
    const resp = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${token}&limit=1`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.features?.[0]?.place_name || null;
  } catch (e) {
    return null;
  }
}
