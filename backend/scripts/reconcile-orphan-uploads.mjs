#!/usr/bin/env node
import { prisma } from "../src/utils/prisma.js";
import { deleteMedia } from "../src/utils/storage.js";

const STUCK_MINUTES = Number(process.env.ORPHAN_STUCK_MINUTES || 10);

async function reconcile() {
  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000);
  console.log(`Reconciling uploadStates stuck in 'uploading' since before ${cutoff.toISOString()}`);
  const stuck = await prisma.uploadState.findMany({ where: { status: 'uploading', updatedAt: { lt: cutoff } } });
  for (const s of stuck) {
    try {
      const existingUpload = await prisma.upload.findUnique({ where: { id: s.uploadId } });
      if (existingUpload) {
        // upload exists; mark success
        await prisma.uploadState.update({ where: { id: s.id }, data: { status: 'success' } });
        console.log(`UploadState ${s.id}: found upload ${existingUpload.id}, marked success.`);
        continue;
      }
      // No DB upload: attempt to delete storage if filePublicId known via retry jobs
      const job = await prisma.uploadRetryJob.findFirst({ where: { uploadStateId: s.id } });
      if (job) {
        // there is a retry job; let worker handle
        console.log(`UploadState ${s.id}: has retry job ${job.id}, skipping.`);
        continue;
      }
      // best-effort discover storage key: assume deterministic key
      const assumedKey = `travel-share/uploads/${s.id}`;
      try {
        await deleteMedia(assumedKey);
        await prisma.uploadState.update({ where: { id: s.id }, data: { status: 'failed' } });
        console.log(`UploadState ${s.id}: deleted orphan storage ${assumedKey} and marked failed.`);
      } catch (err) {
        console.error(`UploadState ${s.id}: failed to delete assumedKey ${assumedKey}:`, err && err.message ? err.message : err);
        // create retry job
        try { await prisma.uploadRetryJob.create({ data: { uploadStateId: s.id, filePublicId: assumedKey, lastError: String(err && err.message ? err.message : err), attempts: 0 } }); } catch (jobErr) { console.error('Failed to create retry job during reconcile', jobErr); }
      }
    } catch (err) {
      console.error('Error reconciling state', s.id, err && err.message ? err.message : err);
    }
  }
}

reconcile().catch((err) => { console.error('Reconcile failed', err); process.exit(1); });
