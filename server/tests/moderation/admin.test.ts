import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { createAdmin } from '../../src/scripts/createAdmin';
import { asUser, CSRF, insertNote, insertUser, textSlide, truncateAll } from '../helpers';

const superLike = async (lecturerId: number) =>
  request(app)
    .post(`/api/notes/${await insertNote(await insertUser())}/verify`)
    .set(asUser(lecturerId));

beforeEach(truncateAll);
afterAll(() => pool.end());

const base = '/api/admin/lecturer-applications';
const actions = async () =>
  (await pool.query('SELECT aac_usr_id, aac_admin_id, aac_action, aac_reason FROM "ACCOUNT_ACTION_T"')).rows;
const roleOf = async (id: number) =>
  (await pool.query('SELECT usr_role, usr_lecturer_status FROM "USER_T" WHERE usr_id = $1', [id])).rows[0];

describe('admin lecturer approval (UC22)', () => {
  let admin: Record<string, string>;
  beforeEach(async () => {
    admin = asUser(await insertUser({ role: 'admin', email: 'admin@parp.test' }));
  });

  it('ADM-TC1: student and lecturer tokens get 403 on every admin endpoint', async () => {
    const pending = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    const tokens = [
      asUser(await insertUser()),
      asUser(await insertUser({ role: 'lecturer', lecturerStatus: 'approved' })),
    ];
    for (const auth of tokens) {
      const calls = [
        request(app).get(base),
        request(app).post(`${base}/${pending}/approve`),
        request(app).post(`${base}/${pending}/reject`).send({ reason: 'x' }),
        request(app).get('/api/admin/reports'),
        request(app).get('/api/admin/reports/1'),
        request(app).post('/api/admin/reports/1/resolve').send({ outcome: 'dismiss', remark: 'x' }),
        request(app).get('/api/admin/users'),
        request(app).post(`/api/admin/users/${pending}/suspend`).send({ reason: 'x' }),
      ];
      for (const call of calls) {
        const res = await call.set(auth);
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

    const res = await request(app).get(base).set(admin);
    expect(res.status).toBe(200);
    expect(res.body.applications.map((x: { id: number }) => x.id)).toEqual([b, a]);
    expect(res.body.applications[0]).toMatchObject({
      displayName: 'B',
      staffId: 'S2',
      programme: 'Software Engineering',
    });
    expect(res.body.applications[0].email).toBeDefined();
    expect(res.body.applications[0].createdAt).toBeDefined();
  });

  it('ADM-TC9: approving makes the user a lecturer, logs it, and lecturer-only access follows', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S1234' });
    const res = await request(app).post(`${base}/${id}/approve`).set(admin).send({});
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id, role: 'lecturer', lecturerStatus: 'approved' });
    expect(await roleOf(id)).toEqual({ usr_role: 'lecturer', usr_lecturer_status: 'approved' });
    expect(await actions()).toEqual([
      { aac_usr_id: id, aac_admin_id: expect.any(Number), aac_action: 'approve_lecturer', aac_reason: 'Approved' },
    ]);
    // The same token now sees the new role (role read from the DB on each request).
    const me = await request(app).get('/api/auth/me').set(asUser(id));
    expect(me.body.user.role).toBe('lecturer');
    expect((await superLike(id)).status).toBe(201);

    const again = await request(app).post(`${base}/${id}/approve`).set(admin);
    expect(again.status).toBe(404);
  });

  it('ADM-TC10: rejecting with a reason keeps the user a student and logs it', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S9' });
    const res = await request(app)
      .post(`${base}/${id}/reject`)
      .set(admin)
      .send({ reason: 'Staff ID not found in directory' });
    expect(res.status).toBe(200);
    expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'rejected' });
    expect(await actions()).toEqual([
      {
        aac_usr_id: id,
        aac_admin_id: expect.any(Number),
        aac_action: 'reject_lecturer',
        aac_reason: 'Staff ID not found in directory',
      },
    ]);
    const me = await request(app).get('/api/auth/me').set(asUser(id));
    expect(me.body.user.role).toBe('student');
    expect((await superLike(id)).status).toBe(403);
  });

  it('ADM-TC10: rejecting without a reason returns 400 and changes nothing', async () => {
    const id = await insertUser({ lecturerStatus: 'pending', staffId: 'S9' });
    for (const body of [{}, { reason: '   ' }]) {
      const res = await request(app).post(`${base}/${id}/reject`).set(admin).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Reason is required');
    }
    expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'pending' });
    expect(await actions()).toEqual([]);
  });

  it('ADM-TC12: returns 400 for an invalid id and 404 for unknown or non-pending users', async () => {
    const student = await insertUser();
    expect((await request(app).post(`${base}/abc/approve`).set(admin)).status).toBe(400);
    expect((await request(app).post(`${base}/99999/approve`).set(admin)).status).toBe(404);
    expect((await request(app).post(`${base}/${student}/approve`).set(admin)).status).toBe(404);
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
    const admin = asUser(await insertUser({ role: 'admin', email: 'admin@parp.test' }));
    const active = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    const suspended = await insertUser({ lecturerStatus: 'pending', staffId: 'S2', status: 'suspended' });
    const deleted = await insertUser({ lecturerStatus: 'pending', staffId: 'S3', status: 'deleted' });

    const res = await request(app).get(base).set(admin);
    expect(res.body.applications.map((x: { id: number }) => x.id)).toEqual([active]);
    for (const id of [suspended, deleted]) {
      expect((await request(app).post(`${base}/${id}/approve`).set(admin)).status).toBe(404);
      expect(await roleOf(id)).toEqual({ usr_role: 'student', usr_lecturer_status: 'pending' });
    }
  });

  it('ADM-TC14: creates an admin, and promotes an existing account with the same email', async () => {
    const id = await insertUser({ email: 'root@parp.test', lecturerStatus: 'pending' });
    const user = await createAdmin(valid);
    expect(user).toMatchObject({ id, email: 'root@parp.test', role: 'admin', lecturerStatus: null });
    const res = await request(app)
      .post('/api/auth/login')
      .set(CSRF)
      .send({ email: 'root@parp.test', password: 'Str0ngAdminPass' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
  });
});

describe('admin report queue (UC20) and account actions (UC21)', () => {
  let adminId: number;
  let admin: Record<string, string>;
  let author: number;
  let note: number;
  beforeEach(async () => {
    adminId = await insertUser({ role: 'admin', email: 'admin@parp.test' });
    admin = asUser(adminId);
    author = await insertUser({ displayName: 'Author A' });
    note = await insertNote(author, { title: 'Reported note' });
  });

  const report = async (noteId: number, reason = 'inaccurate') =>
    pool.query(`INSERT INTO "REPORT_T" (rpt_pst_id, rpt_reporter_id, rpt_reason) VALUES ($1, $2, $3)`, [
      noteId,
      await insertUser(),
      reason,
    ]);
  const resolve = (noteId: number, body: object) =>
    request(app).post(`/api/admin/reports/${noteId}/resolve`).set(admin).send(body);
  const act = (userId: number, action: string, body: object) =>
    request(app).post(`/api/admin/users/${userId}/${action}`).set(admin).send(body);
  const reports = async () =>
    (
      await pool.query(
        'SELECT rpt_status, rpt_resolved_by, rpt_remark, rpt_resolved_at FROM "REPORT_T" ORDER BY rpt_id',
      )
    ).rows;
  const statusOf = async (id: number) =>
    (await pool.query('SELECT usr_status FROM "USER_T" WHERE usr_id = $1', [id])).rows[0].usr_status;
  const noteStatus = async (id: number) =>
    (await pool.query('SELECT pst_status FROM "POST_T" WHERE pst_id = $1', [id])).rows[0].pst_status;

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
      {
        rpt_status: 'dismissed',
        rpt_resolved_by: adminId,
        rpt_remark: 'Content accurate',
        rpt_resolved_at: expect.any(Date),
      },
    ]);
    expect(
      (
        await request(app)
          .get(`/api/notes/${note}`)
          .set(asUser(await insertUser()))
      ).status,
    ).toBe(200);
    expect((await request(app).get('/api/admin/reports').set(admin)).body.groups).toEqual([]);
  });

  it('ADM-TC4: hiding removes the note from the feed and direct GET and resolves every open report on it', async () => {
    await report(note);
    await report(note, 'spam');
    const res = await resolve(note, { outcome: 'hide', remark: 'Copied slides' });
    expect(res.body).toEqual({ outcome: 'hide', resolved: 2 });
    expect((await reports()).map((r) => r.rpt_status)).toEqual(['upheld', 'upheld']);
    expect(await noteStatus(note)).toBe('hidden');
    const viewer = asUser(await insertUser());
    expect((await request(app).get(`/api/notes/${note}`).set(viewer)).status).toBe(404);
    expect((await request(app).get('/api/feed').set(viewer)).body.items).toEqual([]);
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
    const token = asUser(author);
    expect((await request(app).get('/api/auth/me').set(token)).status).toBe(200);
    const res = await act(author, 'suspend', { reason: 'Repeated spam' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: author, status: 'suspended' });
    expect(await actions()).toEqual([
      { aac_usr_id: author, aac_admin_id: adminId, aac_action: 'suspend', aac_reason: 'Repeated spam' },
    ]);
    expect((await request(app).get('/api/auth/me').set(token)).status).toBe(401);
  });

  it('ADM-TC7: a restricted user can read the feed but publishing and commenting return 403', async () => {
    await act(author, 'restrict', { reason: 'Warning' });
    const token = asUser(author);
    expect((await request(app).get('/api/feed').set(token)).status).toBe(200);
    const created = await request(app)
      .post('/api/notes')
      .set(token)
      .send({ title: 'New', slides: [textSlide('<p>x</p>')] });
    expect(created.status).toBe(403);
    const other = await insertNote(await insertUser());
    const commented = await request(app).post(`/api/notes/${other}/comments`).set(token).send({ body: 'hi' });
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

    const res = await request(app).get('/api/admin/reports').set(admin);
    expect(res.status).toBe(200);
    expect(res.body.groups.map((g: { id: number }) => g.id)).toEqual([note, newer]);
    expect(res.body.groups[0]).toMatchObject({
      title: 'Reported note',
      reportCount: 2,
      author: { id: author, displayName: 'Author A' },
    });
    expect(res.body.groups[0].reports.map((r: { reason: string }) => r.reason)).toEqual(['inaccurate', 'other']);
    expect(res.body.groups[0].slides).toBeUndefined(); // the queue carries summaries only; the review panel loads the note (ADM-TC30)
    expect(res.body.nextCursor).toBeNull();
    expect((await resolve(note, { outcome: 'archive', remark: 'x' })).status).toBe(400);
    expect((await resolve(note, { outcome: 'hide', remark: 'x'.repeat(301) })).body.error).toBe(
      'Remark must be at most 300 characters',
    );
  });

  it('ADM-TC29: the report queue pages 20 groups at a time by oldest report, then note id', async () => {
    const notes = [note];
    for (let i = 0; i < 22; i++) notes.push(await insertNote(author));
    for (const n of notes) await report(n);
    await pool.query(`UPDATE "REPORT_T" SET rpt_created_at = '2026-10-01T00:00:00.123456Z'`); // one shared timestamp: ties break on id
    const page = (cursor?: string) =>
      request(app)
        .get('/api/admin/reports')
        .query(cursor ? { cursor } : {})
        .set(admin);
    const p1 = await page();
    expect(p1.body.groups).toHaveLength(20);
    expect(p1.body.nextCursor).toMatch(/^\d+_\d+$/);
    const p2 = await page(p1.body.nextCursor);
    expect([...p1.body.groups, ...p2.body.groups].map((g: { id: number }) => g.id)).toEqual(notes);
    expect(p2.body.nextCursor).toBeNull();
    expect((await page('abc')).status).toBe(400);
  });

  it('ADM-TC30: the review panel fetches one reported note in full with its open reports', async () => {
    await report(note, 'spam');
    const get = (id: number | string) => request(app).get(`/api/admin/reports/${id}`).set(admin);
    const res = await get(note);
    expect(res.status).toBe(200);
    expect(res.body.group).toMatchObject({
      id: note,
      title: 'Reported note',
      reportCount: 1,
      reports: [{ reason: 'spam' }],
    });
    expect(res.body.group.slides).toHaveLength(3);
    expect((await get(await insertNote(author))).status).toBe(404); // no open reports
    expect((await get('abc')).status).toBe(400);
    await resolve(note, { outcome: 'dismiss', remark: 'Fine' });
    expect((await get(note)).status).toBe(404);
  });

  it('ADM-TC17: user search lists role, status and upheld report count; reinstate restores access', async () => {
    await report(note);
    await resolve(note, { outcome: 'hide', remark: 'Wrong' });
    const res = await request(app).get('/api/admin/users?q=author').set(admin);
    expect(res.body.users).toEqual([
      expect.objectContaining({
        id: author,
        displayName: 'Author A',
        role: 'student',
        status: 'active',
        upheldReports: 1,
      }),
    ]);
    await act(author, 'suspend', { reason: 'Plagiarism' });
    expect((await act(author, 'reinstate', { reason: 'Appeal accepted' })).body.user.status).toBe('active');
    expect((await request(app).get('/api/auth/me').set(asUser(author))).status).toBe(200);
    expect((await act(author, 'ban', { reason: 'x' })).status).toBe(404);
    expect((await act(99999, 'suspend', { reason: 'x' })).status).toBe(404);
  });

  it('ADM-TC18: deleting anonymises the account, hides its notes, and the account cannot be acted on again', async () => {
    const draft = await insertNote(author, { status: 'draft' });
    const lect = await insertUser({
      role: 'lecturer',
      lecturerStatus: 'approved',
      staffId: 'S77',
      displayName: 'Dr Gone',
    });
    const other = await insertNote(await insertUser());
    await request(app).post(`/api/notes/${other}/comments`).set(asUser(lect)).send({ body: 'Lecturer tip' });
    const thread = async () =>
      (await request(app).get(`/api/notes/${other}/comments`).set(asUser(author))).body.comments[0];
    expect(await thread()).toMatchObject({ pinned: true, author: { isVerifiedLecturer: true } });
    await act(lect, 'delete', { reason: 'Left the university' });
    expect(await thread()).toMatchObject({
      pinned: false,
      author: { displayName: 'Deleted user', isVerifiedLecturer: false },
    });
    expect(
      (await pool.query('SELECT usr_programme, usr_lecturer_status FROM "USER_T" WHERE usr_id = $1', [lect])).rows[0],
    ).toEqual({ usr_programme: null, usr_lecturer_status: null });

    const res = await act(author, 'delete', { reason: 'Requested by user' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      status: 'deleted',
      displayName: 'Deleted user',
      email: `deleted-${author}@invalid`,
    });
    expect(await noteStatus(note)).toBe('hidden');
    expect(await noteStatus(draft)).toBe('draft');
    expect((await request(app).get('/api/auth/me').set(asUser(author))).status).toBe(401);
    expect((await act(author, 'reinstate', { reason: 'x' })).status).toBe(409);
    expect((await actions()).map((a) => a.aac_action)).toEqual(['delete', 'delete']);
  });

  it('ADM-TC19: open reports on a note its author deleted leave the queue and cannot be resolved', async () => {
    await report(note);
    await pool.query(`UPDATE "POST_T" SET pst_status = 'deleted' WHERE pst_id = $1`, [note]);
    expect((await request(app).get('/api/admin/reports').set(admin)).body.groups).toEqual([]);
    expect((await resolve(note, { outcome: 'dismiss', remark: 'Gone' })).status).toBe(404);
    expect((await reports())[0].rpt_status).toBe('open');
  });

  it("ADM-TC20: suspending takes the author's notes out of view for others; reinstating restores them", async () => {
    const viewerId = await insertUser();
    const viewer = asUser(viewerId);
    await pool.query(`INSERT INTO "BOOKMARK_T" (bmk_usr_id, bmk_pst_id) VALUES ($1, $2)`, [viewerId, note]);
    const seen = async () => [
      (await request(app).get(`/api/notes/${note}`).set(viewer)).status,
      (await request(app).get('/api/feed').set(viewer)).body.items.length,
      (await request(app).get('/api/bookmarks').set(viewer)).body.notes.length,
      (await request(app).get(`/api/users/${author}`).set(viewer)).body.user?.notes.length ?? 'no profile',
    ];
    expect(await seen()).toEqual([200, 1, 1, 1]);
    await act(author, 'suspend', { reason: 'Spam' });
    expect(await seen()).toEqual([404, 0, 0, 'no profile']); // the profile itself is hidden too (USR-TC27)
    expect((await request(app).get('/api/admin/reports').set(admin)).status).toBe(200);
    await act(author, 'reinstate', { reason: 'Appeal accepted' });
    expect(await seen()).toEqual([200, 1, 1, 1]);
  });
});
