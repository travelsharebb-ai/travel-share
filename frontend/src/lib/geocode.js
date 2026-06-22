export async function reverseGeocode(lat, lng) {
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
