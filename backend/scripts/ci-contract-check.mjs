#!/usr/bin/env node
// CI contract check - lightweight, read-only checks
// Usage: node backend/scripts/ci-contract-check.mjs [BASE_URL]

const fetch = global.fetch || (await import('node-fetch')).default;
const base = process.argv[2] || process.env.BASE_URL || 'http://localhost:10000';
const timeoutMs = 10000;

function timeoutPromise(p, ms, msg) {
  return Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error(msg || 'timeout')), ms)),
  ]);
}

async function checkJSON(url, expectedShapeFn, name) {
  try {
    const res = await timeoutPromise(fetch(url, { method: 'GET' }), timeoutMs, 'request timeout');
    if (res.status !== 200) {
      throw new Error(`${name} expected 200 but got ${res.status}`);
    }
    const json = await res.json();
    const ok = expectedShapeFn(json);
    if (!ok) throw new Error(`${name} response shape invalid: ${JSON.stringify(json)}`);
    console.log(`${name}: OK`);
    return true;
  } catch (err) {
    console.error(`${name}: FAIL — ${err.message}`);
    return false;
  }
}

async function checkProtected(url, name) {
  try {
    const res = await timeoutPromise(fetch(url, { method: 'GET' }), timeoutMs, 'request timeout');
    if (res.status === 401 || res.status === 403) {
      console.log(`${name}: OK (unauthenticated -> ${res.status})`);
      return true;
    }
    // 404 treat as warning
    if (res.status === 404) {
      console.warn(`${name}: WARN (404 Not Found) - endpoint may not exist`);
      return true;
    }
    // Any 2xx/3xx is unexpected
    console.error(`${name}: FAIL (expected 401/403) got ${res.status}`);
    return false;
  } catch (err) {
    console.error(`${name}: FAIL — ${err.message}`);
    return false;
  }
}

(async function main() {
  console.log('CI Contract Check — base:', base);
  const checks = [];

  // /health -> { db: "ok" }
  checks.push(await checkJSON(`${base}/health`, (j) => j && j.db === 'ok', 'GET /health'));

  // /api/skins -> { skins: Array }
  checks.push(await checkJSON(`${base}/api/skins`, (j) => j && Array.isArray(j.skins), 'GET /api/skins'));

  // /api/events -> { events: Array }
  checks.push(await checkJSON(`${base}/api/events`, (j) => j && Array.isArray(j.events), 'GET /api/events'));

  // /api/public (wildcard) - try /api/public, warn if not present
  try {
    const res = await timeoutPromise(fetch(`${base}/api/public`, { method: 'GET' }), timeoutMs, 'request timeout');
    if (res.status === 200) {
      try {
        const json = await res.json();
        console.log('GET /api/public: OK (200)');
      } catch (e) {
        console.warn('GET /api/public: WARN (non-JSON response)');
      }
    } else if (res.status === 404) {
      console.warn('GET /api/public: WARN (404 Not Found)');
    } else {
      console.warn(`GET /api/public: WARN (${res.status})`);
    }
  } catch (err) {
    console.warn('GET /api/public: WARN —', err.message);
  }

  // Protected route check: /api/users/me -> expect 401/403 when unauthenticated
  checks.push(await checkProtected(`${base}/api/users/me`, 'GET /api/users/me (protected)'));

  // Evaluate results: fail CI if any critical check failed
  const allGood = checks.every(Boolean);
  if (!allGood) {
    console.error('CI CONTRACT CHECK FAILED');
    process.exit(1);
  }
  console.log('CI CONTRACT CHECK PASSED');
  process.exit(0);
})();
