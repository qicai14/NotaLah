import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, insertNote, insertUser, truncateAll, type TestUserInput } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const lecturer = (o: TestUserInput = {}) =>
  insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12), ...o });
const verify = (uid: number, noteId: number | string, body?: object) =>
  request(app).post(`/api/notes/${noteId}/verify`).set(asUser(uid)).send(body);
const unverify = (uid: number, noteId: number) => request(app).delete(`/api/notes/${noteId}/verify`).set(asUser(uid));
const rows = async () => (await pool.query('SELECT ver_pst_id, ver_usr_id, ver_remark FROM "VERIFICATION_T"')).rows;
const feedItem = async (viewer: number, id: number) =>
  (await request(app).get('/api/feed').set(asUser(viewer))).body.items.find((i: { id: number }) => i.id === id);

describe('Lecturer Super Like (UC19)', () => {
  let student: number;
  let note: number;
  beforeEach(async () => {
    student = await insertUser({ displayName: 'Student S' });
    note = await insertNote(student);
  });

  it('VER-TC1: a student gets 403 and nothing is stored', async () => {
    const res = await verify(await insertUser(), note);
    expect(res.status).toBe(403);
    expect(await rows()).toEqual([]);
  });

  it('VER-TC2: a pending lecturer gets 403', async () => {
    const pending = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    expect((await verify(pending, note)).status).toBe(403);
    // a lecturer-role account whose approval is not 'approved' is refused too
    expect((await verify(await lecturer({ lecturerStatus: 'pending' }), note)).status).toBe(403);
    expect(await rows()).toEqual([]);
  });

  it('VER-TC3: verifying a non-existent post returns 404', async () => {
    expect((await verify(await lecturer(), 999999)).status).toBe(404);
  });

  it('VER-TC4: verifying own note returns 409', async () => {
    const l = await lecturer();
    const own = await insertNote(l);
    const res = await verify(l, own);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Cannot verify own note');
    expect(await rows()).toEqual([]);
  });

  it('VER-TC5: verifying a draft returns 404', async () => {
    const draft = await insertNote(student, { status: 'draft' });
    expect((await verify(await lecturer(), draft)).status).toBe(404);
  });

  it('VER-TC6: a remark over 300 characters returns 400', async () => {
    const res = await verify(await lecturer(), note, { remark: 'x'.repeat(301) });
    expect(res.status).toBe(400);
    expect(res.body.errors.remark).toBe('Remark must be at most 300 characters');
    expect(await rows()).toEqual([]);
  });

  it('VER-TC7: an approved lecturer verifies a student note with a remark', async () => {
    const l = await lecturer({ displayName: 'Dr L' });
    const res = await verify(l, note, { remark: 'Accurate' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ verifiedBy: 'Dr L', remark: 'Accurate' });
    expect(res.body.verifiedAt).toBeDefined();
    expect(await rows()).toEqual([{ ver_pst_id: note, ver_usr_id: l, ver_remark: 'Accurate' }]);
    const detail = await request(app).get(`/api/notes/${note}`).set(asUser(student));
    expect(detail.body.note).toMatchObject({ verified: true, verifiedBy: 'Dr L', verifiedByMe: false });
  });

  it('VER-TC8: a repeated Super Like keeps one verification and returns 200 with it', async () => {
    const l = await lecturer({ displayName: 'Dr L' });
    const first = await verify(l, note, { remark: 'Accurate' });
    const again = await verify(l, note, { remark: 'Changed' });
    expect(again.status).toBe(200);
    expect(again.body).toEqual(first.body);
    expect(await rows()).toHaveLength(1);
  });

  it('VER-TC9: verifying moves V from 0 to 1 and ranks P above an identical unverified post', async () => {
    const twin = await insertNote(student);
    await pool.query(
      `UPDATE "POST_T" SET pst_published_at = (SELECT pst_published_at FROM "POST_T" WHERE pst_id = $1) WHERE pst_id = $2`,
      [twin, note],
    );
    const viewer = await insertUser();
    expect((await feedItem(viewer, note)).components.V).toBe(0);
    await verify(await lecturer(), note);
    const items = (await request(app).get('/api/feed').set(asUser(viewer))).body.items;
    expect(items.map((i: { id: number }) => i.id)).toEqual([note, twin]);
    expect(items[0].components.V).toBe(1);
  });

  it('VER-TC10: withdrawing returns 200, V back to 0 and the verified frame removed', async () => {
    const l = await lecturer();
    await verify(l, note);
    const res = await unverify(l, note);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ verified: false, verifiedBy: null });
    expect(await rows()).toEqual([]);
    const item = await feedItem(await insertUser(), note);
    expect(item).toMatchObject({ verified: false, verifiedBy: null });
    expect(item.components.V).toBe(0);
  });

  it('VER-TC11: "Verified by" names the earliest valid verifier in feed, detail and bookmarks; withdrawing keeps the other', async () => {
    const first = await lecturer({ displayName: 'Dr First' });
    const second = await lecturer({ displayName: 'Dr Second' });
    await verify(first, note);
    await verify(second, note);
    await pool.query(`INSERT INTO "BOOKMARK_T" (bmk_usr_id, bmk_pst_id) VALUES ($1, $2)`, [student, note]);
    expect(await feedItem(second, note)).toMatchObject({ verifiedBy: 'Dr First', verifiedByMe: true });
    const saved = await request(app).get('/api/bookmarks').set(asUser(student));
    expect(saved.body.notes[0].verifiedBy).toBe('Dr First');
    const before = await request(app).get(`/api/notes/${note}`).set(asUser(student));
    expect(before.body.note.verifiedBy).toBe('Dr First');

    expect((await unverify(first, note)).body).toEqual({ verified: true, verifiedBy: 'Dr Second' });
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [second]);
    const detail = await request(app).get(`/api/notes/${note}`).set(asUser(student));
    expect(detail.body.note).toMatchObject({ verified: false, verifiedBy: null }); // a suspended lecturer's Super Like stops counting (D24)
  });

  it('VER-TC12: contacts-only note is 404; a restricted lecturer cannot verify but can withdraw', async () => {
    const hidden = await insertNote(student, { visibility: 'contacts' });
    expect((await verify(await lecturer(), hidden)).status).toBe(404);

    const l = await lecturer();
    await verify(l, note);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'restricted' WHERE usr_id = $1`, [l]);
    expect((await verify(l, await insertNote(student))).status).toBe(403);
    expect((await unverify(l, note)).status).toBe(200);
    expect(await rows()).toEqual([]);

    // withdrawing from a note the lecturer can no longer see reveals nothing about it
    const other = await lecturer();
    await verify(other, note);
    await verify(await lecturer({ displayName: 'Dr Keep' }), note);
    await pool.query(`UPDATE "POST_T" SET pst_visibility = 'contacts' WHERE pst_id = $1`, [note]);
    expect((await unverify(other, note)).body).toEqual({ verified: false, verifiedBy: null });
  });
});
