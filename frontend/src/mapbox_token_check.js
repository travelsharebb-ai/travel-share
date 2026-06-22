// Lightweight dev-time token check — safe no-op in production
const token = import.meta.env.VITE_MAPBOX_TOKEN || "";
if (!token) {
  // warn only in dev
  if (typeof window !== 'undefined') console.warn('VITE_MAPBOX_TOKEN is not set — Mapbox features will be disabled.');
} else {
  if (typeof window !== 'undefined') console.log('VITE_MAPBOX_TOKEN present');
}

export default {};
