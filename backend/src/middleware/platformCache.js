// Middleware: attach a per-request platform setting cache
export default function attachPlatformCache(req, _res, next) {
  if (!req.platformCache) req.platformCache = new Map();
  next();
}
