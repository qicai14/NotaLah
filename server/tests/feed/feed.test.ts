import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { bearer, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

interface NoteOpts {
  status?: string;
  visibility?: string;
  slides?: number;
  title?: string;
}

/** Inserts a note directly with `slides` slides; returns its id. */
async function insertNote(authorId: number, o: NoteOpts = {}): Promise<number> {
  const status = o.status ?? 'published';
  const { rows } = await pool.query<{ pst_id: number }>(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at)
     VALUES ($1, (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1), $2, $3, $4,
             CASE WHEN $3::VARCHAR = 'published' THEN NOW() END)
     RETURNING pst_id`,
    [authorId, o.title ?? 'A note', status, o.visibility ?? 'public'],
  );
  const id = rows[0].pst_id;
  for (let i = 1; i <= (o.slides ?? 3); i++) {
    await pool.query(`INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_content) VALUES ($1, $2, '<p>x</p>')`, [id, i]);
  }
  return id;
}

const auth = (uid: number) => ({ Authorization: bearer(uid) });
const post = (uid: number, url: string, body?: object) => request(app).post(url).set(auth(uid)).send(body);
const del = (uid: number, url: string) => request(app).delete(url).set(auth(uid));
const get = (uid: number, url: string) => request(app).get(url).set(auth(uid));
const comment = (uid: number, noteId: number, body: object) => post(uid, `/api/notes/${noteId}/comments`, body);
const interactions = async (type: string) =>
  Number((await pool.query(`SELECT COUNT(*) FROM "INTERACTION_T" WHERE int_type = $1`, [type])).rows[0].count);
const lecturer = () => insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12) });

describe('Feed', () => {
  it('RANK-TC9: feed excludes drafts, hidden, deleted and non-visible posts', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const ok = await insertNote(author, { title: 'ok' });
    for (const status of ['draft', 'hidden', 'deleted']) await insertNote(author, { status });
    await insertNote(author, { visibility: 'contacts' });
    const res = await get(viewer, '/api/feed');
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: { id: number }) => i.id)).toEqual([ok]);
    expect(res.body.nextPage).toBeNull();
  });

  it('RANK-TC10: no token gives 401 and page -1 gives 400 "Invalid page"', async () => {
    expect((await request(app).get('/api/feed')).status).toBe(401);
    const uid = await insertUser();
    for (const p of ['-1', '0', 'abc', '1.5']) {
      const res = await get(uid, `/api/feed?page=${p}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid page');
    }
  });

  it('ENG-TC11: feed pages newest first, 10 per page, with counts, flags and slides', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) ids.push(await insertNote(author, { slides: 2 }));
    const newest = ids[11];
    await post(viewer, `/api/notes/${newest}/like`);
    await post(viewer, `/api/notes/${newest}/bookmark`);
    await comment(author, newest, { body: 'hi' });
    await pool.query(`INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id) VALUES ($1, $2)`, [newest, await lecturer()]);
    const p1 = await get(viewer, '/api/feed');
    expect(p1.body.items).toHaveLength(10);
    expect(p1.body.nextPage).toBe(2);
    expect(p1.body.items[0]).toMatchObject({
      id: newest, counts: { likes: 1, comments: 1 }, liked: true, bookmarked: true, verified: true,
    });
    expect(p1.body.items[0].slides).toHaveLength(2);
    expect(p1.body.items[1]).toMatchObject({ liked: false, bookmarked: false, verified: false });
    const p2 = await get(viewer, '/api/feed?page=2');
    expect(p2.body.items.map((i: { id: number }) => i.id)).toEqual([ids[1], ids[0]]);
    expect(p2.body.nextPage).toBeNull();
  });

  it('ENG-TC12: a view is logged once per 30 minutes; invisible notes give 404', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const n = await insertNote(author);
    expect((await post(viewer, `/api/notes/${n}/view`)).status).toBe(204);
    await post(viewer, `/api/notes/${n}/view`);
    expect(await interactions('view')).toBe(1);
    await pool.query(`UPDATE "INTERACTION_T" SET int_created_at = NOW() - INTERVAL '31 minutes'`);
    await post(viewer, `/api/notes/${n}/view`);
    expect(await interactions('view')).toBe(2);
    const hidden = await insertNote(author, { visibility: 'contacts' });
    expect((await post(viewer, `/api/notes/${hidden}/view`)).status).toBe(404);
    expect((await post(viewer, `/api/notes/abc/view`)).status).toBe(404);
  });
});

describe('Engagement', () => {
  it('ENG-TC1: like a note', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    const res = await post(a, `/api/notes/${p}/like`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ liked: true, likes: 1 });
    expect(await interactions('like')).toBe(1);
  });

  it('ENG-TC2: liking twice keeps one like and one interaction', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    await post(a, `/api/notes/${p}/like`);
    const again = await post(a, `/api/notes/${p}/like`);
    expect(again.status).toBe(200);
    expect(again.body.likes).toBe(1);
    expect(await interactions('like')).toBe(1);
  });

  it('ENG-TC3: unlike a note', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    await post(a, `/api/notes/${p}/like`);
    const res = await del(a, `/api/notes/${p}/like`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ liked: false, likes: 0 });
  });

  it('ENG-TC13: engagement on an invisible note is 404 and a restricted user cannot write', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const priv = await insertNote(b, { visibility: 'contacts' });
    const draft = await insertNote(b, { status: 'draft' });
    for (const id of [priv, draft]) {
      expect((await post(a, `/api/notes/${id}/like`)).status).toBe(404);
      expect((await comment(a, id, { body: 'x' })).status).toBe(404);
      expect((await post(a, `/api/notes/${id}/bookmark`)).status).toBe(404);
    }
    const open = await insertNote(b);
    const restricted = await insertUser({ status: 'restricted' });
    expect((await post(restricted, `/api/notes/${open}/like`)).status).toBe(403);
    expect((await get(restricted, `/api/notes/${open}/comments`)).status).toBe(200);
  });

  it('ENG-TC4: blank and over-length comments are rejected', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    expect((await comment(a, p, { body: '   ' })).status).toBe(400);
    expect((await comment(a, p, { body: 'a'.repeat(1001) })).status).toBe(400);
    expect((await comment(a, p, { body: 'a'.repeat(1000) })).status).toBe(201);
  });

  it('ENG-TC5: a valid comment referencing a slide is stored with a comment interaction', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b, { slides: 3 });
    const res = await comment(a, p, { body: 'Check slide 3', slideNo: 3 });
    expect(res.status).toBe(201);
    const stored = await pool.query(`SELECT cmt_body, cmt_slide_no FROM "COMMENT_T"`);
    expect(stored.rows).toEqual([{ cmt_body: 'Check slide 3', cmt_slide_no: 3 }]);
    expect(await interactions('comment')).toBe(1);
    expect((await comment(a, p, { body: 'x', slideNo: 4 })).status).toBe(400);
    expect((await comment(a, p, { body: 'x', slideNo: 0 })).status).toBe(400);
  });

  it('ENG-TC6: replying to a reply is rejected', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    const top = (await comment(a, p, { body: 'top' })).body.comment.id;
    const reply = await comment(b, p, { body: 'reply', parentId: top });
    expect(reply.status).toBe(201);
    const bad = await comment(a, p, { body: 'deeper', parentId: reply.body.comment.id });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Replies are limited to one level');
    const other = await insertNote(b);
    expect((await comment(a, other, { body: 'x', parentId: top })).status).toBe(400);
  });

  it('ENG-TC7: lecturer comment first, then most liked, then oldest', async () => {
    const author = await insertUser();
    const p = await insertNote(author);
    const lect = await lecturer();
    const students = [await insertUser(), await insertUser(), await insertUser()];
    const fans: number[] = [];
    for (let i = 0; i < 5; i++) fans.push(await insertUser());
    const ids: number[] = [];
    ids.push((await comment(students[0], p, { body: 'two-a' })).body.comment.id);
    ids.push((await comment(students[1], p, { body: 'five' })).body.comment.id);
    ids.push((await comment(students[2], p, { body: 'two-b' })).body.comment.id);
    const l = (await comment(lect, p, { body: 'lecturer' })).body.comment.id;
    const likeBy = (n: number, id: number) => Promise.all(fans.slice(0, n).map((f) => post(f, `/api/comments/${id}/like`)));
    await likeBy(2, ids[0]);
    await likeBy(5, ids[1]);
    await likeBy(2, ids[2]);
    const res = await get(fans[0], `/api/notes/${p}/comments`);
    expect(res.body.comments.map((c: { id: number }) => c.id)).toEqual([l, ids[1], ids[0], ids[2]]);
    expect(res.body.comments[0]).toMatchObject({ pinned: true, author: { isVerifiedLecturer: true }, likes: 0, likedByMe: false });
    expect(res.body.comments[1]).toMatchObject({ likes: 5, likedByMe: true });
  });

  it('ENG-TC14: replies nest oldest first; comment like is idempotent and unlikes', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    const top = (await comment(a, p, { body: 'top' })).body.comment.id;
    await comment(b, p, { body: 'r1', parentId: top });
    await comment(a, p, { body: 'r2', parentId: top });
    const res = await get(a, `/api/notes/${p}/comments`);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].replies.map((r: { body: string }) => r.body)).toEqual(['r1', 'r2']);
    expect((await post(b, `/api/comments/${top}/like`)).status).toBe(201);
    const again = await post(b, `/api/comments/${top}/like`);
    expect(again.body).toEqual({ liked: true, likes: 1 });
    expect((await del(b, `/api/comments/${top}/like`)).body).toEqual({ liked: false, likes: 0 });
  });

  it('ENG-TC15: delete is author only; a parent with replies shows "[deleted]", one without disappears', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    const withReply = (await comment(a, p, { body: 'parent' })).body.comment.id;
    await comment(b, p, { body: 'kid', parentId: withReply });
    const alone = (await comment(a, p, { body: 'alone' })).body.comment.id;
    expect((await del(b, `/api/comments/${withReply}`)).status).toBe(403);
    expect((await del(a, `/api/comments/${withReply}`)).status).toBe(204);
    expect((await del(a, `/api/comments/${alone}`)).status).toBe(204);
    expect((await del(a, `/api/comments/${alone}`)).status).toBe(404);
    const res = await get(a, `/api/notes/${p}/comments`);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0]).toMatchObject({ id: withReply, body: '[deleted]', author: null });
    expect(res.body.comments[0].replies).toHaveLength(1);
  });

  it('ENG-TC8: report with an invalid reason is 400, and reporting your own note is 400', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    const bad = await post(a, `/api/notes/${p}/report`, { reason: 'boring' });
    expect(bad.status).toBe(400);
    const own = await post(b, `/api/notes/${p}/report`, { reason: 'spam' });
    expect(own.status).toBe(400);
    expect(own.body.error).toBe('You cannot report your own note');
  });

  it('ENG-TC9: student gets 403 for plagiarism; a duplicate open report is 409', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p = await insertNote(b);
    expect((await post(a, `/api/notes/${p}/report`, { reason: 'plagiarism' })).status).toBe(403);
    expect((await post(a, `/api/notes/${p}/report`, { reason: 'spam', details: 'ads' })).status).toBe(201);
    const dup = await post(a, `/api/notes/${p}/report`, { reason: 'other' });
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe('You have already reported this note');
    expect((await post(await lecturer(), `/api/notes/${p}/report`, { reason: 'copyright' })).status).toBe(201);
    expect((await post(await insertUser(), `/api/notes/${p}/report`, { reason: 'spam', details: 'x'.repeat(501) })).status).toBe(400);
  });

  it('ENG-TC10: bookmark, list newest first, remove', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const p1 = await insertNote(b, { title: 'first' });
    const p2 = await insertNote(b, { title: 'second' });
    await post(a, `/api/notes/${p1}/bookmark`);
    await post(a, `/api/notes/${p2}/bookmark`);
    await post(a, `/api/notes/${p2}/bookmark`); // idempotent
    const list = await get(a, '/api/bookmarks');
    expect(list.body.notes.map((n: { id: number }) => n.id)).toEqual([p2, p1]);
    expect(list.body.notes[0]).toHaveProperty('savedAt');
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [p2]);
    expect((await get(a, '/api/bookmarks')).body.notes.map((n: { id: number }) => n.id)).toEqual([p1]);
    expect((await del(a, `/api/notes/${p1}/bookmark`)).status).toBe(200);
    expect((await get(a, '/api/bookmarks')).body.notes).toEqual([]);
  });
});
