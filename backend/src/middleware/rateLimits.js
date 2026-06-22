import rateLimit from "express-rate-limit";
let RedisStore;
let RedisClient;

try {
  // optional dependency: prefer a Redis-backed store when available
  // `rate-limit-redis` works with `ioredis` or node-redis; we use ioredis here.
  // Keep this require dynamic so package remains optional for development.
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  RedisStore = require("rate-limit-redis").default || require("rate-limit-redis");
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  RedisClient = require("ioredis");
} catch (err) {
  RedisStore = null;
  RedisClient = null;
}

function createStore() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (RedisStore && RedisClient && redisUrl) {
    const client = new RedisClient(redisUrl);
    return new RedisStore({ sendCommand: (...args) => client.call(...args) });
  }
  // return undefined to use the default in-memory store
  return undefined;
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore()
});

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore()
});

export const geocodeLimiter = rateLimit({
  // stricter limits for geocode proxy to avoid abuse
  windowMs: 1 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore()
});
