import fetch from 'node-fetch';

const BASE = process.env.PREVIEW_URL || 'http://localhost:5173';
const routes = ['/', '/tourist', '/events', '/trips/test-id/upload', '/qr/abc123/upload'];

async function checkRoute(path) {
  const url = BASE + path;
  try {
    const res = await fetch(url, { timeout: 5000 });
    const text = await res.text();
    const ok = res.status === 200;
    console.log(path, 'status:', res.status);
    if (!ok) return false;
    // Basic content checks
    if (path.includes('/upload')) {
      if (!/Upload a memory|Upload memory to album|Upload memory/.test(text)) {
        console.warn(path, 'did not contain expected upload text');
        return false;
      }
    }
    if (path.includes('/trips')) {
      if (!/Upload memory to album|Create trip|Tourist Album/.test(text)) {
        console.warn(path, 'did not contain expected trip upload/create text');
        return false;
      }
    }
    // check for map fallback message in built HTML (MemoryMap and EventMap)
    if (!/Map failed to load|Set `VITE_MAPBOX_TOKEN`/.test(text)) {
      // not required on all pages; just log presence
    } else {
      console.log(path, 'contains map fallback banner');
    }
    return true;
  } catch (e) {
    console.error('Error fetching', url, e.message);
    return false;
  }
}

(async function () {
  let all = true;
  for (const r of routes) {
    const ok = await checkRoute(r);
    all = all && ok;
  }
  if (!all) process.exitCode = 2;
  else console.log('Client smoke tests passed');
})();
