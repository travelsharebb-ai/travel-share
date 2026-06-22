/* Mapbox provider implementation
 * Exposes: createMap, addMarker, searchPlaces, reverseGeocode
 */
import mapboxgl from 'mapbox-gl';

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const MAPBOX_GEOCODE_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function createMap(container, options = {}) {
  if (!TOKEN) throw new Error('Mapbox token missing');
  mapboxgl.accessToken = TOKEN;
  const map = new mapboxgl.Map(Object.assign({ container, style: 'mapbox://styles/mapbox/streets-v11' }, options));
  return map;
}

export function addMarker(mapInstance, { latitude, longitude }, opts = {}) {
  // mapInstance should be a Mapbox GL `Map` instance or an object exposing `getMap()`.
  let raw = mapInstance;
  if (mapInstance && typeof mapInstance.getMap === 'function') raw = mapInstance.getMap();
  if (!raw || !raw.addLayer) {
    // cannot attach marker directly, return a marker descriptor
    return { id: opts.id || `marker-${Date.now()}`, latitude, longitude };
  }
  const el = document.createElement('div');
  el.className = opts.className || 'mapbox-marker';
  if (opts.html) el.innerHTML = opts.html;
  const marker = new mapboxgl.Marker(el, { anchor: opts.anchor || 'center', draggable: !!opts.draggable })
    .setLngLat([longitude, latitude])
    .addTo(raw);
  if (opts.onDragEnd && opts.draggable) {
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      opts.onDragEnd({ latitude: lngLat.lat, longitude: lngLat.lng });
    });
  }
  return marker;
}

export async function searchPlaces(query, { proximity } = {}) {
  if (!TOKEN) throw new Error('Mapbox token missing');
  const q = encodeURIComponent(query);
  const prox = proximity ? `&proximity=${proximity.longitude},${proximity.latitude}` : '';
  const url = `${MAPBOX_GEOCODE_BASE}/${q}.json?access_token=${TOKEN}&autocomplete=true&limit=5${prox}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox geocoding failed: ${res.status}`);
  const data = await res.json();
  return (data.features || []).map(f => ({ id: f.id, text: f.text, place_name: f.place_name, center: f.center, context: f.context }));
}

export async function reverseGeocode({ latitude, longitude }) {
  if (!TOKEN) throw new Error('Mapbox token missing');
  const url = `${MAPBOX_GEOCODE_BASE}/${longitude},${latitude}.json?access_token=${TOKEN}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox reverse geocode failed: ${res.status}`);
  const data = await res.json();
  const f = (data.features || [])[0];
  return f ? { id: f.id, place_name: f.place_name, center: f.center, raw: f } : null;
}

export default {
  createMap,
  addMarker,
  searchPlaces,
  reverseGeocode,
};
