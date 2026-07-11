import orchestrator from "./uploadOrchestrator.js";

export async function handleTripUpload({ file, body = {}, params = {}, fingerprint, platformCache, guestToken }) {
  return orchestrator.executeUploadPipeline({ file, body, context: { type: 'trip', entityId: null, params, platformCache }, idempotencyKey: body.idempotencyKey || null, fingerprint, sessionToken: guestToken });
}

export async function handleEventUpload({ file, body = {}, params = {}, fingerprint, platformCache, guestToken }) {
  return orchestrator.executeUploadPipeline({ file, body, context: { type: 'event', entityId: params.qrToken, params, platformCache }, idempotencyKey: body.idempotencyKey || null, fingerprint, sessionToken: guestToken });
}

export async function handleZoneUpload({ file, body = {}, params = {}, fingerprint, platformCache, guestToken }) {
  return orchestrator.executeUploadPipeline({ file, body, context: { type: 'zone', entityId: params.qrToken, params, platformCache }, idempotencyKey: body.idempotencyKey || null, fingerprint, sessionToken: guestToken });
}

export async function handleQRSpaceUpload({ file, body = {}, params = {}, fingerprint, platformCache, guestToken, registeredUser = null }) {
  return orchestrator.executeUploadPipeline({
    file,
    body,
    context: { type: 'qr_space', entityId: params.qrToken, params, platformCache, registeredUser },
    idempotencyKey: body.idempotencyKey || null,
    fingerprint,
    sessionToken: guestToken
  });
}

export function isOpenQr(record) {
  // small helper kept for controller use
  return record?.qrActive !== false && ["open", "approval_required", "trusted", "time_limited", "family_safe"].includes(record?.qrMode || "open");
}
