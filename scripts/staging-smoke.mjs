const frontend = process.env.STAGING_FRONTEND_URL;
const backend = process.env.STAGING_BACKEND_URL;

if (!frontend || !backend) {
  console.error("Missing STAGING_FRONTEND_URL or STAGING_BACKEND_URL.");
  process.exit(1);
}
if (process.env.CONFIRM_STAGING_SMOKE !== "true") {
  console.error("Set CONFIRM_STAGING_SMOKE=true only after confirming both URLs point to staging.");
  process.exit(1);
}

async function check(label, url, validate) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  const body = await response.text();
  if (!response.ok || (validate && !validate(body))) throw new Error(`${label} failed with HTTP ${response.status}.`);
  console.log(`PASS ${label}`);
}

try {
  await check("frontend", frontend, (body) => body.includes("id=\"root\""));
  await check("backend health", new URL("/health", backend), (body) => JSON.parse(body).ok === true);
  await check("public events", new URL("/api/public/events", backend), (body) => Array.isArray(JSON.parse(body).events));
  await check("public ads", new URL("/api/ads?placement=global", backend), (body) => Array.isArray(JSON.parse(body).ads));
  console.log("Non-mutating staging checks passed. Complete docs/STAGING_SMOKE_TEST.md manually.");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
