import { readFileSync } from 'node:fs';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { purgeOldRateLimits } from '../../src/features/auth/rateLimit';
import { env, parseEnv } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(16) };
const errorOf = (source: NodeJS.ProcessEnv) => {
  try {
    parseEnv(source);
    return '';
  } catch (e) {
    return (e as Error).message;
  }
};

describe('Deploy configuration (R37)', () => {
  it('DEP-TC1: TRUST_PROXY takes a hop count or loopback and refuses anything else', () => {
    expect(parseEnv(base).TRUST_PROXY).toBe('loopback');
    expect(parseEnv({ ...base, TRUST_PROXY: '' }).TRUST_PROXY).toBe('loopback');
    expect(parseEnv({ ...base, TRUST_PROXY: '1' }).TRUST_PROXY).toBe(1);
    expect(parseEnv({ ...base, TRUST_PROXY: '0' }).TRUST_PROXY).toBe(0);
    for (const bad of ['true', '-1', '1.5', 'uniquelocal']) {
      const msg = errorOf({ ...base, TRUST_PROXY: bad });
      expect(msg).toContain('TRUST_PROXY');
      expect(msg).not.toContain(`"${bad}"`);
    }
  });

  it('DEP-TC2: production (NODE_ENV or RENDER) refuses local storage, an http origin, insecure cookies and loopback or zero trust, naming only the variables', () => {
    const msg = errorOf({
      ...base,
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'http://secret-origin.example',
      COOKIE_SECURE: 'false',
    });
    expect(msg).toContain('STORAGE_DRIVER must be r2 in production');
    expect(msg).toContain('CLIENT_ORIGIN must be an https:// origin in production');
    expect(msg).toContain('COOKIE_SECURE must be true in production');
    expect(msg).toContain('TRUST_PROXY must be the proxy hop count');
    expect(msg).toContain('PROXY_SECRET must be set in production');
    expect(msg).not.toContain('secret-origin');

    const valid = {
      ...base,
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://app.example.com',
      TRUST_PROXY: '1',
      PROXY_SECRET: 'proxy-secret-0123456789',
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'b',
      R2_SECRET_ACCESS_KEY: 'c',
      R2_BUCKET: 'd',
    };
    const good = parseEnv(valid);
    expect(good.TRUST_PROXY).toBe(1);
    expect(good.COOKIE_SECURE).toBe(true); // the default follows the parsed NODE_ENV
    expect(errorOf({ ...valid, TRUST_PROXY: '0' })).toContain('TRUST_PROXY must be the proxy hop count');
    const short = errorOf({ ...valid, PROXY_SECRET: 'too-short' });
    expect(short).toContain('PROXY_SECRET');
    expect(short).not.toContain('too-short');
    // RENDER=true counts as production even without NODE_ENV.
    const onRender = errorOf({ ...base, RENDER: 'true' });
    expect(onRender).toContain('STORAGE_DRIVER must be r2 in production');
    expect(onRender).toContain('TRUST_PROXY must be the proxy hop count');
    expect(onRender).not.toContain('COOKIE_SECURE');
    // The same bad values outside production still parse, so local development is unaffected.
    expect(parseEnv({ ...base, CLIENT_ORIGIN: 'http://localhost:5173', COOKIE_SECURE: 'false' }).STORAGE_DRIVER).toBe(
      'local',
    );
  });

  it('DEP-TC21: BCRYPT_ROUNDS defaults to 12 and refuses under 10; Render sets 10 and a lower auth burst', () => {
    expect(parseEnv(base).BCRYPT_ROUNDS).toBe(12);
    expect(parseEnv(base).AUTH_ATTEMPTS_PER_MINUTE).toBe(60);
    expect(parseEnv({ ...base, BCRYPT_ROUNDS: '10', AUTH_ATTEMPTS_PER_MINUTE: '20' })).toMatchObject({
      BCRYPT_ROUNDS: 10,
      AUTH_ATTEMPTS_PER_MINUTE: 20,
    });
    expect(errorOf({ ...base, BCRYPT_ROUNDS: '9' })).toContain('BCRYPT_ROUNDS');
    expect(errorOf({ ...base, AUTH_ATTEMPTS_PER_MINUTE: '0' })).toContain('AUTH_ATTEMPTS_PER_MINUTE');
    const blueprint = readFileSync(path.resolve(import.meta.dirname, '../../../render.yaml'), 'utf8');
    expect(blueprint).toMatch(/key: BCRYPT_ROUNDS\s+value: '10'/);
    expect(blueprint).toMatch(/key: AUTH_ATTEMPTS_PER_MINUTE\s+value: '20'/);
  });

  it('DEP-TC7: the purge ends each rate-limit window by its own length, so hourly upload counters survive', async () => {
    await pool.query(
      `INSERT INTO "RATE_LIMIT_T" (rlt_key, rlt_window_start, rlt_hits) VALUES
         ('upload:user:1', NOW() - INTERVAL '10 minutes', 5),
         ('upload:user:2', NOW() - INTERVAL '2 hours', 5),
         ('guest:203.0.113.5', NOW() - INTERVAL '10 minutes', 5),
         ('guest:203.0.113.6', NOW() - INTERVAL '10 seconds', 5)`,
    );
    expect(await purgeOldRateLimits()).toBe(2);
    const { rows } = await pool.query<{ rlt_key: string }>(`SELECT rlt_key FROM "RATE_LIMIT_T" ORDER BY rlt_key`);
    expect(rows.map((r) => r.rlt_key)).toEqual(['guest:203.0.113.6', 'upload:user:1']);
  });
});

describe('Proxy secret (R11, D77)', () => {
  afterEach(() => {
    env.PROXY_SECRET = undefined;
  });

  it('DEP-TC19: with PROXY_SECRET set, only requests carrying it reach the API; /api/health stays open, /api/health/db does not', async () => {
    env.PROXY_SECRET = 'proxy-secret-0123456789';
    const direct = await request(app).get('/api/modules').set('X-Forwarded-For', '6.6.6.6');
    expect(direct.status).toBe(403);
    expect(direct.body).toEqual({ error: 'Forbidden' });
    expect((await request(app).get('/api/modules').set('X-Proxy-Secret', 'wrong-secret-0123456789')).status).toBe(403);
    const viaProxy = await request(app).get('/api/modules').set('X-Proxy-Secret', env.PROXY_SECRET);
    expect(viaProxy.status).toBe(401); // past the gate: the route itself wants a session
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/health/db')).status).toBe(403); // only liveness is open (D81)
    env.PROXY_SECRET = undefined;
    expect((await request(app).get('/api/modules')).status).toBe(401); // unset: local dev unchanged
  });
});

describe('Sliding session (R37)', () => {
  const now = () => Math.floor(Date.now() / 1000);
  const cookieFor = (id: number, expiresIn: number, authTime: number | null = now() - 3000) =>
    `notalah_token=${jwt.sign({ role: 'student', ...(authTime === null ? {} : { auth_time: authTime }) }, env.JWT_SECRET, { algorithm: 'HS256', subject: String(id), expiresIn })}`;
  const authCookie = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('notalah_token='));

  it('DEP-TC8: a token with under 15 minutes left is re-issued for a fresh hour, up to the session cap; a fresh token is not', async () => {
    const id = await insertUser();
    const near = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieFor(id, 10 * 60));
    expect(near.status).toBe(200);
    const renewed = authCookie(near);
    expect(renewed).toMatch(/Max-Age=3600/);
    expect(renewed).toMatch(/HttpOnly/);
    expect(renewed).toMatch(/SameSite=Lax/);
    const token = /^notalah_token=([^;]+)/.exec(renewed!)![1];
    const payload = jwt.decode(token, { json: true })!;
    expect(payload.exp! * 1000 - Date.now()).toBeGreaterThan(55 * 60_000);
    // The renewed token keeps the original login time, so the cap counts from login.
    expect(payload.auth_time).toBeLessThanOrEqual(now() - 3000);

    // The guest-readable path (optionalAuth) slides too.
    const guestPath = await request(app)
      .get(`/api/users/${id}`)
      .set('Cookie', cookieFor(id, 5 * 60));
    expect(authCookie(guestPath)).toBeDefined();

    const fresh = await request(app).get('/api/auth/me').set(asUser(id));
    expect(fresh.status).toBe(200);
    expect(authCookie(fresh)).toBeUndefined();

    // Past MAX_SESSION_HOURS (12) since login, or with no login time (a pre-R37 token): still valid, never renewed.
    const capped = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieFor(id, 10 * 60, now() - (env.MAX_SESSION_HOURS * 3600 + 60)));
    expect(capped.status).toBe(200);
    expect(authCookie(capped)).toBeUndefined();
    const legacy = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieFor(id, 10 * 60, null));
    expect(authCookie(legacy)).toBeUndefined();
  });
});
