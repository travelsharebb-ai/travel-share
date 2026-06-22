// Chooses an available map provider implementation at runtime.
import mapboxProvider from './mapboxProvider.js';

function hasMapboxToken() {
  return Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
}

let provider = null;
if (hasMapboxToken()) {
  provider = mapboxProvider;
} else {
  // minimal stub provider to avoid runtime crashes when no token present
  provider = {
    createMap: () => { throw new Error('No map provider configured. Set VITE_MAPBOX_TOKEN to use Mapbox.'); },
    addMarker: () => { throw new Error('No map provider configured.'); },
    searchPlaces: async () => { return []; },
    reverseGeocode: async () => { return null; },
  };
}

export default provider;
