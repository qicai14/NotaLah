import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, follow, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const auth = asUser;
const post = (uid: number, url: string, body?: object) => request(app).post(url).set(auth(uid)).send(body);
const get = (uid: number, url: string) => request(app).get(url).set(auth(uid));
const comment = (uid: number, noteId: number, body: object) => post(uid, `/api/notes/${noteId}/comments`, body);
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

  it('ENG-TC11: feed pages ordered by score (ties newest first), 10 per page, with counts, flags and slides', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) ids.push(await insertNote(author, { slides: 2 }));
    const newest = ids[11];
    await post(viewer, `/api/notes/${newest}/like`);
    await post(viewer, `/api/notes/${newest}/bookmark`);
    await comment(viewer, newest, { body: 'hi' });
    await pool.query(`INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id) VALUES ($1, $2)`, [newest, await lecturer()]);
    const p1 = await get(viewer, '/api/feed');
    expect(p1.body.items).toHaveLength(10);
    expect(p1.body.nextPage).toBe(2);
    expect(p1.body.items[0]).toMatchObject({
      id: newest, counts: { likes: 1, comments: 1 }, liked: true, bookmarked: true, verified: true,
    });
    expect(p1.body.items[0].slides).toHaveLength(2);
    expect(p1.body.items[1]).toMatchObject({ liked: false, bookmarked: false, verified: false });
    const late = await insertNote(author); // published after page 1 was served
    const p2 = await get(viewer, `/api/feed?page=2&asOf=${encodeURIComponent(p1.body.asOf)}`);
    expect(p2.body.items.map((i: { id: number }) => i.id)).not.toContain(late);
    expect((await get(viewer, '/api/feed?asOf=nope')).status).toBe(400);
    expect(p2.body.items.map((i: { id: number }) => i.id)).toEqual([ids[1], ids[0]]);
    expect(p2.body.nextPage).toBeNull();
  });
});

describe('Following feed', () => {
  const following = (uid: number, q = '') => get(uid, `/api/feed?tab=following${q}`);
  const idsOf = (res: request.Response) => res.body.items.map((i: { id: number }) => i.id);

  it('RANK-TC21: the Following feed lists only followed authors, newest first, without scores', async () => {
    const [viewer, followed, other] = [await insertUser(), await insertUser(), await insertUser()];
    await follow(viewer, followed);
    await follow(other, viewer); // being followed does not bring their notes in
    const older = await insertNote(followed);
    const newer = await insertNote(followed);
    await insertNote(other);
    await insertNote(viewer);
    const res = await following(viewer);
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual([newer, older]);
    expect(res.body.items[0]).not.toHaveProperty('score');
    expect(res.body.items[0]).toMatchObject({ counts: { likes: 0, comments: 0 }, liked: false });
    expect(res.body.nextCursor).toBeNull();
    expect((await get(viewer, '/api/feed?tab=nope')).status).toBe(400);
    expect((await following(viewer, '&cursor=abc')).status).toBe(400);
  });

  it('RANK-TC22: Following feed keyset pages are stable with asOf', async () => {
    const [viewer, author] = [await insertUser(), await insertUser()];
    await follow(viewer, author);
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) ids.push(await insertNote(author));
    const p1 = await following(viewer);
    expect(p1.body.items).toHaveLength(10);
    expect(idsOf(p1)).toEqual(ids.slice(2).reverse());
    expect(p1.body.nextCursor).toMatch(/^\d+_\d+$/);
    await insertNote(author); // published after page 1 was served
    const p2 = await following(viewer, `&cursor=${p1.body.nextCursor}&asOf=${encodeURIComponent(p1.body.asOf)}`);
    expect(idsOf(p2)).toEqual([ids[1], ids[0]]);
    expect(p2.body.nextCursor).toBeNull();
  });

  it('RANK-TC23: contacts-only notes appear in the Following feed only for friends', async () => {
    const [author, friend, fan] = [await insertUser(), await insertUser(), await insertUser()];
    await befriend(author, friend);
    await follow(fan, author);
    const pub = await insertNote(author);
    const circle = await insertNote(author, { visibility: 'contacts' });
    expect(idsOf(await following(friend))).toEqual([circle, pub]);
    expect(idsOf(await following(fan))).toEqual([pub]);
  });
});
