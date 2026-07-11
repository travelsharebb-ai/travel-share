import crypto from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "../utils/prisma.js";
import { isPlatformAdmin } from "../middleware/auth.js";

const TARGET_TYPES = new Set(["general", "event", "trip", "album", "location"]);
const VISIBILITIES = new Set(["public", "private", "unlisted"]);

export function buildQRSpacePublicUrl(token) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/qr/${token}`;
}

export function buildQRSpaceUploadUrl(token) {
  const base = process.env.FRONTEND_URL || "http://localhost:5173";
  return `${base.replace(/\/$/, "")}/qr/${token}/upload`;
}

export async function generateQRSpaceToken() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = crypto.randomBytes(24).toString("base64url");
    const existing = await prisma.qRUploadSpace.findUnique({ where: { token }, select: { id: true } });
    if (!existing) return token;
  }
  throw Object.assign(new Error("Unable to generate QR upload-space token."), { status: 500 });
}

function canAdmin(user) {
  return isPlatformAdmin(user);
}

function requireRegisteredUser(authContext = {}) {
  const user = authContext.user;
  if (!user || user.role === "guest") {
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  }
  return user;
}

function serializeQRSpace(space) {
  if (!space) return null;
  return {
    ...space,
    publicUrl: buildQRSpacePublicUrl(space.token),
    uploadUrl: buildQRSpaceUploadUrl(space.token)
  };
}

function normalizeData(data = {}) {
  const targetType = data.targetType || "general";
  if (!TARGET_TYPES.has(targetType)) {
    throw Object.assign(new Error("Invalid QR upload-space target type."), { status: 400 });
  }
  const visibility = data.visibility || "unlisted";
  if (!VISIBILITIES.has(visibility)) {
    throw Object.assign(new Error("Invalid QR upload-space visibility."), { status: 400 });
  }
  return {
    title: String(data.title || "").trim(),
    targetType,
    targetId: data.targetId || null,
    visibility,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    allowGuests: data.allowGuests ?? true,
    allowRegisteredUsers: data.allowRegisteredUsers ?? true,
    requireApproval: data.requireApproval ?? true,
    latitude: data.latitude === undefined || data.latitude === null || data.latitude === "" ? null : Number(data.latitude),
    longitude: data.longitude === undefined || data.longitude === null || data.longitude === "" ? null : Number(data.longitude),
    locationName: data.locationName || null,
    metadata: data.metadata || undefined
  };
}

async function assertTargetPermission(data, user) {
  if (canAdmin(user)) return;
  if (data.targetType === "general") return;

  if (!data.targetId) {
    if (["album", "event", "trip", "location"].includes(data.targetType)) {
      throw Object.assign(new Error("targetId is required for this QR upload-space target."), { status: 400 });
    }
    return;
  }

  if (data.targetType === "trip" || data.targetType === "album") {
    const trip = await prisma.trip.findFirst({ where: { id: data.targetId, userId: user.id }, select: { id: true } });
    if (!trip) throw Object.assign(new Error("Trip not found."), { status: 404 });
    return;
  }

  if (data.targetType === "event") {
    const event = await prisma.event.findFirst({ where: { id: data.targetId, organizerId: user.id }, select: { id: true } });
    if (!event) throw Object.assign(new Error("Event not found."), { status: 404 });
    return;
  }

  if (data.targetType === "location") {
    const location = await prisma.location.findFirst({ where: { id: data.targetId, OR: [{ userId: user.id }, { userId: null }] }, select: { id: true } });
    if (!location) throw Object.assign(new Error("Location not found."), { status: 404 });
    return;
  }
}

async function findManageableQRSpace(id, user) {
  const where = canAdmin(user)
    ? { id, deletedAt: null }
    : { id, deletedAt: null, createdByUserId: user.id };
  const space = await prisma.qRUploadSpace.findFirst({ where });
  if (!space) throw Object.assign(new Error("QR upload space not found."), { status: 404 });
  return space;
}

export async function createQRUploadSpace(data, authContext = {}) {
  const user = requireRegisteredUser(authContext);
  const normalized = normalizeData(data);
  if (!normalized.title || normalized.title.length < 2) {
    throw Object.assign(new Error("Title is required."), { status: 400 });
  }
  if (!normalized.allowGuests && !normalized.allowRegisteredUsers) {
    throw Object.assign(new Error("At least one uploader type must be allowed."), { status: 400 });
  }
  await assertTargetPermission(normalized, user);
  const token = await generateQRSpaceToken();
  const qrSpace = await prisma.qRUploadSpace.create({
    data: {
      ...normalized,
      token,
      createdByUserId: user.id
    }
  });
  return serializeQRSpace(qrSpace);
}

export async function listQRUploadSpaces(authContext = {}) {
  const user = requireRegisteredUser(authContext);
  const spaces = await prisma.qRUploadSpace.findMany({
    where: canAdmin(user) ? { deletedAt: null } : { deletedAt: null, createdByUserId: user.id },
    orderBy: { createdAt: "desc" }
  });
  return spaces.map(serializeQRSpace);
}

export async function getQRUploadSpaceById(id, authContext = {}) {
  const user = requireRegisteredUser(authContext);
  return serializeQRSpace(await findManageableQRSpace(id, user));
}

export async function updateQRUploadSpace(id, data, authContext = {}) {
  const user = requireRegisteredUser(authContext);
  const existing = await findManageableQRSpace(id, user);
  const normalized = normalizeData({ ...existing, ...data });
  if (!normalized.title || normalized.title.length < 2) {
    throw Object.assign(new Error("Title is required."), { status: 400 });
  }
  if (!normalized.allowGuests && !normalized.allowRegisteredUsers) {
    throw Object.assign(new Error("At least one uploader type must be allowed."), { status: 400 });
  }
  await assertTargetPermission(normalized, user);
  const updated = await prisma.qRUploadSpace.update({
    where: { id: existing.id },
    data: normalized
  });
  return serializeQRSpace(updated);
}

export async function disableQRUploadSpace(id, authContext = {}) {
  const user = requireRegisteredUser(authContext);
  const existing = await findManageableQRSpace(id, user);
  const updated = await prisma.qRUploadSpace.update({
    where: { id: existing.id },
    data: { disabledAt: existing.disabledAt || new Date() }
  });
  return serializeQRSpace(updated);
}

export async function deleteQRUploadSpace(id, authContext = {}) {
  const user = requireRegisteredUser(authContext);
  const existing = await findManageableQRSpace(id, user);
  const updated = await prisma.qRUploadSpace.update({
    where: { id: existing.id },
    data: { deletedAt: existing.deletedAt || new Date(), disabledAt: existing.disabledAt || new Date() }
  });
  return serializeQRSpace(updated);
}

export async function resolveQRUploadSpaceByToken(token, { incrementScan = false } = {}) {
  const space = await prisma.qRUploadSpace.findUnique({ where: { token } });
  if (!space || space.deletedAt || space.disabledAt) return null;
  if (space.expiresAt && space.expiresAt <= new Date()) {
    throw Object.assign(new Error("QR upload space has expired"), { status: 410 });
  }
  if (!incrementScan) return serializeQRSpace(space);
  const updated = await prisma.qRUploadSpace.update({
    where: { id: space.id },
    data: { scanCount: { increment: 1 }, lastScannedAt: new Date() }
  });
  return serializeQRSpace(updated);
}

export async function qrSpaceToDataUrl(spaceOrToken) {
  const token = typeof spaceOrToken === "string" ? spaceOrToken : spaceOrToken?.token;
  if (!token) throw Object.assign(new Error("QR token required."), { status: 400 });
  return QRCode.toDataURL(buildQRSpacePublicUrl(token), { margin: 1, width: 720 });
}

export function publicQRSpacePayload(space) {
  return {
    type: "upload_space",
    qrToken: space.token,
    title: space.title,
    targetType: space.targetType,
    targetId: space.targetId,
    visibility: space.visibility,
    allowGuests: space.allowGuests,
    allowRegisteredUsers: space.allowRegisteredUsers,
    requireApproval: space.requireApproval,
    expiresAt: space.expiresAt,
    uploadUrl: `/qr/${space.token}/upload`
  };
}
