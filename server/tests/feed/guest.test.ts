import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { RATE_LIMITS } from '../../src/features/auth/rateLimit';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { agePublished, asUser, befriend, CSRF, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const guest = (url: string) => request(app).get(url);
const ids = (items: { id: number }[]) => items.map((i) => i.id);
const lecturer = () =>
  insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12) });

/** A public note, plus one of each kind a guest must never see: contacts-only, hidden, draft, by a suspended author. */
async function world() {
  const author = await insertUser();
  const friend = await insertUser();
  await befriend(author, friend);
  const pub = await insertNote(author, { title: 'public' });
  const contacts = await insertNote(author, { visibility: 'contacts' });
  const hidden = await insertNote(author, { status: 'hidden' });
  const draft = await insertNote(author, { status: 'draft' });
  const suspended = await insertNote(await insertUser({ status: 'suspended' }));
  await agePublished();
  return { author, friend, pub, contacts, hidden, draft, suspended, unseen: [contacts, hidden, draft, suspended] };
}

describe('Guest browsing (R31)', () => {
  it('RANK-TC29: guest feed lists only public notes with M = 0, no flags and no stored snapshot', async () => {
    const w = await world();
    await pool.query(`INSERT INTO "HASHTAG_T" (hsh_name) VALUES ('sql')`);
    await pool.query(`INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id) SELECT $1, hsh_id FROM "HASHTAG_T"`, [
      w.pub,
    ]);
    await pool.query(`INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type) VALUES ($1, $2, 'like')`, [
      w.friend,
      w.pub,
    ]);
    await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [w.friend, w.pub]);

    const res = await guest('/api/feed');
    expect(res.status).toBe(200);
    expect(ids(res.body.items)).toEqual([w.pub]);
    expect(res.body.items[0]).toMatchObject({
      liked: false,
      bookmarked: false,
      verifiedByMe: false,
      counts: { likes: 1 },
    });
    expect(res.body.items[0].components.M).toBe(0);
    const p2 = await guest(`/api/feed?page=2&asOf=${encodeURIComponent(res.body.asOf)}`);
    expect(p2.body).toMatchObject({ items: [], nextPage: null });
    expect((await pool.query(`SELECT 1 FROM "FEED_SNAPSHOT_T"`)).rowCount).toBe(0);

    // Signed-in behaviour is unchanged: the friend sees the contacts-only note, has M > 0 and gets a snapshot.
    const signedIn = await request(app).get('/api/feed').set(asUser(w.friend));
    expect(ids(signedIn.body.items).sort((a, b) => a - b)).toEqual([w.pub, w.contacts].sort((a, b) => a - b));
    expect(signedIn.body.items.find((i: { id: number }) => i.id === w.pub)).toMatchObject({ liked: true });
    expect(signedIn.body.items.find((i: { id: number }) => i.id === w.pub).components.M).toBeGreaterThan(0);
    expect((await pool.query(`SELECT 1 FROM "FEED_SNAPSHOT_T"`)).rowCount).toBe(1);
  });

  it('RANK-TC31: later guest pages read the shared ranking for their asOf', async () => {
    const author = await insertUser();
    const fan = await insertUser();
    const notes: number[] = [];
    for (let i = 0; i < 12; i++) notes.push(await insertNote(author));
    await agePublished();
    await pool.query(`UPDATE "POST_T" SET pst_published_at = NOW() - INTERVAL '5 days' WHERE pst_id = $1`, [notes[0]]);
    for (let i = 0; i < 30; i++) {
      const u = i === 0 ? fan : await insertUser();
      await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [u, notes[0]]);
    }
    await pool.query(`UPDATE "LIKE_T" SET lik_created_at = lik_created_at - INTERVAL '2 minutes'`);
    const p1 = await guest('/api/feed');
    expect(ids(p1.body.items)).toContain(notes[0]);
    await pool.query(`DELETE FROM "LIKE_T"`); // unlikes lower E even at the old asOf
    const p2 = await guest(`/api/feed?page=2&asOf=${encodeURIComponent(p1.body.asOf)}`);
    const seen = [...ids(p1.body.items), ...ids(p2.body.items)];
    expect(seen.sort((a, b) => a - b)).toEqual(notes);
    expect((await pool.query(`SELECT 1 FROM "FEED_SNAPSHOT_T"`)).rowCount).toBe(0);
  });

  it('CLN-TC1: a guest first page rounds its cutoff down to the minute and reuses the cached ranking', async () => {
    const author = await insertUser();
    const note = await insertNote(author);
    await agePublished();
    const first = await guest('/api/feed');
    expect(new Date(first.body.asOf).getTime() % 60_000).toBe(0);
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [note]);
    const second = await guest('/api/feed'); // same minute: served from the cached ranking, the hidden note is dropped on load
    expect(second.body.asOf).toBe(first.body.asOf);
    expect(ids(first.body.items)).toEqual([note]);
    expect(second.body.items).toEqual([]);
  });

  it('RANK-TC30: guest gets 401 on the Following feed', async () => {
    const res = await guest('/api/feed?tab=following');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('NOTE-TC27: guest opens a public note but gets 404 for contacts-only, hidden, draft and suspended-author notes', async () => {
    const w = await world();
    const res = await guest(`/api/notes/${w.pub}`);
    expect(res.status).toBe(200);
    expect(res.body.note).toMatchObject({ id: w.pub, liked: false, bookmarked: false });
    for (const id of w.unseen) expect((await guest(`/api/notes/${id}`)).status).toBe(404);
    // An invalid or expired cookie is treated as a guest, not refused.
    const bad = await request(app).get(`/api/notes/${w.pub}`).set('Cookie', 'notalah_token=garbage');
    expect(bad.status).toBe(200);
    expect((await request(app).get(`/api/notes/${w.contacts}`).set('Cookie', 'notalah_token=garbage')).status).toBe(
      404,
    );
    expect(bad.headers['x-viewer']).toBe('guest');
    const friendView = await request(app).get(`/api/notes/${w.contacts}`).set(asUser(w.friend));
    expect(friendView.status).toBe(200);
    expect(friendView.headers['x-viewer']).toBe('user');
    // A validly signed but expired token is a guest too.
    const expired = jwt.sign({ role: 'student' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: String(w.friend),
      expiresIn: -1,
    });
    expect((await request(app).get(`/api/notes/${w.contacts}`).set('Cookie', `notalah_token=${expired}`)).status).toBe(
      404,
    );
    // A suspended author's still-valid cookie no longer opens their own draft.
    const banned = await insertUser({ status: 'suspended' });
    const ownDraft = await insertNote(banned, { status: 'draft' });
    expect((await request(app).get(`/api/notes/${ownDraft}`).set(asUser(banned))).status).toBe(404);
  });

  it('ENG-TC20: guest reads comments and replies of a public note only, and no view is logged', async () => {
    const w = await world();
    const { body } = await request(app)
      .post(`/api/notes/${w.pub}/comments`)
      .set(asUser(w.friend))
      .send({ body: 'top' });
    await request(app)
      .post(`/api/notes/${w.pub}/comments`)
      .set(asUser(w.author))
      .send({ body: 'reply', parentId: body.comment.id });
    const res = await guest(`/api/notes/${w.pub}/comments`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0]).toMatchObject({ body: 'top', likedByMe: false, replies: [{ body: 'reply' }] });
    for (const id of w.unseen) expect((await guest(`/api/notes/${id}/comments`)).status).toBe(404);

    const before = (await pool.query(`SELECT 1 FROM "INTERACTION_T"`)).rowCount;
    expect((await request(app).post(`/api/notes/${w.pub}/view`).set(CSRF)).status).toBe(401);
    expect((await pool.query(`SELECT 1 FROM "INTERACTION_T"`)).rowCount).toBe(before);
  });

  it('ENG-TC21: guest gets 401 on every write: like, save, comment, comment like, report, Super Like, follow, create', async () => {
    const w = await world();
    const { body } = await request(app)
      .post(`/api/notes/${w.pub}/comments`)
      .set(asUser(w.friend))
      .send({ body: 'top' });
    await lecturer();
    const writes: [string, string, object?][] = [
      ['post', `/api/notes/${w.pub}/like`],
      ['delete', `/api/notes/${w.pub}/like`],
      ['post', `/api/notes/${w.pub}/bookmark`],
      ['delete', `/api/notes/${w.pub}/bookmark`],
      ['post', `/api/notes/${w.pub}/comments`, { body: 'hi' }],
      ['delete', `/api/comments/${body.comment.id}`],
      ['post', `/api/comments/${body.comment.id}/like`],
      ['post', `/api/notes/${w.pub}/report`, { reason: 'spam' }],
      ['post', `/api/notes/${w.pub}/verify`],
      ['post', `/api/users/${w.author}/follow`],
      ['delete', `/api/users/${w.author}/follow`],
      ['post', '/api/notes', { title: 'x' }],
      ['put', `/api/notes/${w.pub}`, { title: 'x' }],
      ['delete', `/api/notes/${w.pub}`],
      ['put', '/api/users/me', { displayName: 'x' }],
    ];
    for (const [method, url, data] of writes) {
      const res = await request(app)[method as 'post'](url).set(CSRF).send(data);
      expect(res.status, `${method} ${url}`).toBe(401);
    }
    // Writes keep the CSRF check: without the header a guest gets 403 before auth.
    expect((await request(app).post(`/api/notes/${w.pub}/like`)).status).toBe(403);
    for (const url of [
      '/api/bookmarks',
      '/api/notes/drafts',
      `/api/users/${w.author}/followers`,
      `/api/users/${w.author}/following`,
    ]) {
      expect((await guest(url)).status, url).toBe(401);
    }
    expect(
      (
        await pool.query(
          `SELECT 1 FROM "LIKE_T" UNION ALL SELECT 1 FROM "BOOKMARK_T" UNION ALL SELECT 1 FROM "REPORT_T"`,
        )
      ).rowCount,
    ).toBe(0);
  });

  it('USR-TC26: guest views a profile with counts and only its public notes', async () => {
    const w = await world();
    const res = await guest(`/api/users/${w.author}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: w.author,
      followerCount: 1,
      followingCount: 1,
      followedByMe: false,
      isFriend: false,
    });
    expect(res.body.user.draftCount).toBeUndefined();
    expect(ids(res.body.user.notes)).toEqual([w.pub]);
    const more = await guest(`/api/users/${w.author}/notes`);
    expect(more.status).toBe(200);
    expect(ids(more.body.notes)).toEqual([w.pub]);
    expect((await guest('/api/users/99999')).status).toBe(404);
    const friendView = await request(app).get(`/api/users/${w.author}`).set(asUser(w.friend));
    expect(ids(friendView.body.user.notes).sort((a, b) => a - b)).toEqual([w.pub, w.contacts].sort((a, b) => a - b));
  });

  it('AUTH-TC21: guest reads are rate-limited per IP; signed-in reads are not', async () => {
    const uid = await insertUser();
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development'; // the limiters skip themselves under NODE_ENV=test
    try {
      expect((await guest(`/api/users/${uid}`)).status).toBe(200);
      const { rowCount } = await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_hits = $1 WHERE rlt_key LIKE 'guest:%'`, [
        RATE_LIMITS.guestReads,
      ]);
      expect(rowCount).toBe(1);
      const limited = await guest(`/api/users/${uid}`);
      expect(limited.status).toBe(429);
      expect(limited.body.error).toBe('Too many requests. Log in or try again in a minute.');
      expect((await request(app).get(`/api/users/${uid}`).set(asUser(uid))).status).toBe(200);
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  it('AUTH-TC22: a signed-in revalidation of a cached guest response answers 304 with X-Viewer: user', async () => {
    const w = await world();
    await request(app).post(`/api/notes/${w.pub}/comments`).set(asUser(w.friend)).send({ body: 'top' });
    const viewer = await insertUser();
    const first = await guest(`/api/notes/${w.pub}/comments`);
    expect(first.status).toBe(200);
    expect(first.headers['x-viewer']).toBe('guest');
    const again = await request(app)
      .get(`/api/notes/${w.pub}/comments`)
      .set(asUser(viewer))
      .set('If-None-Match', first.headers.etag);
    expect(again.status).toBe(304);
    expect(again.headers['x-viewer']).toBe('user');
  });
});
