import http from 'node:http';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { RATE_LIMITS } from '../../src/features/auth/rateLimit';
import { pool } from '../../src/lib/pool';
import { CSRF, insertUser, truncateAll } from '../helpers';

// env.ts reads it once at import, so it is set before the imports: production's value on Render (D65).
vi.hoisted(() => {
  process.env.TRUST_PROXY = '1';
});

beforeEach(truncateAll);
afterEach(() => {
  vi.unstubAllEnvs();
  app.set('trust proxy', 1);
});
afterAll(async () => {
  delete process.env.TRUST_PROXY;
  await pool.end();
});

/** Requests that reach the app from a public peer address rather than supertest's loopback. */
const fromPeer = (peer: string) =>
  http.createServer((req, res) => {
    Object.defineProperty(req.socket, 'remoteAddress', { value: peer, configurable: true });
    app(req, res);
  });
const remaining = (res: request.Response) => Number(/r=(\d+)/.exec(String(res.headers.ratelimit))?.[1]);
const guestRows = async () =>
  (await pool.query(`SELECT COUNT(*)::INT AS n FROM "RATE_LIMIT_T" WHERE rlt_key LIKE 'guest:%'`)).rows[0].n;

describe('Proxy trust and rate-limit keys (R37)', () => {
  it('DEP-TC3: with TRUST_PROXY=1 two clients behind the proxy get separate guest buckets', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'guest');
    expect(app.get('trust proxy')).toBe(1);
    const uid = await insertUser();
    const proxy = fromPeer('10.0.0.1');
    const a1 = await request(proxy).get(`/api/users/${uid}`).set('X-Forwarded-For', '203.0.113.5');
    const a2 = await request(proxy).get(`/api/users/${uid}`).set('X-Forwarded-For', '203.0.113.5');
    const b1 = await request(proxy).get(`/api/users/${uid}`).set('X-Forwarded-For', '198.51.100.7');
    expect(a1.status).toBe(200);
    expect(remaining(a1)).toBe(RATE_LIMITS.guestReads - 1);
    expect(remaining(a2)).toBe(RATE_LIMITS.guestReads - 2);
    expect(remaining(b1)).toBe(RATE_LIMITS.guestReads - 1);
  });

  it('DEP-TC4: with loopback trust a forged X-Forwarded-For from a public peer is ignored', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'guest');
    app.set('trust proxy', 'loopback');
    const uid = await insertUser();
    const peer = fromPeer('198.51.100.20');
    const first = await request(peer).get(`/api/users/${uid}`).set('X-Forwarded-For', '203.0.113.5');
    const forged = await request(peer).get(`/api/users/${uid}`).set('X-Forwarded-For', '192.0.2.99');
    expect(remaining(first)).toBe(RATE_LIMITS.guestReads - 1);
    expect(remaining(forged)).toBe(RATE_LIMITS.guestReads - 2);
    const { rows } = await pool.query(`SELECT rlt_key FROM "RATE_LIMIT_T"`);
    expect(rows).toEqual([{ rlt_key: 'guest:198.51.100.20' }]);
  });

  it('DEP-TC5: failed logins are limited per IP and email; other accounts on the same IP and successful logins are not', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'login');
    const lab = fromPeer('10.0.0.1');
    await insertUser({ email: 'a@mail.apu.edu.my' });
    await insertUser({ email: 'b@mail.apu.edu.my' });
    const login = (email: string, password: string) =>
      request(lab).post('/api/auth/login').set(CSRF).set('X-Forwarded-For', '203.0.113.5').send({ email, password });
    for (let i = 0; i < RATE_LIMITS.loginFailures; i++)
      expect((await login('a@mail.apu.edu.my', 'wrong')).status).toBe(401);
    const blocked = await login(' A@mail.apu.edu.my ', 'Passw0rd!');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('Too many failed attempts for this account. Try again in a minute.');
    expect((await login('b@mail.apu.edu.my', 'wrong')).status).toBe(401);
    for (let i = 0; i <= RATE_LIMITS.loginFailures; i++)
      expect((await login('b@mail.apu.edu.my', 'Passw0rd!')).status).toBe(200);
  });

  it('DEP-TC6: asset file GETs are not counted by the guest read limiter; other guest reads are', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'guest');
    expect((await request(app).get('/api/assets/999999/file')).status).toBe(404);
    expect((await request(app).get('/api/share/not-a-token/assets/1')).status).toBe(404);
    expect(await guestRows()).toBe(0);
    expect((await request(app).get(`/api/users/${await insertUser()}`)).status).toBe(200);
    expect(await guestRows()).toBe(1);
  });
});
