import { describe, expect, it, vi } from "vitest";
import {
  createOAuthTempStore,
  MemoryOAuthTempStore,
  OAUTH_HANDOFF_TTL_MS,
  OAUTH_STATE_TTL_MS,
  RedisOAuthTempStore
} from "../src/services/oauthTempStore.js";

class FakeRedisClient {
  constructor() {
    this.records = new Map();
    this.setCalls = [];
  }

  async set(key, value, mode, ttl) {
    this.records.set(key, value);
    this.setCalls.push({ key, mode, ttl });
    return "OK";
  }

  async get(key) {
    return this.records.get(key) ?? null;
  }

  async del(key) {
    return this.records.delete(key) ? 1 : 0;
  }

  async call(command, key) {
    if (command !== "GETDEL") throw new Error(`Unsupported command: ${command}`);
    const value = this.records.get(key) ?? null;
    this.records.delete(key);
    return value;
  }
}

describe("OAuth temporary store", () => {
  it("stores, reads, and deletes Redis-backed state with a hashed key and TTL", async () => {
    const client = new FakeRedisClient();
    const store = createOAuthTempStore({ redisClient: client });
    const state = { provider: "google", codeVerifier: "verifier", expiresAt: Date.now() + OAUTH_STATE_TTL_MS };

    expect(store).toBeInstanceOf(RedisOAuthTempStore);
    await store.setState("raw-state-nonce", state);
    expect(client.setCalls[0]).toMatchObject({ mode: "PX", ttl: OAUTH_STATE_TTL_MS });
    expect(client.setCalls[0].key).not.toContain("raw-state-nonce");
    expect(await store.getState("raw-state-nonce")).toEqual(state);

    await store.deleteState("raw-state-nonce");
    expect(await store.getState("raw-state-nonce")).toBeNull();
  });

  it("stores and atomically consumes Redis-backed handoffs once", async () => {
    const client = new FakeRedisClient();
    const store = createOAuthTempStore({ redisClient: client });
    const handoff = { token: "app-token", user: { id: "user-1" }, expiresAt: Date.now() + OAUTH_HANDOFF_TTL_MS };

    await store.setHandoff("raw-handoff-code", handoff);
    expect(client.setCalls[0]).toMatchObject({ mode: "PX", ttl: OAUTH_HANDOFF_TTL_MS });
    expect(client.setCalls[0].key).not.toContain("raw-handoff-code");
    expect(await store.getHandoff("raw-handoff-code")).toEqual(handoff);
    expect(await store.takeHandoff("raw-handoff-code")).toEqual(handoff);
    expect(await store.takeHandoff("raw-handoff-code")).toBeNull();

    await store.setHandoff("deletable-code", handoff);
    await store.deleteHandoff("deletable-code");
    expect(await store.getHandoff("deletable-code")).toBeNull();
  });

  it("uses memory in tests and rejects expired state and handoff records", async () => {
    let now = 1_000;
    const selected = createOAuthTempStore({
      redisUrl: "redis://shared.example.test:6379",
      nodeEnv: "test"
    });
    const store = new MemoryOAuthTempStore({ now: () => now });

    expect(selected).toBeInstanceOf(MemoryOAuthTempStore);
    await store.setState("expiring-state", { provider: "google" }, 10);
    await store.setHandoff("expiring-handoff", { token: "token" }, 10);
    now += 11;
    expect(await store.getState("expiring-state")).toBeNull();
    expect(await store.takeState("expiring-state")).toBeNull();
    expect(await store.getHandoff("expiring-handoff")).toBeNull();
    expect(await store.takeHandoff("expiring-handoff")).toBeNull();
  });

  it("warns and falls back to memory when production Redis is missing", () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const store = createOAuthTempStore({ redisUrl: "", nodeEnv: "production", logger });

    expect(store).toBeInstanceOf(MemoryOAuthTempStore);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("REDIS_URL is missing in production"));
  });
});
