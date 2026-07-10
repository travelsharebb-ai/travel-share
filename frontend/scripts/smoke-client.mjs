const BASE = process.env.PREVIEW_URL || 'http://localhost:5173';
const routes = [
  '/',
  '/login',
  '/signup',
  '/guest',
  '/dashboard',
  '/trips',
  '/trips/new',
  '/events',
  '/events/new',
  '/map',
  '/store',
  '/scan',
  '/settings',
  '/qr-spaces',
  '/qr-spaces/new',
  '/qr/abc123',
  '/qr/abc123/upload',
  '/admin'
];

async function checkRoute(path) {
  const url = BASE + path;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const text = await res.text();
      const ok = res.status === 200;
      console.log(path, 'status:', res.status);
      if (!ok) return false;
      if (!text.includes('<div id="root">')) {
        console.warn(path, 'did not return the Vite app shell');
        return false;
      }
      return true;
    } finally {
      clearTimeout(timeout);
    }
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
