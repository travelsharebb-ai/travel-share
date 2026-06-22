#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/utils/prisma.js";
import { deleteMedia } from "../src/utils/storage.js";

const POLL_INTERVAL = Number(process.env.UPLOAD_RETRY_POLL_MS || 15000);
const MAX_ATTEMPTS = 5;

export async function processJob(job) {
  try {
    await deleteMedia(job.filePublicId);
    // deletion succeeded -> delete job and mark uploadState failed
    await prisma.uploadRetryJob.delete({ where: { id: job.id } });
    await prisma.uploadState.updateMany({ where: { id: job.uploadStateId }, data: { status: 'failed' } });
    console.log(`UploadRetryJob ${job.id}: deleted ${job.filePublicId} and marked uploadState failed.`);
  } catch (err) {
    const attempts = job.attempts + 1;
    const nextAttemptAt = new Date(Date.now() + Math.min(3600 * 1000, 1000 * Math.pow(2, attempts))); // exponential backoff up to 1h
    try {
      await prisma.uploadRetryJob.update({ where: { id: job.id }, data: { attempts, lastError: String(err && err.message ? err.message : err), nextAttemptAt } });
    } catch (uErr) {
      console.error('Failed updating retry job', uErr);
    }
    if (attempts >= MAX_ATTEMPTS) {
      console.error(`UploadRetryJob ${job.id} reached max attempts; leaving as dead-letter.`);
    } else {
      console.warn(`UploadRetryJob ${job.id} failed attempt ${attempts}; will retry at ${nextAttemptAt.toISOString()}`);
    }
  }
}

export async function poll({ once = false } = {}) {
  console.log('Upload retry worker started');
  let running = true;
  const stop = () => { running = false; };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);

  while (running) {
    try {
      const now = new Date();
      const jobs = await prisma.uploadRetryJob.findMany({
        where: {
          attempts: { lt: MAX_ATTEMPTS },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
        },
        take: 10
      });
      for (const job of jobs) {
        await processJob(job);
      }
    } catch (err) {
      console.error('Worker loop error', err && err.message ? err.message : err);
    }
    if (once) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const modulePath = fileURLToPath(import.meta.url);

if (invokedPath === modulePath) {
  if (process.env.RUN_WORKER !== "true") {
    console.error("Refusing to start upload retry worker without RUN_WORKER=true.");
    process.exit(1);
  }
  poll().catch((err) => { console.error('Worker failed', err); process.exit(1); });
}
