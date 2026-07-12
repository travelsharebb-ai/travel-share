export function cleanUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    activeStoreItemId: user.activeStoreItemId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function cleanUpload(upload) {
  return {
    id: upload.id,
    tripId: upload.tripId,
    eventId: upload.eventId,
    zoneId: upload.zoneId,
    guestSessionId: upload.guestSessionId,
    caption: upload.caption,
    fileUrl: upload.fileUrl,
    fileType: upload.fileType,
    status: upload.status,
    latitude: upload.latitude,
    longitude: upload.longitude,
    approximateLatitude: upload.approximateLatitude,
    approximateLongitude: upload.approximateLongitude,
    locationName: upload.locationName,
    region: upload.region,
    locationVisibility: upload.locationVisibility,
    moderationStatus: upload.moderationStatus,
    skinId: upload.skinId || null,
    frameAssetUrl: upload.frameAssetUrl || null,
    createdAt: upload.createdAt,
    approvedAt: upload.approvedAt
  };
}

export function cleanGuestSession(guest) {
  if (!guest) return null;
  return {
    id: guest.id,
    displayName: guest.displayName,
    scopeType: guest.scopeType,
    scopeId: guest.scopeId,
    expiresAt: guest.expiresAt,
    claimedById: guest.claimedById,
    lastGuestAccessAt: guest.lastGuestAccessAt,
    createdAt: guest.createdAt,
    updatedAt: guest.updatedAt
  };
}

export function cleanTrip(trip) {
  if (!trip) return null;
  const { qrToken, shareLinks, ...safeTrip } = trip;
  return safeTrip;
}

export function cleanEvent(event) {
  if (!event) return null;
  const { qrToken, shareLinks, ...safeEvent } = event;
  return {
    ...safeEvent,
    zones: Array.isArray(safeEvent.zones)
      ? safeEvent.zones.map(({ qrToken: zoneQrToken, ...zone }) => zone)
      : safeEvent.zones
  };
}
