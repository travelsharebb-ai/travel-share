import fetch from 'node-fetch';

async function probe() {
  const base = process.env.FRONTEND_URL || 'http://localhost:5173';
  const api = base.replace(/\/$/, '') + '/api/geocode/search?q=San%20Jose';
  try {
    const resp = await fetch(api, { timeout: 5000 });
    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Body (truncated):', text.slice(0, 1000));
    if (resp.status === 501) {
      console.log('Geocode proxy not configured (501). Set MAPBOX_TOKEN or platform setting "mapboxToken".');
      process.exit(2);
    }
    if (!resp.ok) {
      console.error('Geocode probe failed');
      process.exit(3);
    }
    console.log('Geocode proxy appears to be responding.');
    process.exit(0);
  } catch (err) {
    console.error('Error probing geocode proxy:', err.message || err);
    process.exit(4);
  }
}

probe();
