const BASE = process.env.BASE_URL || "http://localhost:10000";
const QR_TOKEN = process.env.CI_QR_TOKEN;

let failed = false;

function log(label, ok, details = "") {
  if (!ok) failed = true;
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
  if (details) console.log(`  -> ${details}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function payloadArray(json, key) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.[key])) return json[key];
  return null;
}

function looksLikeHtml(body) {
  return typeof body === "string" && /<!doctype html|<html[\s>]/i.test(body);
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const hasFormBody = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!hasFormBody && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let body = text;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    status: res.status,
    body,
    headers: res.headers,
    contentType: res.headers.get("content-type") || ""
  };
}

async function main() {
  console.log("\n======================");
  console.log(" TRAVEL SHARE PHASE 4 HARDENED AUDIT");
  console.log("======================");

  const health = await request("/health");
  log("System alive", health.status === 200, `status=${health.status}`);

  const events = await request("/api/public/events");
  const publicEvents = payloadArray(events.body, "events");
  log(
    "Public events available",
    events.status === 200 && Array.isArray(publicEvents),
    `status=${events.status} count=${publicEvents?.length ?? 0}`
  );

  log("CI_QR_TOKEN configured", Boolean(QR_TOKEN), QR_TOKEN ? "" : "CI_QR_TOKEN missing");

  if (QR_TOKEN) {
    const qr = await request(`/api/public/qr/${encodeURIComponent(QR_TOKEN)}`);
    log("QR resolution works", qr.status === 200, `status=${qr.status}`);
    log(
      "QR response is structured",
      isObject(qr.body) && !looksLikeHtml(qr.body) && !/text\/html/i.test(qr.contentType),
      JSON.stringify(qr.body)
    );
  }

  const upload = await request(`/api/public/qr/${encodeURIComponent(QR_TOKEN || "invalid")}/uploads`, { method: "POST" });
  log("Upload endpoint reachable", upload.status !== 404, `status=${upload.status}`);
  log(
    "Upload response is structured",
    isObject(upload.body) && !looksLikeHtml(upload.body) && !/text\/html/i.test(upload.contentType),
    JSON.stringify(upload.body)
  );

  if (events.status === 200) {
    const sample = publicEvents?.[0];
    log(
      "Event includes location data",
      Boolean(sample && ("location" in sample || "latitude" in sample || "longitude" in sample || "lat" in sample || "lng" in sample)),
      JSON.stringify(sample?.location || sample || null)
    );
  }

  const protectedAttempt = await request("/api/events/test-event/map");
  log("Protected routes require auth", protectedAttempt.status === 401 || protectedAttempt.status === 403, `status=${protectedAttempt.status}`);

  console.log("\n======================");
  console.log(`PHASE 4 RESULT: ${failed ? "FAIL" : "PASS"}`);
  console.log("======================\n");

  if (failed) process.exit(1);
}

main().catch((error) => {
  log("Phase 4 audit crashed", false, error?.stack || String(error));
  console.log("\nPHASE 4 RESULT: FAIL\n");
  process.exit(1);
});
