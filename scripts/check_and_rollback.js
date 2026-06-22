#!/usr/bin/env node
/*
 * check_and_rollback.js
 * Runs frontend build and prisma migrate status checks for Phase 3.
 * If any check fails, it will run the safe rollback script.
 * This script is conservative and non-destructive: it creates a backup branch first.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rollScript = path.join(root, 'scripts', 'auto_rollback.sh');

function run(cmd, args, opts = {}) {
  const out = spawnSync(cmd, args, Object.assign({ stdio: 'inherit', shell: false }, opts));
  return out.status === 0;
}

console.log('Phase3 preflight checks: frontend build and prisma migrate status');

// 1) Frontend build (non-destructive) — run in the frontend folder
console.log('\nRunning frontend build (this may take a moment)...');
const buildOk = run('npm', ['run', 'build'], { cwd: path.join(root, 'frontend') });
if (!buildOk) {
  console.error('\nFrontend build failed. Triggering rollback.');
  run(rollScript, []);
  process.exit(2);
}

// 2) Prisma migrate status (non-destructive check)
console.log('\nChecking prisma migrate status...');
const prismaOk = run('npx', ['prisma', 'migrate', 'status', '--schema=prisma/schema.prisma'], { cwd: path.join(root, 'backend') });
if (!prismaOk) {
  console.error('\nPrisma migrate status reported an issue. Triggering rollback.');
  run(rollScript, []);
  process.exit(3);
}

console.log('\nAll checks passed. No rollback needed.');
process.exit(0);
