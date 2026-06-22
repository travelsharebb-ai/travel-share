import { warnIfPlaceholderSecrets, listOptionalEnvRecommendations } from './env.js';
import diagnostics from './diagnostics.js';

export async function runStartupChecks() {
  const issues = [];
  const warnings = warnIfPlaceholderSecrets();
  if (warnings.length) {
    issues.push({ level: 'warning', messages: warnings });
  }

  const missingRecommended = listOptionalEnvRecommendations();
  if (missingRecommended.length) {
    issues.push({ level: 'info', messages: [`Recommended envs unset: ${missingRecommended.join(', ')}`] });
  }

  // Basic DB connectivity check (non-fatal here)
  const dbCheck = await diagnostics.checkDbConnection();
  if (!dbCheck.ok) {
    issues.push({ level: 'error', messages: [`Database connectivity check failed: ${dbCheck.error}`] });
  }

  // Migration consistency is useful but non-blocking — report mismatches
  const cmp = await diagnostics.compareMigrations().catch((e) => ({ error: String(e) }));
  if (cmp && cmp.error) {
    issues.push({ level: 'warning', messages: [`Migration compare error: ${cmp.error}`] });
  } else if (cmp && (cmp.missingInDb?.length || cmp.extraInDb?.length)) {
    const msgs = [];
    if (cmp.missingInDb?.length) msgs.push(`Local migrations not applied in DB: ${cmp.missingInDb.join(', ')}`);
    if (cmp.extraInDb?.length) msgs.push(`Applied DB migrations not present locally: ${cmp.extraInDb.join(', ')}`);
    issues.push({ level: 'warning', messages: msgs });
  }

  return issues;
}

export default { runStartupChecks };
