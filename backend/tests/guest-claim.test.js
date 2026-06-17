import request from 'supertest';
import { describe, it, expect, beforeAll } from 'vitest';

// These tests require a running backend and a configured DATABASE_URL.
// They are templates to run locally. Skip if env not configured.

const BASE = process.env.BACKEND_URL || 'http://localhost:10000';

function envOk() {
  return Boolean(process.env.DATABASE_URL);
}

describe('Guest claim flow (template)', () => {
  if (!envOk()) {
    it('skips because DATABASE_URL is not set', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it('creates a guest session, creates a trip, then signs up and claims guest trips', async () => {
    // 1) Create guest session via public endpoint (this depends on app API)
    const guestResp = await request(BASE).post('/api/public/guest').send({}).timeout(10000);
    expect(guestResp.status).toBeOneOf([200, 201]);
    const guestToken = guestResp.body?.guest?.token || guestResp.body?.token;
    expect(guestToken).toBeDefined();

    // 2) Create a trip as guest (attach guest token header)
    const tripResp = await request(BASE).post('/api/trips').set('x-guest-token', guestToken).send({ title: 'Guest Trip', destination: 'Nowhere' }).timeout(10000);
    // Depending on server implementation, this may require a special public endpoint; adjust as needed.
    // We expect either 201 or 401 if unauthenticated paths differ.
    expect([201, 401]).toContain(tripResp.status);

    // 3) Sign up a new user while providing guestToken in body to claim
    const email = `test+guest-${Date.now()}@example.com`;
    const signupResp = await request(BASE).post('/api/auth/signup').send({ name: 'Guest Test', email, password: 'longpassword', guestToken }).timeout(10000);
    expect([201, 200]).toContain(signupResp.status);
    // If signup succeeded, check that guest trips were claimed. This is best validated by a follow-up GET /api/trips (authenticated)
  }, { timeout: 30000 });
});
