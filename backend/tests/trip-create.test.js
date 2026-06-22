import request from 'supertest';
import { describe, it, expect } from 'vitest';

const BASE = process.env.BACKEND_URL || 'http://localhost:10000';

function envOk() { return Boolean(process.env.DATABASE_URL); }

describe('Trip creation (template)', () => {
  if (!envOk()) {
    it('skips because DATABASE_URL is not set', () => expect(true).toBe(true));
    return;
  }

  it('creates a trip for authenticated user', async () => {
    // This test assumes you have a user and a token to authenticate with.
    // Provide AUTH_TEST_TOKEN env var with a valid JWT from your local backend to run.
    const token = process.env.AUTH_TEST_TOKEN;
    if (!token) {
      expect(true).toBe(true);
      return;
    }

    const resp = await request(BASE).post('/api/trips').set('Authorization', `Bearer ${token}`).send({ title: 'API Test Trip', destination: 'CI Land' });
    expect(resp.status).toBe(201);
    expect(resp.body.trip).toBeDefined();
    expect(resp.body.trip.title).toBe('API Test Trip');
  });
});
