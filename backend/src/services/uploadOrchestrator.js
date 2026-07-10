import { prisma } from "../utils/prisma.js";
import { uploadMedia, deleteMedia } from "../utils/storage.js";
import { anonId } from "../utils/tokens.js";
import { extractExifGps } from "../utils/exif.js";
import { getOrCreateGuestSession, getGuestLifecycle } from "../services/sessionService.js";
import { notifyNewUploadSafe } from "../services/notificationService.js";
import { moderateSafe } from "../services/moderationService.js";
import { uploadBodySchema, qrTokenParam } from "../utils/validation.js";
import { resolveQRUploadSpaceByToken } from "./qrSpaceService.js";

function parseOptionalFloat(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function locationData(body = {}) {
  const latitude = parseOptionalFloat(body.latitude);
  const longitude = parseOptionalFloat(body.longitude);
  const visibility = ["exact", "approximate", "city", "hidden"].includes(body.locationVisibility) ? body.locationVisibility : "approximate";
  return {
    caption: body.caption?.slice?.(0, 240) || null,
    latitude: visibility === "hidden" ? null : latitude,
    longitude: visibility === "hidden" ? null : longitude,
    approximateLatitude: latitude === null ? null : Math.round(latitude * 100) / 100,
    approximateLongitude: longitude === null ? null : Math.round(longitude * 100) / 100,
    locationName: body.locationName?.slice?.(0, 120) || null,
    region: body.region?.slice?.(0, 120) || null,
    locationVisibility: visibility
  };
}

async function rollbackUpload({ uploadStateId, filePublicId, reason }) {
  // Attempt to delete uploaded object; mark uploadState = failed and enqueue retry if deletion fails
  try {
    if (filePublicId) {
      await deleteMedia(filePublicId);
    }
  } catch (err) {
    console.error('rollbackUpload: deleteMedia failed', err && err.message ? err.message : err);
    // mark state failed and enqueue retry
    try {
      await prisma.uploadState.update({ where: { id: uploadStateId }, data: { status: 'failed' } });
    } catch (uErr) {
      console.error('rollbackUpload: failed to mark uploadState.failed', uErr && uErr.message ? uErr.message : uErr);
    }
    try {
      await prisma.uploadRetryJob.create({ data: { uploadStateId, filePublicId, lastError: String(err && err.message ? err.message : err), attempts: 0 } });
    } catch (jobErr) {
      console.error('rollbackUpload: failed to create uploadRetryJob', jobErr && jobErr.message ? jobErr.message : jobErr);
    }
    throw Object.assign(new Error('Rollback: failed to delete storage object: ' + (err && err.message ? err.message : err)), { cause: err });
  }

  // successful delete: mark failed state
  try {
    await prisma.uploadState.update({ where: { id: uploadStateId }, data: { status: 'failed' } });
  } catch (uErr) {
    console.error('rollbackUpload: failed to mark uploadState.failed after deletion', uErr && uErr.message ? uErr.message : uErr);
    // still enqueue so operator can examine
    try {
      await prisma.uploadRetryJob.create({ data: { uploadStateId, filePublicId, lastError: String(uErr && uErr.message ? uErr.message : uErr), attempts: 0 } });
    } catch (jobErr) {
      console.error('rollbackUpload: failed to create uploadRetryJob after mark failed', jobErr && jobErr.message ? jobErr.message : jobErr);
    }
    throw uErr;
  }
}

/**
 * Single authoritative orchestrator for uploads.
 * Returns { uploadState, upload, media, status }
 */
export async function executeUploadPipeline({ file, body = {}, context = {}, idempotencyKey = null, fingerprint = null, sessionToken = null }) {
  const { type, entityId, platformCache } = context || {};
  if (!file) throw Object.assign(new Error('File required'), { status: 400 });

  // 1) Strong idempotency: atomic upsert reservation. Use reservedToken to detect creation.
  const key = idempotencyKey || `${Date.now()}-${Math.random()}`;
  const reservedToken = String(Math.random()).slice(2);
  let state = null;
  try {
    state = await prisma.uploadState.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: { idempotencyKey: key, status: 'reserved', entityId: entityId || '', type: type || 'unknown', fingerprint: fingerprint || null, reservedToken }
    });
  } catch (err) {
    throw Object.assign(new Error('Failed to reserve upload state'), { cause: err });
  }

  // If this upsert returned an existing row (reservedToken differs), return existing and DO NOT re-upload
  if (!state.reservedToken || state.reservedToken !== reservedToken) {
    const existing = await prisma.uploadState.findUnique({ where: { id: state.id }, include: { upload: true } });
    return { uploadState: existing, upload: existing?.upload || null, media: null, status: 'existing' };
  }

  // 2) Pre-storage validation and guest session creation (do not perform storage before state exists)
  let target = null;
  let scopeType = null;
  let scopeId = null;
  let qrSpace = null;
  let uploadStatus = 'pending';
  // validate request body according to upload schema
  async function validateQrAndBody({ params, body }) {
    const parsed = uploadBodySchema.safeParse(body || {});
    if (!parsed.success) {
      const err = new Error('Invalid upload body');
      err.status = 400;
      throw err;
    }
    // if a qrToken param exists, validate it too (non-blocking)
    if (params?.qrToken) {
      const p = qrTokenParam.safeParse({ qrToken: params.qrToken });
      if (!p.success) {
        const err = new Error('Invalid QR token');
        err.status = 400;
        throw err;
      }
    }
    return parsed.data;
  }
  // moderation and exif will be set later in the flow
  let moderation = null;
  let exif = null;
  try {
    const bodyData = await validateQrAndBody({ params: context.params || {}, body });
    if (type === 'trip') {
      target = await prisma.trip.findUnique({ where: { qrToken: context.params?.qrToken } });
      if (!target) throw Object.assign(new Error('This QR link is not accepting uploads right now.'), { status: 404 });
      scopeType = 'trip'; scopeId = target.id;
      // blocked uploader check
      const blocked = await prisma.blockedUploader.findUnique({ where: { tripId_uploaderFingerprint: { tripId: target.id, uploaderFingerprint: fingerprint || null } } }).catch(() => null);
      if (blocked) throw Object.assign(new Error('Uploads are blocked for this QR link.'), { status: 403 });
    } else if (type === 'event') {
      // Prefer explicit params.qrToken when provided (controller may pass params),
      // otherwise fallback to entityId supplied by caller.
      const token = context.params?.qrToken || entityId;
      target = await prisma.event.findUnique({ where: { qrToken: token }, include: { zones: true } }).catch(() => null);
      // Only allow uploads for active, public, live events
      if (!target || target.status !== 'live' || target.visibility !== 'public') {
        throw Object.assign(new Error('Event not found.'), { status: 404 });
      }
      scopeType = 'event'; scopeId = target.id;
    } else if (type === 'zone') {
      target = await prisma.mapZone.findUnique({ where: { qrToken: entityId }, include: { event: true } });
      if (!target) throw Object.assign(new Error('Event zone not found.'), { status: 404 });
      scopeType = 'zone'; scopeId = target.id;
    } else if (type === 'qr_space') {
      const token = context.params?.qrToken || entityId;
      qrSpace = await resolveQRUploadSpaceByToken(token, { incrementScan: false });
      if (!qrSpace) throw Object.assign(new Error('QR not found'), { status: 404 });

      const isRegistered = Boolean(context.registeredUser && context.registeredUser.role !== 'guest');
      if (!isRegistered && qrSpace.allowGuests === false) {
        throw Object.assign(new Error('Guest uploads are not allowed for this QR upload space.'), { status: 403 });
      }
      if (isRegistered && qrSpace.allowRegisteredUsers === false) {
        throw Object.assign(new Error('Registered user uploads are not allowed for this QR upload space.'), { status: 403 });
      }
      uploadStatus = qrSpace.requireApproval ? 'pending' : 'approved';
      scopeType = 'qr_space'; scopeId = qrSpace.id;

      if (qrSpace.targetType === 'event') {
        target = await prisma.event.findUnique({ where: { id: qrSpace.targetId || '' } });
        if (!target) throw Object.assign(new Error('QR upload-space event target not found.'), { status: 404 });
      } else if (qrSpace.targetType === 'trip' || qrSpace.targetType === 'album') {
        target = await prisma.trip.findUnique({ where: { id: qrSpace.targetId || '' } });
        if (!target) throw Object.assign(new Error('QR upload-space album target not found.'), { status: 404 });
      } else if (qrSpace.targetType === 'location') {
        target = qrSpace.targetId
          ? await prisma.location.findUnique({ where: { id: qrSpace.targetId } })
          : null;
        if (qrSpace.targetId && !target) throw Object.assign(new Error('QR upload-space location target not found.'), { status: 404 });
      }
    }

    const guest = await getOrCreateGuestSession({ token: sessionToken, deviceFingerprint: fingerprint, platformCache, scopeType, scopeId });
    if (!guest) throw Object.assign(new Error('Unable to create guest session.'), { status: 403 });
    const guestLifecycle = await getGuestLifecycle(guest, { platformCache });
    if (guestLifecycle.state === 'expired') throw Object.assign(new Error('Guest access expired.'), { status: 403 });

    // attach guest info to state object for response
    state = { ...state, guest };
  } catch (err) {
    // mark failed and return
    try { await prisma.uploadState.update({ where: { id: state.id }, data: { status: 'failed' } }); } catch (uErr) { console.error('failed to update state after pre-check failure', uErr); }
    throw err;
  }

  // 3) Reserve -> uploading atomic transition
  const reservedToUploading = await prisma.uploadState.updateMany({ where: { id: state.id, status: 'reserved', reservedToken }, data: { status: 'uploading' } });
  if (reservedToUploading.count !== 1) {
    const existing = await prisma.uploadState.findUnique({ where: { id: state.id }, include: { upload: true } });
    return { uploadState: existing, upload: existing?.upload || null, media: null, status: 'existing' };
  }

  // 3) EXIF extraction (best-effort) before any potential re-encoding
  try { exif = await extractExifGps(file.buffer); } catch (e) { exif = null; }

  // 4) Storage execution: deterministic key based on uploadState.id
  const storageKey = `travel-share/uploads/${state.id}`;
  let media = null;
  try {
    media = await uploadMedia(file, { key: storageKey });
    // persist storage key and provider on state explicitly
    const storageProvider = (process.env.STORAGE_PROVIDER || process.env.MEDIA_STORAGE_DRIVER || "local").toLowerCase();
    try { await prisma.uploadState.update({ where: { id: state.id }, data: { filePublicId: media?.filePublicId || null, storageKey, storageProvider } }); } catch (uErr) { console.warn('failed to update uploadState with storage key', uErr && uErr.message ? uErr.message : uErr); }
  } catch (err) {
    try { await prisma.uploadState.update({ where: { id: state.id }, data: { status: 'failed' } }); } catch (uErr) { console.error('failed to update state after storage failure', uErr); }
    // storage failed so we mark failed and return
    throw Object.assign(new Error('Storage upload failed: ' + (err.message || String(err))), { status: err.status || 502 });
  }

  // 5) uploading -> processing atomic transition
  const upToProcessing = await prisma.uploadState.updateMany({ where: { id: state.id, status: 'uploading' }, data: { status: 'processing' } });
  if (upToProcessing.count !== 1) {
    // best-effort delete storage if we are not owner of the transition
    try { await deleteMedia(media?.filePublicId); } catch (delErr) { console.error('failed to delete media after transition race', delErr); }
    const existing = await prisma.uploadState.findUnique({ where: { id: state.id }, include: { upload: true } });
    return { uploadState: existing, upload: existing?.upload || null, media: null, status: 'existing' };
  }

  // 6) Run moderation (best-effort, non-blocking to upload flow)
  try { moderation = await moderateSafe({ fileUrl: media.fileUrl, fileType: media.fileType }); } catch (mErr) { moderation = { provider: process.env.MODERATION_PROVIDER || 'disabled', status: 'error', aiFlagged: true, labels: { error: mErr.message } }; }
  // 6) DB final write (transactionally create upload and update uploadState.uploadId -> SUCCESS)
  let finalUpload = null;
  try {
    const bodyData = await validateQrAndBody({ params: context.params || {}, body }).catch(() => body);
    const loc = locationData(bodyData || {});
    if ((loc.latitude === null && loc.longitude === null) && exif) {
      loc.latitude = exif.latitude; loc.longitude = exif.longitude;
      loc.approximateLatitude = Math.round(exif.latitude * 100) / 100;
      loc.approximateLongitude = Math.round(exif.longitude * 100) / 100;
    }

    const createData = {
      guestSessionId: state.guest?.id || null,
      uploaderAnonId: anonId(),
      uploaderFingerprint: fingerprint || null,
      aiFlagged: !!moderation?.aiFlagged,
      moderationProvider: moderation?.provider || null,
      moderationStatus: moderation?.status || null,
      moderationLabels: moderation?.labels || null,
      status: uploadStatus,
      approvedAt: uploadStatus === 'approved' ? new Date() : null,
      fileUrl: media.fileUrl,
      filePublicId: media.filePublicId,
      fileType: media.fileType
    };
    Object.assign(createData, loc);
    if (type === 'trip') createData.tripId = scopeId;
    if (type === 'event') createData.eventId = scopeId;
    if (type === 'zone') {
      createData.eventId = target?.eventId || target?.event?.id || null;
      createData.zoneId = scopeId;
    }
    if (type === 'qr_space') {
      createData.qrUploadSpaceId = scopeId;
      if (qrSpace.targetType === 'trip' || qrSpace.targetType === 'album') createData.tripId = target?.id || qrSpace.targetId;
      if (qrSpace.targetType === 'event') createData.eventId = target?.id || qrSpace.targetId;
      if (qrSpace.targetType === 'location') {
        createData.locationId = target?.id || qrSpace.targetId || null;
        createData.locationName = loc.locationName || qrSpace.locationName || target?.name || null;
        createData.latitude = loc.latitude ?? qrSpace.latitude ?? target?.latitude ?? null;
        createData.longitude = loc.longitude ?? qrSpace.longitude ?? target?.longitude ?? null;
        createData.approximateLatitude = createData.latitude === null ? null : Math.round(createData.latitude * 100) / 100;
        createData.approximateLongitude = createData.longitude === null ? null : Math.round(createData.longitude * 100) / 100;
      }
      if (qrSpace.targetType === 'general') {
        createData.locationName = loc.locationName || qrSpace.locationName || null;
        createData.latitude = loc.latitude ?? qrSpace.latitude ?? null;
        createData.longitude = loc.longitude ?? qrSpace.longitude ?? null;
        createData.approximateLatitude = createData.latitude === null ? null : Math.round(createData.latitude * 100) / 100;
        createData.approximateLongitude = createData.longitude === null ? null : Math.round(createData.longitude * 100) / 100;
      }
    }

    if (createData.locationVisibility === 'hidden' || createData.latitude === null || createData.longitude === null) {
      throw Object.assign(new Error('Upload location is required so this memory can appear on the map.'), { status: 400 });
    }

    finalUpload = await prisma.$transaction(async (tx) => {
      const u = await tx.upload.create({ data: createData });
      const res = await tx.uploadState.updateMany({ where: { id: state.id, status: 'processing' }, data: { status: 'success', uploadId: u.id } });
      if (res.count !== 1) throw new Error('State transition to success failed');
      return u;
    });
  } catch (err) {
    // DB failed: rollback storage and mark failed
    try {
      await rollbackUpload({ uploadStateId: state.id, filePublicId: media?.filePublicId, reason: err });
    } catch (rbErr) {
      console.error('rollback after db failure failed', rbErr && rbErr.message ? rbErr.message : rbErr);
    }
    const status = err.status || 500;
    const message = status === 500 ? `Failed to save upload: ${err.message || String(err)}` : err.message || String(err);
    throw Object.assign(new Error(message), { status });
  }

  // 7) Fire-and-forget notify
  try { notifyNewUploadSafe({ uploadId: finalUpload.id, tripId: finalUpload.tripId, eventId: finalUpload.eventId }); } catch (err) { console.warn('notify failed', err); }

  // 8) return composed response (include legacy `saved` for controller compatibility)
  const updatedState = await prisma.uploadState.findUnique({ where: { id: state.id }, include: { upload: true } });
  return { uploadState: updatedState, upload: finalUpload, saved: finalUpload, guest: state.guest, media, status: 'success' };
}

export default { executeUploadPipeline, rollbackUpload };
