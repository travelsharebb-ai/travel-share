import "dotenv/config";
import { productionEnvIssues } from "../src/utils/env.js";

const backend = productionEnvIssues(process.env);
const frontendMissing = ["VITE_API_URL", "VITE_APP_NAME", "VITE_SUPPORT_EMAIL", "VITE_MAPBOX_TOKEN"]
  .filter((name) => !process.env[name]);
const paymentsEnabled = ["stripe", "both"].includes(String(process.env.PAYMENT_PROVIDER || "disabled").toLowerCase());
if (paymentsEnabled && !process.env.VITE_STRIPE_PUBLISHABLE_KEY) frontendMissing.push("VITE_STRIPE_PUBLISHABLE_KEY");

if (backend.missing.length) console.error(`Missing backend variables: ${backend.missing.join(", ")}`);
if (backend.weak.length) console.error(`Weak backend variables: ${backend.weak.join(", ")}`);
if (frontendMissing.length) console.error(`Missing frontend variables: ${frontendMissing.join(", ")}`);
if (backend.missing.length || backend.weak.length || frontendMissing.length) process.exit(1);
console.log("Production environment names and secret strength checks passed.");
