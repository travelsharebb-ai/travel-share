import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateProductionEnv } from '../../src/utils/env.js';
import { uploadMedia } from '../../src/utils/storage.js';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe('production media storage safety', () => {
  const baseEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'super-secret-value',
    FINGERPRINT_SECRET: 'another-super-secret',
    FRONTEND_URL: 'https://example.com'
  };

  it('blocks local/disk storage in production unless explicitly allowed', () => {
    process.env = { ...baseEnv, STORAGE_PROVIDER: 'local' };
    expect(() => validateProductionEnv()).toThrow(/Local\/disk media storage is disabled in production/);
  });

  it('allows local/disk storage in production when ALLOW_LOCAL_MEDIA_IN_PRODUCTION=true', () => {
    process.env = { ...baseEnv, STORAGE_PROVIDER: 'disk', ALLOW_LOCAL_MEDIA_IN_PRODUCTION: 'true' };
    expect(() => validateProductionEnv()).not.toThrow();
  });

  it('raises a runtime error for local upload when production storage is local without escape hatch', async () => {
    process.env = { ...baseEnv, NODE_ENV: 'production', STORAGE_PROVIDER: 'local' };
    const file = {
      originalname: 'upload.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test')
    };

    await expect(uploadMedia(file)).rejects.toThrow(/Local\/disk media storage is disabled in production/);
  });
});
