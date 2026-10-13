import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { createAdmin } from '../../src/scripts/createAdmin';
import { bearer, insertNote, insertUser, truncateAll } from '../helpers';

const superLike = async (lecturerId: number) =>
  request(app).post(`/api/notes/${await insertNote(await insertUser())}/verify`).set('Authorization', bearer(lecturerId));

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
        request(app).get('/api/admin/reports'),
        request(app).post('/api/admin/reports/1/resolve').send({ outcome: 'dismiss', remark: 'x' }),
        request(app).get('/api/admin/users'),
        request(app).post(`/api/admin/users/${pending}/suspend`).send({ reason: 'x' }),
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
    expect((await superLike(id)).status).toBe(201);

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
    expect((await superLike(id)).status).toBe(403);
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

  it('ADM-TC15: a suspended or deleted applicant is not listed and cannot be approved', async () => {
    const admin = bearer(await insertUser({ role: 'admin', email: 'admin@parp.test' }));
    const active = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    const suspended = await insertUser({ lecturerStatus: 'pending', staffId: 'S2', status: 'suspended' });
    const deleted = await insertUser({ lecturerStatus: 'pending', staffId: 'S3', status: 'deleted' });

    const res = await request(app).get(base).set('Authorization', admin);
    expect(res.body.applications.map((x: { id: number }) => x.id)).toEqual([active]);
    for (const id of [suspended, deleted]) {
      expect((await request(app).post(`${base}/${id}/approve`).set('Authorization', admin)).status).toBe(404);
      expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'pending' });
    }
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

describe('admin report queue (UC20) and account actions (UC21)', () => {
  let adminId: number;
  let admin: string;
  let author: number;
  let note: number;
  beforeEach(async () => {
    adminId = await insertUser({ role: 'admin', email: 'admin@parp.test' });
    admin = bearer(adminId);
    author = await insertUser({ displayName: 'Author A' });
    note = await insertNote(author, { title: 'Reported note' });
  });

  const report = async (noteId: number, reason = 'inaccurate') =>
    pool.query(`INSERT INTO "REPORT_T" (rpt_pst_id, rpt_reporter_id, rpt_reason) VALUES ($1, $2, $3)`, [noteId, await insertUser(), reason]);
  const resolve = (noteId: number, body: object) => request(app).post(`/api/admin/reports/${noteId}/resolve`).set('Authorization', admin).send(body);
  const act = (userId: number, action: string, body: object) =>
    request(app).post(`/api/admin/users/${userId}/${action}`).set('Authorization', admin).send(body);
  const reports = async () =>
    (await pool.query('SELECT rpt_status, rpt_resolved_by, rpt_remark, rpt_resolved_at FROM "REPORT_T" ORDER BY rpt_id')).rows;
  const statusOf = async (id: number) => (await pool.query('SELECT usr_status FROM "USER_T" WHERE usr_id = $1', [id])).rows[0].usr_status;
  const noteStatus = async (id: number) => (await pool.query('SELECT pst_status FROM "POST_T" WHERE pst_id = $1', [id])).rows[0].pst_status;

  it('ADM-TC2: resolving without a remark returns 400 and changes nothing', async () => {
    await report(note);
    for (const body of [{ outcome: 'hide', remark: '' }, { outcome: 'hide' }, { outcome: 'hide', remark: '   ' }]) {
      const res = await resolve(note, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Remark is required');
    }
    expect((await reports())[0].rpt_status).toBe('open');
    expect(await noteStatus(note)).toBe('published');
  });

  it('ADM-TC3: dismissing records resolver and time and leaves the note visible', async () => {
    await report(note);
    const res = await resolve(note, { outcome: 'dismiss', remark: 'Content accurate' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: 'dismiss', resolved: 1 });
    expect(await reports()).toEqual([
      { rpt_status: 'dismissed', rpt_resolved_by: adminId, rpt_remark: 'Content accurate', rpt_resolved_at: expect.any(Date) },
    ]);
    expect((await request(app).get(`/api/notes/${note}`).set('Authorization', bearer(await insertUser()))).status).toBe(200);
    expect((await request(app).get('/api/admin/reports').set('Authorization', admin)).body.groups).toEqual([]);
  });

  it('ADM-TC4: hiding removes the note from the feed and direct GET and resolves every open report on it', async () => {
    await report(note);
    await report(note, 'spam');
    const res = await resolve(note, { outcome: 'hide', remark: 'Copied slides' });
    expect(res.body).toEqual({ outcome: 'hide', resolved: 2 });
    expect((await reports()).map((r) => r.rpt_status)).toEqual(['upheld', 'upheld']);
    expect(await noteStatus(note)).toBe('hidden');
    const viewer = bearer(await insertUser());
    expect((await request(app).get(`/api/notes/${note}`).set('Authorization', viewer)).status).toBe(404);
    expect((await request(app).get('/api/feed').set('Authorization', viewer)).body.items).toEqual([]);
    // search is Sprint 4; it will reuse VISIBLE, which already excludes hidden notes for non-authors
    expect((await resolve(note, { outcome: 'hide', remark: 'again' })).status).toBe(404);
  });

  it('ADM-TC5: suspending without a reason returns 400', async () => {
    for (const body of [{ reason: '' }, {}]) {
      const res = await act(author, 'suspend', body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Reason is required');
    }
    expect(await statusOf(author)).toBe('active');
    expect(await actions()).toEqual([]);
  });

  it('ADM-TC6: suspending sets the status, logs it, and the existing token then gets 401', async () => {
    const token = bearer(author);
    expect((await request(app).get('/api/feed').set('Authorization', token)).status).toBe(200);
    const res = await act(author, 'suspend', { reason: 'Repeated spam' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: author, status: 'suspended' });
    expect(await actions()).toEqual([{ aac_usr_id: author, aac_admin_id: adminId, aac_action: 'suspend', aac_reason: 'Repeated spam' }]);
    expect((await request(app).get('/api/feed').set('Authorization', token)).status).toBe(401);
  });

  it('ADM-TC7: a restricted user can read the feed but publishing and commenting return 403', async () => {
    await act(author, 'restrict', { reason: 'Warning' });
    const token = bearer(author);
    expect((await request(app).get('/api/feed').set('Authorization', token)).status).toBe(200);
    const created = await request(app).post('/api/notes').set('Authorization', token).send({ title: 'New', slides: ['<p>x</p>'] });
    expect(created.status).toBe(403);
    const other = await insertNote(await insertUser());
    const commented = await request(app).post(`/api/notes/${other}/comments`).set('Authorization', token).send({ body: 'hi' });
    expect(commented.status).toBe(403);
    // messaging arrives in Sprint 4 behind the same requireActive guard
  });

  it('ADM-TC8: acting on an administrator returns 403 and leaves the status unchanged', async () => {
    const other = await insertUser({ role: 'admin', email: 'admin2@parp.test' });
    for (const action of ['suspend', 'restrict', 'delete']) {
      expect((await act(other, action, { reason: 'Test' })).status).toBe(403);
    }
    expect((await act(adminId, 'suspend', { reason: 'self' })).status).toBe(403);
    expect(await statusOf(other)).toBe('active');
    expect(await actions()).toEqual([]);
  });

  it('ADM-TC16: report queue groups open reports by note, oldest first, with counts and reasons', async () => {
    const newer = await insertNote(author, { title: 'Newer' });
    await report(newer, 'spam');
    await report(note, 'inaccurate');
    await report(note, 'other');
    await pool.query(`UPDATE "REPORT_T" SET rpt_created_at = NOW() - INTERVAL '1 day' WHERE rpt_pst_id = $1`, [note]);
    const dismissed = await insertNote(author);
    await report(dismissed);
    await resolve(dismissed, { outcome: 'dismiss', remark: 'ok' });

    const res = await request(app).get('/api/admin/reports').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body.groups.map((g: { id: number }) => g.id)).toEqual([note, newer]);
    expect(res.body.groups[0]).toMatchObject({ title: 'Reported note', reportCount: 2, author: { id: author, displayName: 'Author A' } });
    expect(res.body.groups[0].reports.map((r: { reason: string }) => r.reason)).toEqual(['inaccurate', 'other']);
    expect(res.body.groups[0].slides).toHaveLength(3);
    expect((await resolve(note, { outcome: 'archive', remark: 'x' })).status).toBe(400);
    expect((await resolve(note, { outcome: 'hide', remark: 'x'.repeat(301) })).body.error).toBe('Remark must be at most 300 characters');
  });

  it('ADM-TC17: user search lists role, status and upheld report count; reinstate restores access', async () => {
    await report(note);
    await resolve(note, { outcome: 'hide', remark: 'Wrong' });
    const res = await request(app).get('/api/admin/users?q=author').set('Authorization', admin);
    expect(res.body.users).toEqual([
      expect.objectContaining({ id: author, displayName: 'Author A', role: 'student', status: 'active', upheldReports: 1 }),
    ]);
    await act(author, 'suspend', { reason: 'Plagiarism' });
    expect((await act(author, 'reinstate', { reason: 'Appeal accepted' })).body.user.status).toBe('active');
    expect((await request(app).get('/api/feed').set('Authorization', bearer(author))).status).toBe(200);
    expect((await act(author, 'ban', { reason: 'x' })).status).toBe(404);
    expect((await act(99999, 'suspend', { reason: 'x' })).status).toBe(404);
  });

  it('ADM-TC18: deleting anonymises the account, hides its notes, and the account cannot be acted on again', async () => {
    const draft = await insertNote(author, { status: 'draft' });
    const res = await act(author, 'delete', { reason: 'Requested by user' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ status: 'deleted', displayName: 'Deleted user', email: `deleted-${author}@invalid` });
    expect(await noteStatus(note)).toBe('hidden');
    expect(await noteStatus(draft)).toBe('draft');
    expect((await request(app).get('/api/feed').set('Authorization', bearer(author))).status).toBe(401);
    expect((await act(author, 'reinstate', { reason: 'x' })).status).toBe(409);
    expect((await actions()).map((a) => a.aac_action)).toEqual(['delete']);
  });
});
