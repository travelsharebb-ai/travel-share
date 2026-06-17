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
    uploaderAnonId: upload.uploaderAnonId,
    caption: upload.caption,
    fileUrl: upload.fileUrl,
    filePublicId: upload.filePublicId,
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
