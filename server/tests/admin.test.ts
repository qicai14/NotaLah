import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { pool } from '../src/db/pool';
import { createAdmin } from '../src/scripts/createAdmin';
import { bearer, insertUser, lecturerOnlyApp, truncateAll } from './helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const base = '/api/admin/lecturer-applications';
const actions = async () =>
  (await pool.query('SELECT aac_usr_id, aac_admin_id, aac_action, aac_reason FROM "ACCOUNT_ACTION_T"')).rows;
const roleOf = async (id: number) =>
  (await pool.query('SELECT usr_role, usr_lecturer_status FROM "USER_T" WHERE usr_id = $1', [id])).rows[0];

describe('admin lecturer approval (UC22)', () => {
  let admin: string;
  beforeEach(async () => {
    admin = bearer(await insertUser({ role: 'admin', email: 'admin@parp.test' }));
  });

  it('ADM-TC1: student and lecturer tokens get 403 on every admin endpoint', async () => {
    const pending = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    const tokens = [
      bearer(await insertUser()),
      bearer(await insertUser({ role: 'lecturer', lecturerStatus: 'approved' })),
    ];
    for (const auth of tokens) {
      const calls = [
        request(app).get(base),
        request(app).post(`${base}/${pending}/approve`),
        request(app).post(`${base}/${pending}/reject`).send({ reason: 'x' }),
      ];
      for (const call of calls) {
        const res = await call.set('Authorization', auth);
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ error: 'Forbidden' });
      }
    }
    expect((await request(app).get(base)).status).toBe(401);
    expect(await roleOf(pending)).toEqual({ usr_role: 'student', usr_lecturer_status: 'pending' });
  });

  it('ADM-TC11: lists pending applications oldest first', async () => {
    const a = await insertUser({ lecturerStatus: 'pending', staffId: 'S1', displayName: 'A' });
    const b = await insertUser({ lecturerStatus: 'pending', staffId: 'S2', displayName: 'B' });
    await pool.query(`UPDATE "USER_T" SET usr_created_at = NOW() - INTERVAL '1 day' WHERE usr_id = $1`, [b]);
    await insertUser({ lecturerStatus: 'rejected', staffId: 'S3' });
    await insertUser();

    const res = await request(app).get(base).set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body.applications.map((x: { id: number }) => x.id)).toEqual([b, a]);
    expect(res.body.applications[0]).toMatchObject({ displayName: 'B', staffId: 'S2', programme: 'Software Engineering' });
    expect(res.body.applications[0].email).toBeDefined();
    expect(res.body.applications[0].createdAt).toBeDefined();
  });

  it('ADM-TC9: approving makes the user a lecturer, logs it, and lecturer-only access follows', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S1234' });
    const res = await request(app).post(`${base}/${id}/approve`).set('Authorization', admin).send({});
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id, role: 'lecturer', lecturerStatus: 'approved' });
    expect(await roleOf(id)).toEqual({ usr_role: 'lecturer', usr_lecturer_status: 'approved' });
    expect(await actions()).toEqual([
      { aac_usr_id: id, aac_admin_id: expect.any(Number), aac_action: 'approve_lecturer', aac_reason: 'Approved' },
    ]);
    // The same token now sees the new role (role read from the DB on each request).
    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(id));
    expect(me.body.user.role).toBe('lecturer');
    const like = await request(lecturerOnlyApp).post('/like').set('Authorization', bearer(id));
    expect(like.status).toBe(200);

    const again = await request(app).post(`${base}/${id}/approve`).set('Authorization', admin);
    expect(again.status).toBe(404);
  });

  it('ADM-TC10: rejecting with a reason keeps the user a student and logs it', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S9' });
    const res = await request(app)
      .post(`${base}/${id}/reject`)
      .set('Authorization', admin)
      .send({ reason: 'Staff ID not found in directory' });
    expect(res.status).toBe(200);
    expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'rejected' });
    expect(await actions()).toEqual([
      { aac_usr_id: id, aac_admin_id: expect.any(Number), aac_action: 'reject_lecturer', aac_reason: 'Staff ID not found in directory' },
    ]);
    const me = await request(app).get('/api/auth/me').set('Authorization', bearer(id));
    expect(me.body.user.role).toBe('student');
    const like = await request(lecturerOnlyApp).post('/like').set('Authorization', bearer(id));
    expect(like.status).toBe(403);
  });

  it('ADM-TC10: rejecting without a reason returns 400 and changes nothing', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S9' });
    for (const body of [{}, { reason: '   ' }]) {
      const res = await request(app).post(`${base}/${id}/reject`).set('Authorization', admin).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Reason is required');
    }
    expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'pending' });
    expect(await actions()).toEqual([]);
  });

  it('ADM-TC12: returns 400 for an invalid id and 404 for unknown or non-pending users', async () => {
    const student = await insertUser();
    expect((await request(app).post(`${base}/abc/approve`).set('Authorization', admin)).status).toBe(400);
    expect((await request(app).post(`${base}/99999/approve`).set('Authorization', admin)).status).toBe(404);
    expect((await request(app).post(`${base}/${student}/approve`).set('Authorization', admin)).status).toBe(404);
  });
});

describe('admin:create bootstrap script', () => {
  const valid = { ADMIN_EMAIL: ' Root@PARP.test ', ADMIN_PASSWORD: 'Str0ngAdminPass', ADMIN_NAME: 'Root' };

  it('ADM-TC13: refuses missing or weak values', async () => {
    await expect(createAdmin({})).rejects.toThrow(/ADMIN_EMAIL/);
    await expect(createAdmin({ ...valid, ADMIN_PASSWORD: 'short' })).rejects.toThrow(/at least 12/);
    await expect(createAdmin({ ...valid, ADMIN_PASSWORD: 'alllowercase1234' })).rejects.toThrow(/upper/);
  });

  it('ADM-TC14: creates an admin, and promotes an existing account with the same email', async () => {
    const id = await insertUser({ email: 'root@parp.test', lecturerStatus: 'pending' });
    const user = await createAdmin(valid);
    expect(user).toMatchObject({ id, email: 'root@parp.test', role: 'admin', lecturerStatus: null });
    const res = await request(app).post('/api/auth/login').send({ email: 'root@parp.test', password: 'Str0ngAdminPass' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
});
