import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { requireAuth } from '../../src/features/auth/middleware';
import { PgStore, purgeOldRateLimits } from '../../src/features/auth/rateLimit';
import { type Options, rateLimit } from 'express-rate-limit';
import { asUser, CSRF, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const student = {
  displayName: 'Test Student',
  email: 'test1@mail.apu.edu.my',
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
  programme: 'BSc (Hons) Software Engineering',
  role: 'student',
};

const register = (body: object) => request(app).post('/api/auth/register').set(CSRF).send(body);
const login = (email: string, password: string) => request(app).post('/api/auth/login').set(CSRF).send({ email, password });
const setCookies = (res: request.Response): string[] => ([] as string[]).concat(res.headers['set-cookie'] ?? []);
const tokenFrom = (res: request.Response): string => setCookies(res)[0].match(/^parp_token=([^;]+)/)![1];
const userCount = async () => Number((await pool.query('SELECT COUNT(*) FROM "USER_T"')).rows[0].count);

describe('POST /api/auth/register', () => {
  it('AUTH-TC1: returns an error for each blank required field and creates no account', async () => {
    const res = await register({ displayName: '', email: '', password: '', confirmPassword: '', programme: '', role: 'student' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.errors).toMatchObject({
      displayName: 'Display name is required',
      email: 'Email is required',
      password: 'Password is required',
      programme: 'Programme is required',
    });
    expect(await userCount()).toBe(0);
  });

  it('AUTH-TC2: rejects an invalid email format', async () => {
    const res = await register({ ...student, email: 'student.apu' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ email: 'Invalid email address' });
  });

  it('AUTH-TC3: rejects a password shorter than 8 characters', async () => {
    const res = await register({ ...student, password: 'abc123', confirmPassword: 'abc123' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ password: 'Password must be at least 8 characters' });
  });

  it('AUTH-TC3: rejects a password longer than 72 bytes (bcrypt limit)', async () => {
    const long = 'a'.repeat(73);
    const res = await register({ ...student, password: long, confirmPassword: long });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBe('Password must be at most 72 bytes');
  });

  it('AUTH-TC4: rejects a mismatched confirmation', async () => {
    const res = await register({ ...student, password: 'Passw0rd!', confirmPassword: 'Passw0rd?' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ confirmPassword: 'Passwords do not match' });
  });

  it('AUTH-TC5: creates an active student and stores a 60-character bcrypt hash', async () => {
    const res = await register({ ...student, email: '  Test1@Mail.APU.edu.my ' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'test1@mail.apu.edu.my', role: 'student', status: 'active' });
    expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/i);
    expect(res.body.token).toBeUndefined();

    const { rows } = await pool.query('SELECT usr_password_hash FROM "USER_T" WHERE usr_email = $1', [
      'test1@mail.apu.edu.my',
    ]);
    expect(rows[0].usr_password_hash).toHaveLength(60);
    expect(rows[0].usr_password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(rows[0].usr_password_hash).not.toContain('Passw0rd!');
  });

  it('AUTH-TC6: rejects an email that is already registered', async () => {
    expect((await register(student)).status).toBe(201);
    const res = await register({ ...student, email: 'TEST1@mail.apu.edu.my' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('This email is already registered');
  });

  it('AUTH-TC7: registers a lecturer as a pending student who cannot use lecturer-only routes', async () => {
    const res = await register({ ...student, email: 'lect@apu.edu.my', role: 'lecturer', staffId: 'S1234' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ role: 'student', lecturerStatus: 'pending' });
    const { rows } = await pool.query('SELECT usr_staff_id FROM "USER_T" WHERE usr_id = $1', [res.body.user.id]);
    expect(rows[0].usr_staff_id).toBe('S1234');

    const note = await insertNote(await insertUser());
    const liked = await request(app).post(`/api/notes/${note}/verify`).set(asUser(res.body.user.id));
    expect(liked.status).toBe(403);
    expect(liked.body).toEqual({ error: 'Forbidden' });
  });

  it('AUTH-TC7: requires a staff ID when registering as a lecturer', async () => {
    const res = await register({ ...student, role: 'lecturer' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ staffId: 'Staff ID is required for lecturers' });
  });

  it('AUTH-TC17: GET /api/programmes needs no login and lists the distinct catalogue programmes, sorted', async () => {
    await pool.query(`INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme) VALUES ('TST-ZZ1', 'Extra', 'BSc (Hons) Computer Science')`);
    const res = await request(app).get('/api/programmes');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([
      'BSc (Hons) Computer Science',
      'BSc (Hons) Information Technology',
      'BSc (Hons) Software Engineering',
    ]);
    await pool.query(`DELETE FROM "MODULE_T" WHERE mod_code = 'TST-ZZ1'`);
  });

  it('AUTH-TC18: registering with a programme outside the catalogue is rejected', async () => {
    const res = await register({ ...student, programme: 'Underwater Basket Weaving' });
    expect(res.status).toBe(400);
    expect(res.body.errors.programme).toBe('Choose a programme from the list');
    expect(await userCount()).toBe(0);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await insertUser({ email: 'test1@mail.apu.edu.my', password: 'Passw0rd!', displayName: 'Test Student' });
  });

  it('AUTH-TC8: wrong password and unknown email get the same 401 and no token', async () => {
    const wrong = await login('test1@mail.apu.edu.my', 'wrong');
    const unknown = await login('nobody@mail.apu.edu.my', 'Passw0rd!');
    for (const res of [wrong, unknown]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Invalid email or password' });
    }
  });

  it('AUTH-TC8: blank fields return 400', async () => {
    const res = await login('', '');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('AUTH-TC9: valid credentials set a signed JWT cookie with user id and role; /me returns the user', async () => {
    const res = await login(' TEST1@mail.apu.edu.my', 'Passw0rd!');
    expect(res.status).toBe(200);
    const claims = jwt.verify(tokenFrom(res), env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(claims.sub).toBe(String(res.body.user.id));
    expect(claims.role).toBe('student');
    expect(claims.exp! - claims.iat!).toBe(3600);

    const me = await request(app).get('/api/auth/me').set('Cookie', `parp_token=${tokenFrom(res)}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'test1@mail.apu.edu.my', displayName: 'Test Student' });
  });
});

describe('protected routes', () => {
  it('AUTH-TC10: no token 401, tampered token 401, valid token 200, suspended login 403, deleted login 401', async () => {
    await insertUser({ email: 'test1@mail.apu.edu.my' });
    const token = tokenFrom(await login('test1@mail.apu.edu.my', 'Passw0rd!'));
    const me = (jwtValue?: string) => {
      const r = request(app).get('/api/auth/me');
      return jwtValue ? r.set('Cookie', `parp_token=${jwtValue}`) : r;
    };

    expect((await me()).status).toBe(401);
    const [h, p, s] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'admin' })).toString('base64url');
    expect((await me(`${h}.${forgedPayload}.${s}`)).status).toBe(401);
    expect((await me(jwt.sign({ sub: '1' }, 'not-the-server-secret-at-all'))).status).toBe(401);
    expect((await me(token)).status).toBe(200);

    await insertUser({ email: 'gone@mail.apu.edu.my', status: 'suspended' });
    const res = await login('gone@mail.apu.edu.my', 'Passw0rd!');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'This account is suspended' });
    expect(res.body.token).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();

    // A deleted account is indistinguishable from an unknown one.
    await insertUser({ email: 'deleted@mail.apu.edu.my', status: 'deleted' });
    const del = await login('deleted@mail.apu.edu.my', 'Passw0rd!');
    expect(del.status).toBe(401);
    expect(del.body).toEqual({ error: 'Invalid email or password' });
  });

  it('AUTH-TC10: an existing token stops working once the user is suspended', async () => {
    const id = await insertUser();
    const auth = asUser(id);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(200);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [id]);
    expect((await request(app).get('/api/auth/me').set(auth)).status).toBe(401);
  });

  it('AUTH-TC12: a bearer header alone is rejected with 401', async () => {
    const token = asUser(await insertUser()).Cookie.slice('parp_token='.length);
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns JSON 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});

describe('auth cookie and CSRF (D35)', () => {
  beforeEach(async () => {
    await insertUser({ email: 'test1@mail.apu.edu.my', password: 'Passw0rd!' });
  });

  it('AUTH-TC11: login sets an httpOnly SameSite=Lax cookie for 1 hour; register sets none; no token in either body', async () => {
    const res = await login('test1@mail.apu.edu.my', 'Passw0rd!');
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(tokenFrom(res));
    const cookie = setCookies(res)[0];
    expect(cookie).toMatch(/^parp_token=[^;]+; Max-Age=3600; Path=\/; Expires=[^;]+; HttpOnly; SameSite=Lax$/);

    const reg = await register({ ...student, email: 'new@mail.apu.edu.my' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeUndefined();
    expect(reg.headers['set-cookie']).toBeUndefined();
  });

  it('AUTH-TC13: logout clears the cookie with 204, even when the token is invalid', async () => {
    const valid = `parp_token=${tokenFrom(await login('test1@mail.apu.edu.my', 'Passw0rd!'))}`;
    for (const cookie of [valid, 'parp_token=garbage']) {
      const res = await request(app).post('/api/auth/logout').set(CSRF).set('Cookie', cookie);
      expect(res.status).toBe(204);
      expect(setCookies(res)[0]).toBe('parp_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax');
    }
  });

  it('AUTH-TC14: a state-changing request without X-Requested-With: parp gets 403', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'test1@mail.apu.edu.my', password: 'Passw0rd!' });
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
    expect(res.headers['set-cookie']).toBeUndefined();

    const id = await insertUser();
    const { Cookie } = asUser(id);
    const note = await insertNote(id);
    expect((await request(app).post(`/api/notes/${note}/like`).set('Cookie', Cookie)).status).toBe(403);
    expect((await request(app).delete(`/api/notes/${note}`).set('Cookie', Cookie).set('X-Requested-With', 'XMLHttpRequest')).status).toBe(403);
    expect((await request(app).get('/api/auth/me').set('Cookie', Cookie)).status).toBe(200);
  });

  it('AUTH-TC16: reads only the exact parp_token cookie among several', async () => {
    const token = tokenFrom(await login('test1@mail.apu.edu.my', 'Passw0rd!'));
    const me = (cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie);
    expect((await me(`xparp_token=garbage; other=1; parp_token=${token}`)).status).toBe(200);
    expect((await me(`xparp_token=${token}`)).status).toBe(401);
  });

  it('AUTH-TC15: the cookie carries the Secure flag when COOKIE_SECURE=true', async () => {
    const before = env.COOKIE_SECURE;
    env.COOKIE_SECURE = true;
    try {
      const res = await login('test1@mail.apu.edu.my', 'Passw0rd!');
      expect(setCookies(res)[0]).toMatch(/; HttpOnly; Secure; SameSite=Lax$/);
    } finally {
      env.COOKIE_SECURE = before;
    }
  });
});

describe('Shared rate-limit store (D40)', () => {
  const store = () => {
    const s = new PgStore('test:');
    s.init({ windowMs: 60_000 } as Options);
    return s;
  };
  const hits = async (key: string) =>
    (await pool.query(`SELECT rlt_hits FROM "RATE_LIMIT_T" WHERE rlt_key = $1`, [key])).rows[0]?.rlt_hits;

  it('AUTH-TC19: the Postgres store counts per key, restarts after the window, and is shared by instances', async () => {
    const [a, b] = [store(), store()]; // two API instances
    expect((await a.increment('k')).totalHits).toBe(1);
    const second = await b.increment('k');
    expect(second.totalHits).toBe(2);
    expect(second.resetTime!.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect((await a.increment('other')).totalHits).toBe(1);
    await b.decrement('k');
    expect(await hits('test:k')).toBe(1);
    await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_window_start = NOW() - INTERVAL '61 seconds' WHERE rlt_key = 'test:k'`);
    expect((await a.increment('k')).totalHits).toBe(1); // a new window
    await a.resetKey('k');
    expect(await hits('test:k')).toBeUndefined();
    await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_window_start = NOW() - INTERVAL '2 minutes'`);
    expect(await purgeOldRateLimits()).toBe(1);

    const limited = express().use(rateLimit({ windowMs: 60_000, limit: 2, store: new PgStore('e2e:') })).post('/', (_req, res) => {
      res.status(204).end();
    });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(limited).post('/')).status);
    expect(statuses).toEqual([204, 204, 429]);
  });
});
