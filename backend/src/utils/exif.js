import * as exifr from 'exifr';

export async function extractExifGps(buffer) {
  try {
    let gps = null;
    try {
      gps = await exifr.gps(buffer);
    } catch (err) {
      gps = null;
    }
    if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
      return { latitude: gps.latitude, longitude: gps.longitude };
    }
  } catch (err) {
    // swallow errors; EXIF parsing is best-effort
  }
  return null;
}
