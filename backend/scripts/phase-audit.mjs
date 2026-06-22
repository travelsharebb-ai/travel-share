const BASE = process.env.BASE_URL || "http://localhost:10000";
const QR_TOKEN = process.env.CI_QR_TOKEN || process.env.QR_TOKEN || "";

function fail(label, details = "") {
  console.error(`❌ FAILED: ${label}`);
  if (details) console.error(details);
  process.exit(1);
}

function assert(label, condition, details = "") {
  if (!condition) fail(label, details);
  console.log(`✅ ${label}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const text = await res.text();
  let json;

  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return { status: res.status, json };
}

function expectStatus(label, response, expected) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  assert(
    label,
    allowed.includes(response.status),
    `Expected ${allowed.join(" or ")}, got ${response.status}: ${JSON.stringify(response.json)}`
  );
}

function payloadArray(json, key) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.[key])) return json[key];
  return null;
}

function hasFreeSkin(skins) {
  return skins.some((skin) => Number(skin.priceCents || 0) === 0 || skin.metadata?.unlockType === "included" || skin.metadata?.category === "basic");
}

function hasPremiumSkin(skins) {
  return skins.some((skin) => Number(skin.priceCents || 0) > 0 || skin.metadata?.isPremium === true || skin.metadata?.category === "premium");
}

async function phase1() {
  console.log("\n=== PHASE 1: INFRASTRUCTURE ===");

  const health = await request("/health");
  expectStatus("Health endpoint returns 200", health, 200);
  assert("Health response is structured", isObject(health.json), JSON.stringify(health.json));
  assert("DB connected", health.json.db === "ok", JSON.stringify(health.json));
  assert("Migration status exposed", isObject(health.json.migrations), JSON.stringify(health.json));
  assert("No migration errors", !health.json.migrations.error, JSON.stringify(health.json.migrations));
  assert(
    "No missing DB migrations",
    !Array.isArray(health.json.migrations.missingInDb) || health.json.migrations.missingInDb.length === 0,
    JSON.stringify(health.json.migrations)
  );
  assert(
    "No unknown DB migrations",
    !Array.isArray(health.json.migrations.extraInDb) || health.json.migrations.extraInDb.length === 0,
    JSON.stringify(health.json.migrations)
  );

  const auth = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert("Auth route rejects malformed login without 404", auth.status >= 400 && auth.status !== 404, JSON.stringify(auth.json));

  const settings = await request("/api/public/settings");
  expectStatus("Public settings endpoint returns 200", settings, 200);
  assert("Public settings response is structured", isObject(settings.json), JSON.stringify(settings.json));
}

async function phase2() {
  console.log("\n=== PHASE 2: SKINS SYSTEM ===");

  const skinsResponse = await request("/api/skins");
  expectStatus("Skin list endpoint returns 200", skinsResponse, 200);

  const skins = payloadArray(skinsResponse.json, "skins");
  assert("Skins response contains array", Array.isArray(skins), JSON.stringify(skinsResponse.json));
  assert("Skins exist in current DB state", skins.length > 0, JSON.stringify(skinsResponse.json));
  assert("Free skins exist in current DB state", hasFreeSkin(skins), JSON.stringify(skins));
  assert(
    "Every skin has expected structure",
    skins.every((skin) => isObject(skin) && typeof skin.id === "string" && typeof skin.name === "string" && skin.type === "image_skin"),
    JSON.stringify(skins)
  );

  const guestApply = await request("/api/uploads/test-upload/skin", {
    method: "PATCH",
    body: JSON.stringify({ skinId: skins[0].id }),
  });
  expectStatus("Unauthenticated skin apply is blocked", guestApply, [401, 403]);

  const purchase = await request("/api/store/test/purchase", {
    method: "POST",
    body: JSON.stringify({}),
  });
  expectStatus("Store purchase requires auth", purchase, [401, 403]);

  assert("Premium skins exist in current DB state", hasPremiumSkin(skins), JSON.stringify(skins));
  const premium = skins.find((skin) => Number(skin.priceCents || 0) > 0 || skin.metadata?.isPremium === true || skin.metadata?.category === "premium");
  const activate = await request(`/api/store/${premium.id}/activate`, { method: "POST" });
  expectStatus("Premium activation requires auth/ownership", activate, [401, 403]);
}

async function phase3() {
  console.log("\n=== PHASE 3: MAP SYSTEM ===");

  const eventsResponse = await request("/api/public/events");
  expectStatus("Public events feed returns 200", eventsResponse, 200);

  const events = payloadArray(eventsResponse.json, "events");
  assert("Events response contains array", Array.isArray(events), JSON.stringify(eventsResponse.json));
  assert("Public events exist in current DB state", events.length > 0, JSON.stringify(eventsResponse.json));
  assert(
    "Events contain expected map fields",
    events.every((event) => isObject(event) && typeof event.id === "string" && typeof event.title === "string" && "latitude" in event && "longitude" in event),
    JSON.stringify(events)
  );
  assert(
    "At least one public event has geo coordinates",
    events.some((event) => Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))),
    JSON.stringify(events)
  );

  const protectedEvents = await request("/api/events");
  expectStatus("Private events route requires auth", protectedEvents, [401, 403]);

  assert("CI_QR_TOKEN configured for real QR validation", Boolean(QR_TOKEN), "Set CI_QR_TOKEN to an existing QR token from the current DB.");
  const qr = await request(`/api/public/qr/${QR_TOKEN}`);
  expectStatus("QR endpoint returns real token payload", qr, 200);
  assert("QR response is structured", isObject(qr.json), JSON.stringify(qr.json));
  assert("QR response contains token-backed resource", Boolean(qr.json.trip || qr.json.event || qr.json.zone), JSON.stringify(qr.json));

  const uploadReject = await request(`/api/public/qr/${QR_TOKEN}/uploads`, { method: "POST" });
  expectStatus("QR upload rejects missing file", uploadReject, [400, 422]);
  assert("QR upload rejection is structured", isObject(uploadReject.json), JSON.stringify(uploadReject.json));
}

async function main() {
  console.log("\n======================");
  console.log(" TRAVEL SHARE STRICT PHASE AUDIT");
  console.log("======================\n");

  await phase1();
  await phase2();
  await phase3();

  console.log("\n======================");
  console.log("✅ STRICT AUDIT PASSED - READY FOR DEPLOY");
  console.log("======================\n");
}

main().catch((error) => {
  fail("Audit crashed", error?.stack || String(error));
});
