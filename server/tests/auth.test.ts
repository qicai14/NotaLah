import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { env } from '../src/config/env';
import { pool } from '../src/db/pool';
import { requireAuth, requireRole } from '../src/middleware/auth';
import { bearer, insertUser, truncateAll } from './helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const student = {
  displayName: 'Test Student',
  email: 'test1@mail.apu.edu.my',
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
  programme: 'Software Engineering',
  role: 'student',
};

const register = (body: object) => request(app).post('/api/auth/register').send(body);
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });
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

    // Stand-in for Super Like until it exists: any requireRole('lecturer') route.
    const superLike = express().post('/like', requireAuth, requireRole('lecturer'), (_req, r) => {
      r.json({ ok: true });
    });
    const liked = await request(superLike).post('/like').set('Authorization', bearer(res.body.user.id));
    expect(liked.status).toBe(403);
    expect(liked.body).toEqual({ error: 'Forbidden' });
  });

  it('AUTH-TC7: requires a staff ID when registering as a lecturer', async () => {
    const res = await register({ ...student, role: 'lecturer' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ staffId: 'Staff ID is required for lecturers' });
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

  it('AUTH-TC9: valid credentials return a signed JWT with user id and role; /me returns the user', async () => {
    const res = await login(' TEST1@mail.apu.edu.my', 'Passw0rd!');
    expect(res.status).toBe(200);
    const claims = jwt.verify(res.body.token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    expect(claims.sub).toBe(String(res.body.user.id));
    expect(claims.role).toBe('student');
    expect(claims.exp! - claims.iat!).toBe(3600);

    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ email: 'test1@mail.apu.edu.my', displayName: 'Test Student' });
  });
});

describe('protected routes', () => {
  it('AUTH-TC10: no token 401, tampered token 401, valid token 200, suspended login 403', async () => {
    await insertUser({ email: 'test1@mail.apu.edu.my' });
    const { token } = (await login('test1@mail.apu.edu.my', 'Passw0rd!')).body;
    const me = (auth?: string) => {
      const r = request(app).get('/api/auth/me');
      return auth ? r.set('Authorization', auth) : r;
    };

    expect((await me()).status).toBe(401);
    const [h, p, s] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'admin' })).toString('base64url');
    expect((await me(`Bearer ${h}.${forgedPayload}.${s}`)).status).toBe(401);
    expect((await me(`Bearer ${jwt.sign({ sub: '1' }, 'not-the-server-secret-at-all')}`)).status).toBe(401);
    expect((await me(`Bearer ${token}`)).status).toBe(200);

    await insertUser({ email: 'gone@mail.apu.edu.my', status: 'suspended' });
    const res = await login('gone@mail.apu.edu.my', 'Passw0rd!');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'This account is suspended' });
    expect(res.body.token).toBeUndefined();
  });

  it('AUTH-TC10: an existing token stops working once the user is suspended', async () => {
    const id = await insertUser();
    const auth = bearer(id);
    expect((await request(app).get('/api/auth/me').set('Authorization', auth)).status).toBe(200);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [id]);
    expect((await request(app).get('/api/auth/me').set('Authorization', auth)).status).toBe(401);
  });

  it('returns JSON 404 for unknown /api routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
