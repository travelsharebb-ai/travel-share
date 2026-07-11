import Redis from "ioredis";
import { hashToken } from "../utils/tokens.js";

export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const OAUTH_HANDOFF_TTL_MS = 60 * 1000;

const KEY_PREFIX = "travelshare:oauth";
const LOCAL_ENVIRONMENTS = new Set(["test", "development", "local"]);

function recordKey(type, identifier) {
  return `${KEY_PREFIX}:${type}:${hashToken(identifier)}`;
}

function parseRecord(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export class MemoryOAuthTempStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.records = new Map();
  }

  set(type, identifier, value, ttlMs) {
    this.records.set(recordKey(type, identifier), {
      value,
      expiresAt: this.now() + ttlMs
    });
  }

  get(type, identifier) {
    const key = recordKey(type, identifier);
    const record = this.records.get(key);
    if (!record) return null;
    if (record.expiresAt <= this.now()) {
      this.records.delete(key);
      return null;
    }
    return record.value;
  }

  delete(type, identifier) {
    this.records.delete(recordKey(type, identifier));
  }

  take(type, identifier) {
    const value = this.get(type, identifier);
    this.delete(type, identifier);
    return value;
  }

  async setState(nonce, value, ttlMs = OAUTH_STATE_TTL_MS) {
    this.set("state", nonce, value, ttlMs);
  }

  async getState(nonce) {
    return this.get("state", nonce);
  }

  async deleteState(nonce) {
    this.delete("state", nonce);
  }

  async takeState(nonce) {
    return this.take("state", nonce);
  }

  async setHandoff(code, value, ttlMs = OAUTH_HANDOFF_TTL_MS) {
    this.set("handoff", code, value, ttlMs);
  }

  async getHandoff(code) {
    return this.get("handoff", code);
  }

  async deleteHandoff(code) {
    this.delete("handoff", code);
  }

  async takeHandoff(code) {
    return this.take("handoff", code);
  }
}

export class RedisOAuthTempStore {
  constructor(client) {
    this.client = client;
  }

  async set(type, identifier, value, ttlMs) {
    await this.client.set(recordKey(type, identifier), JSON.stringify(value), "PX", ttlMs);
  }

  async get(type, identifier) {
    const key = recordKey(type, identifier);
    const value = await this.client.get(key);
    const parsed = parseRecord(value);
    if (value && !parsed) await this.client.del(key);
    return parsed;
  }

  async delete(type, identifier) {
    await this.client.del(recordKey(type, identifier));
  }

  async take(type, identifier) {
    const key = recordKey(type, identifier);
    const value = await this.client.call("GETDEL", key);
    return parseRecord(value);
  }

  async setState(nonce, value, ttlMs = OAUTH_STATE_TTL_MS) {
    await this.set("state", nonce, value, ttlMs);
  }

  async getState(nonce) {
    return this.get("state", nonce);
  }

  async deleteState(nonce) {
    await this.delete("state", nonce);
  }

  async takeState(nonce) {
    return this.take("state", nonce);
  }

  async setHandoff(code, value, ttlMs = OAUTH_HANDOFF_TTL_MS) {
    await this.set("handoff", code, value, ttlMs);
  }

  async getHandoff(code) {
    return this.get("handoff", code);
  }

  async deleteHandoff(code) {
    await this.delete("handoff", code);
  }

  async takeHandoff(code) {
    return this.take("handoff", code);
  }
}

export function createOAuthTempStore({
  redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL,
  nodeEnv = process.env.NODE_ENV,
  redisClient,
  logger = console
} = {}) {
  if (redisClient) return new RedisOAuthTempStore(redisClient);

  const localEnvironment = LOCAL_ENVIRONMENTS.has(nodeEnv);
  if (!redisUrl || localEnvironment) {
    if (nodeEnv === "production" && !redisUrl) {
      logger.warn("REDIS_URL is missing in production; OAuth state and handoff records will use process-local memory and will not work across multiple backend instances.");
    }
    return new MemoryOAuthTempStore();
  }

  const client = new Redis(redisUrl, {
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 2
  });
  client.on("error", (error) => {
    logger.error("OAuth temporary Redis store error:", error.message);
  });
  return new RedisOAuthTempStore(client);
}

export const oauthTempStore = createOAuthTempStore();
