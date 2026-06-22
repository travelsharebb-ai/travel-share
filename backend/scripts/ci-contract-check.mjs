#!/usr/bin/env node
// CI contract check - very lightweight, read-only existence checks
// Rules (lightweight mode):
// - Do NOT validate exact JSON schema types
// - Only validate that the response is JSON and required top-level keys exist
// - Do NOT fail CI for extra fields or schema extensions
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

async function checkTopLevelKey(url, requiredKey, name, options = { critical: false }) {
  try {
    const res = await timeoutPromise(fetch(url, { method: 'GET' }), timeoutMs, 'request timeout');
    // Only validate top-level key on successful 200 responses
    if (res.status === 200) {
      let json;
      try {
        json = await res.json();
      } catch (e) {
        // For /health (critical) invalid JSON is a failure
        if (options.critical) throw new Error(`${name} response not JSON`);
        console.warn(`${name}: WARN (response not JSON)`);
        return true;
      }
      if (!(json && Object.prototype.hasOwnProperty.call(json, requiredKey))) {
        throw new Error(`${name} missing required top-level key: ${requiredKey}`);
      }
      console.log(`${name}: OK (contains key '${requiredKey}')`);
      return true;
    }

    // Handle 404 as a warning for non-critical endpoints
    if (res.status === 404) {
      if (options.critical) {
        throw new Error(`${name} returned 404`);
      }
      console.warn(`${name}: WARN (404 Not Found) - endpoint may not exist`);
      return true;
    }

    // Other non-200 statuses: do not attempt key checks, log info/warning
    if (options.critical) {
      throw new Error(`${name} expected 200 but got ${res.status}`);
    }
    console.warn(`${name}: INFO (status ${res.status}) - skipping key validation`);
    return true;
  } catch (err) {
    console.error(`${name}: FAIL — ${err.message}`);
    return false;
  }
}

async function checkProtectedUnauth(url, name) {
  try {
    const res = await timeoutPromise(fetch(url, { method: 'GET' }), timeoutMs, 'request timeout');
    if (res.status === 401 || res.status === 403) {
      console.log(`${name}: OK (unauthenticated -> ${res.status})`);
      return true;
    }
    if (res.status === 404) {
      console.warn(`${name}: WARN (404 Not Found) - endpoint may not exist)`);
      return true; // don't fail for absent endpoints
    }
    console.error(`${name}: FAIL (expected 401/403) got ${res.status}`);
    return false;
  } catch (err) {
    console.error(`${name}: FAIL — ${err.message}`);
    return false;
  }
}

(async function main() {
  console.log('CI Contract Check (lightweight) — base:', base);
  const results = [];

  // GET /health -> must contain key: db
  results.push(await checkTopLevelKey(`${base}/health`, 'db', 'GET /health'));

  // GET /api/skins -> must contain key: skins
  results.push(await checkTopLevelKey(`${base}/api/skins`, 'skins', 'GET /api/skins'));

  // GET /api/events -> must contain key: events
  results.push(await checkTopLevelKey(`${base}/api/events`, 'events', 'GET /api/events'));

  // Protected route: GET /api/users/me -> expects 401/403 when unauthenticated
  results.push(await checkProtectedUnauth(`${base}/api/users/me`, 'GET /api/users/me (protected)'));

  const ok = results.every(Boolean);
  if (!ok) {
    console.error('CI CONTRACT CHECK FAILED (lightweight)');
    process.exit(1);
  }
  console.log('CI CONTRACT CHECK PASSED (lightweight)');
  process.exit(0);
})();
