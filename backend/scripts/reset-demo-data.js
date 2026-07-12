import dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();
const dryRun = process.argv.includes('--dry-run');
const ALLOW_DEMO_DATA = process.env.ALLOW_DEMO_DATA === 'true';
const CONFIRM_DEMO_RESET = process.env.CONFIRM_DEMO_RESET === 'I_UNDERSTAND_THIS_DELETES_DEMO_DATA';
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL || '';
const productionGuard = NODE_ENV === 'production' || /prod|production|live/.test(DATABASE_URL.toLowerCase());

function print(...messages) {
  if (dryRun) {
    console.log('[dry-run]', ...messages);
    return;
  }
  console.log(...messages);
}

function safetyCheck() {
  if (!productionGuard) return;
  if (ALLOW_DEMO_DATA && CONFIRM_DEMO_RESET) return;
  console.error('Refusing to run demo reset script in production-like environment without both ALLOW_DEMO_DATA=true and CONFIRM_DEMO_RESET=I_UNDERSTAND_THIS_DELETES_DEMO_DATA');
  process.exit(1);
}

function runNodeScript(scriptName, args = []) {
  const scriptPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), scriptName);
  print(`Running ${path.basename(scriptName)}${args.length ? ` ${args.join(' ')}` : ''}`);
  const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${scriptName} exited with status ${result.status}`);
  }
}

async function main() {
  safetyCheck();
  print('Demo data reset started');
  const args = dryRun ? ['--dry-run'] : [];
  runNodeScript('clear-demo-data.js', args);
  runNodeScript('seed-demo-data.js', args);
  if (!dryRun) {
    print('Demo data reset complete');
  } else {
    print('Demo data reset dry-run complete');
  }
}

main().catch((error) => {
  console.error('Reset failed:', error);
  process.exit(1);
});
