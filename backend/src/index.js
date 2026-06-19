import "dotenv/config";
import { createApp } from "./app.js";
import { requireEnv } from "./utils/env.js";
import { runStartupChecks } from "./utils/startupChecks.js";

// Ensure absolutely required envs are present (throws if missing)
requireEnv(["DATABASE_URL", "JWT_SECRET"]);

const port = Number(process.env.PORT || 10000);
const app = createApp();

(async () => {
  // Run non-fatal startup checks and print friendly guidance
  try {
    const issues = await runStartupChecks();
    if (Array.isArray(issues) && issues.length) {
      console.log('Startup checks:');
      for (const it of issues) {
        const prefix = it.level === 'error' ? 'ERROR' : it.level === 'warning' ? 'WARN' : 'INFO';
        for (const m of it.messages) console.log(`${prefix}: ${m}`);
      }
    }
  } catch (err) {
    console.warn('Startup checks failed:', err && err.message);
  }

  app.listen(port, () => {
    console.log(`Travel Share API listening on ${port}`);
  });
})();
