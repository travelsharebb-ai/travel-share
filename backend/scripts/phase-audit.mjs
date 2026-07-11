const BASE = process.env.BASE_URL || "http://localhost:10000";

const PRIMARY_QR_TOKEN = "test-ci-token";

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
  return skins.some(
    (skin) =>
      Number(skin.priceCents || 0) === 0 ||
      skin.metadata?.unlockType === "included" ||
      skin.metadata?.category === "basic"
  );
}

function hasPremiumSkin(skins) {
  return skins.some(
    (skin) =>
      Number(skin.priceCents || 0) > 0 ||
      skin.metadata?.isPremium === true ||
      skin.metadata?.category === "premium"
  );
}

async function phase1() {
  console.log("\n=== PHASE 1: INFRASTRUCTURE ===");

  const health = await request("/health");
  expectStatus("Health endpoint returns 200", health, 200);
  assert("DB connected", health.json.db === "ok", JSON.stringify(health.json));
}

async function phase2() {
  console.log("\n=== PHASE 2: SKINS SYSTEM ===");

  const skinsResponse = await request("/api/skins");
  expectStatus("Skin list endpoint returns 200", skinsResponse, 200);

  const skins = payloadArray(skinsResponse.json, "skins");

  assert("Skins exist", Array.isArray(skins) && skins.length > 0);

  assert("Free skins exist", hasFreeSkin(skins));

  assert("Premium skins exist", hasPremiumSkin(skins));
}

async function phase3() {
  console.log("\n=== PHASE 3: MAP SYSTEM ===");

  const eventsResponse = await request("/api/public/events");
  expectStatus("Public events feed returns 200", eventsResponse, 200);

  const events = payloadArray(eventsResponse.json, "events");

  assert("Events exist", Array.isArray(events) && events.length > 0);

  assert(
    "Events have coordinates",
    events.some(
      (e) =>
        Number.isFinite(Number(e.latitude)) &&
        Number.isFinite(Number(e.longitude))
    )
  );

  // ✅ FIXED: NO MORE CI_QR_TOKEN LOGIC
  const qr = await request(`/api/public/qr/${PRIMARY_QR_TOKEN}`);
  expectStatus("QR endpoint works", qr, 200);

  assert("QR response valid", isObject(qr.json));
}

async function main() {
  console.log("\n======================");
  console.log(" TRAVEL SHARE STRICT PHASE AUDIT (FIXED)");
  console.log("======================\n");

  await phase1();
  await phase2();
  await phase3();

  console.log("\n======================");
  console.log("✅ PASSED");
  console.log("======================\n");
}

main().catch((e) => {
  fail("Audit crashed", e?.stack || String(e));
});