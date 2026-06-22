import { notifyNewUpload as _notify } from "../utils/email.js";
import { prisma } from "../utils/prisma.js";

export function notifyNewUploadSafe(payload) {
  // fire-and-forget but ensure rejections are handled
  Promise.resolve().then(async () => {
    if (payload?.trip && payload?.upload) return _notify(payload);
    if (!payload?.tripId || !payload?.uploadId) return null;

    const trip = await prisma.trip.findUnique({
      where: { id: payload.tripId },
      include: { user: true }
    });
    if (!trip?.user?.email) return null;

    const upload = await prisma.upload.findUnique({ where: { id: payload.uploadId } });
    if (!upload) return null;

    return _notify({ trip, upload });
  }).catch((err) => {
    console.error('notifyNewUpload failed', err && err.message ? err.message : err);
  });
}
