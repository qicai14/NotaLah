import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
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

  it('DEP-TC2: production refuses local storage, an http origin, insecure cookies and loopback trust, naming only the variables', () => {
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
    expect(msg).not.toContain('secret-origin');

    const good = parseEnv({
      ...base,
      NODE_ENV: 'production',
      CLIENT_ORIGIN: 'https://app.example.com',
      COOKIE_SECURE: 'true',
      TRUST_PROXY: '1',
      STORAGE_DRIVER: 'r2',
      R2_ACCOUNT_ID: 'a',
      R2_ACCESS_KEY_ID: 'b',
      R2_SECRET_ACCESS_KEY: 'c',
      R2_BUCKET: 'd',
    });
    expect(good.TRUST_PROXY).toBe(1);
    // The same bad values outside production still parse, so local development is unaffected.
    expect(parseEnv({ ...base, CLIENT_ORIGIN: 'http://localhost:5173', COOKIE_SECURE: 'false' }).STORAGE_DRIVER).toBe(
      'local',
    );
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

describe('Sliding session (R37)', () => {
  const cookieFor = (id: number, expiresIn: number) =>
    `notalah_token=${jwt.sign({ role: 'student' }, env.JWT_SECRET, { algorithm: 'HS256', subject: String(id), expiresIn })}`;
  const authCookie = (res: request.Response) =>
    ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('notalah_token='));

  it('DEP-TC8: a token with under 15 minutes left is re-issued for a fresh hour; a fresh token is not', async () => {
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
    const { exp } = jwt.decode(token, { json: true })!;
    expect(exp! * 1000 - Date.now()).toBeGreaterThan(55 * 60_000);

    // The guest-readable path (optionalAuth) slides too.
    const guestPath = await request(app)
      .get(`/api/users/${id}`)
      .set('Cookie', cookieFor(id, 5 * 60));
    expect(authCookie(guestPath)).toBeDefined();

    const fresh = await request(app).get('/api/auth/me').set(asUser(id));
    expect(fresh.status).toBe(200);
    expect(authCookie(fresh)).toBeUndefined();
  });
});
