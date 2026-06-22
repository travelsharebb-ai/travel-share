import { prisma } from './prisma.js';
import fs from 'fs/promises';
import path from 'path';

let lastCheck = 0;
let cached = true;
let inFlight = null;

const TTL = 30000;

export async function checkDB() {
  const now = Date.now();

  // return cached result if still fresh
  if (now - lastCheck < TTL) return cached;

  // prevent duplicate concurrent checks
  if (inFlight) return inFlight;

  inFlight = (async () => {
try {
  await prisma.$queryRaw`SELECT 1`;
  cached = true;
} catch (err) {
  cached = false;
} finally {
  lastCheck = Date.now();
  inFlight = null;
}

    return cached;
  })();

  return inFlight;
}

export async function checkDbConnection() {
  const ok = await checkDB();
  return ok ? { ok: true } : { ok: false, error: 'Database connectivity check failed' };
}

export async function listAppliedMigrations() {
  try {
    const rows = await prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations ORDER BY finished_at');
    return Array.isArray(rows) ? rows.map((r) => (r.migration_name || r[0])) : [];
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

export async function listLocalMigrations() {
  try {
    const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations');
    const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((d) => d.name).sort();
  } catch (err) {
    return { error: String(err.message || err) };
  }
}

export async function compareMigrations() {
  const applied = await listAppliedMigrations();
  const local = await listLocalMigrations();
  if (applied?.error) return { ok: false, error: applied.error };
  if (local?.error) return { ok: false, error: local.error };
  const missingInDb = local.filter((m) => !applied.includes(m));
  const extraInDb = applied.filter((m) => !local.includes(m));
  return { ok: true, missingInDb, extraInDb, applied, local };
}

export default { checkDB, checkDbConnection, listAppliedMigrations, listLocalMigrations, compareMigrations };
