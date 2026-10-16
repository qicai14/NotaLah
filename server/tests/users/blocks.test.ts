import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { isBlocked, upsertAdmin } from '../../src/features/users/repository';
import { pool } from '../../src/lib/pool';
import { asUser, CSRF, follow, insertNote, insertUser, truncateAll, walkPages } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

type Who = number | null; // null = guest
const as = (who: Who) => (who === null ? CSRF : asUser(who));
const api = {
  get: (who: Who, url: string) => request(app).get(url).set(as(who)),
  put: (who: Who, url: string, body: object = {}) => request(app).put(url).set(as(who)).send(body),
  post: (who: Who, url: string, body: object = {}) => request(app).post(url).set(as(who)).send(body),
  del: (who: Who, url: string) => request(app).delete(url).set(as(who)),
};
const block = (a: number, b: number) => api.post(a, `/api/users/${b}/block`);
const ids = (items: { id: number }[]) => items.map((i) => i.id);

/** A searchable public note titled "Kernel" (the search document is built on save, so set it here). */
async function kernelNote(author: number): Promise<number> {
  const id = await insertNote(author, { title: 'Kernel' });
  await pool.query(`UPDATE "POST_T" SET pst_search_doc = to_tsvector('english', pst_title) WHERE pst_id = $1`, [id]);
  return id;
}

/** A blocks B; `pairs` runs a check from both sides, since a block in either direction must act the same. */
async function blockedPair() {
  const [a, b] = [await insertUser({ displayName: 'Kernel Alice' }), await insertUser({ displayName: 'Kernel Bob' })];
  expect((await block(a, b)).status).toBe(201);
  return {
    a,
    b,
    pairs: [
      [a, b],
      [b, a],
    ] as const,
  };
}

describe('Blocking', () => {
  it('BLK-TC1: blocking returns 201 then 200, removes follows both ways and lists the user', async () => {
    const [a, b, c] = [await insertUser(), await insertUser({ displayName: 'Blocked One' }), await insertUser()];
    await follow(a, b);
    await follow(b, a);
    await follow(c, b);
    const res = await block(a, b);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ blockedByMe: true });
    expect((await block(a, b)).status).toBe(200);
    const rows = (await pool.query(`SELECT fol_follower_id AS "f", fol_followee_id AS "t" FROM "FOLLOW_T"`)).rows;
    expect(rows).toEqual([{ f: c, t: b }]);
    const list = await api.get(a, '/api/users/me/blocks');
    expect(list.status).toBe(200);
    expect(list.body.users).toEqual([{ id: b, displayName: 'Blocked One', blockedAt: expect.any(String) }]);
    expect(list.body.nextCursor).toBeNull();
    expect((await api.get(b, '/api/users/me/blocks')).body.users).toEqual([]);
  });

  it('BLK-TC2: blocking yourself is 400; unknown or deleted users 404; an admin cannot be blocked', async () => {
    const a = await insertUser();
    expect((await block(a, a)).status).toBe(400);
    for (const target of [99999, await insertUser({ status: 'deleted' })]) {
      expect((await block(a, target)).status).toBe(404);
    }
    const admin = await insertUser({ role: 'admin' });
    const res = await block(a, admin);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Administrators cannot be blocked');
    expect((await pool.query(`SELECT 1 FROM "BLOCK_T"`)).rowCount).toBe(0);
    // promoting a blocked user through the admin bootstrap lifts blocks against them
    const promoted = await insertUser({ email: 'promoted@mail.apu.edu.my' });
    expect((await block(a, promoted)).status).toBe(201);
    await upsertAdmin('promoted@mail.apu.edu.my', 'x'.repeat(60), 'Admin');
    expect((await pool.query(`SELECT 1 FROM "BLOCK_T"`)).rowCount).toBe(0);
  });

  it('BLK-TC3: a restricted user can block and unblock; unblock is idempotent and restores visibility', async () => {
    const [r, b] = [await insertUser({ status: 'restricted' }), await insertUser()];
    expect((await block(r, b)).status).toBe(201);
    const note = await insertNote(b);
    expect((await api.get(r, `/api/notes/${note}`)).status).toBe(404);
    for (let i = 0; i < 2; i++) {
      const res = await api.del(r, `/api/users/${b}/block`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ blockedByMe: false });
    }
    expect((await api.get(r, `/api/notes/${note}`)).status).toBe(200);
    expect((await api.get(r, `/api/users/${b}`)).body.user.blockedByMe).toBe(false);
  });

  it('BLK-TC4: the block list pages newest first with a keyset cursor; guests get 401', async () => {
    const a = await insertUser();
    const targets = [await insertUser(), await insertUser(), await insertUser()];
    await pool.query(`INSERT INTO "BLOCK_T" (blk_blocker_id, blk_blocked_id) SELECT $1, unnest($2::INT[])`, [
      a,
      targets,
    ]);
    const pages = await walkPages<{ id: number }>(
      (cursor) => api.get(a, `/api/users/me/blocks?limit=2${cursor ? `&cursor=${cursor}` : ''}`),
      'users',
    );
    expect(pages.map(ids)).toEqual([[targets[2], targets[1]], [targets[0]]]);
    expect((await api.get(null, '/api/users/me/blocks')).status).toBe(401);
  });

  it('BLK-TC5: the blocker sees a minimal blocked profile; the blocked user gets 404 for profile, notes and lists', async () => {
    const { a, b } = await blockedPair();
    const mine = await api.get(a, `/api/users/${b}`);
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual({ user: { id: b, displayName: 'Kernel Bob', blockedByMe: true } });
    for (const [viewer, target] of [
      [b, a],
      [a, b],
    ]) {
      for (const path of ['notes', 'followers', 'following']) {
        expect((await api.get(viewer, `/api/users/${target}/${path}`)).status).toBe(404);
      }
    }
    expect((await api.get(b, `/api/users/${a}`)).status).toBe(404);
    // mutual block: each side gets the minimal payload so either can unblock
    expect((await block(b, a)).status).toBe(201);
    expect((await api.get(a, `/api/users/${b}`)).body).toEqual({
      user: { id: b, displayName: 'Kernel Bob', blockedByMe: true },
    });
    expect((await api.get(b, `/api/users/${a}`)).body).toEqual({
      user: { id: a, displayName: 'Kernel Alice', blockedByMe: true },
    });
  });

  it('BLK-TC6: neither side can follow the other', async () => {
    const { pairs } = await blockedPair();
    for (const [x, y] of pairs) {
      const res = await api.post(x, `/api/users/${y}/follow`);
      expect(res.status).toBe(404);
    }
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(0);
  });

  it('BLK-TC7: notes disappear both ways from the feed, following feed, search, counts, bookmarks, profile list and detail', async () => {
    const { a, b, pairs } = await blockedPair();
    const notes = { [a]: await kernelNote(a), [b]: await kernelNote(b) };
    // each side bookmarked the other's note before the block; both notes carry #kernel and the same module
    await pool.query(`INSERT INTO "BOOKMARK_T" (bmk_usr_id, bmk_pst_id) VALUES ($1, $2), ($3, $4)`, [
      a,
      notes[b],
      b,
      notes[a],
    ]);
    await pool.query(`INSERT INTO "HASHTAG_T" (hsh_name) VALUES ('kernel')`);
    await pool.query(
      `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id) SELECT unnest($1::INT[]), hsh_id FROM "HASHTAG_T"`,
      [[notes[a], notes[b]]],
    );
    const moduleCode = (await pool.query(`SELECT mod_code FROM "MODULE_T" ORDER BY mod_id LIMIT 1`)).rows[0].mod_code;
    const counts = async (who: Who) => [
      (await api.get(who, '/api/search?q=kernel&tab=hashtags')).body.items[0].noteCount,
      (await api.get(who, `/api/search?q=${moduleCode}&tab=modules`)).body.items[0].noteCount,
    ];
    expect(await counts(null)).toEqual([2, 2]);
    // b's note reaches a third user's following feed through a credited co-author the viewer follows (D46)
    const c = await insertUser();
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by, clb_edited_at) VALUES ($1, $2, 'edit', $3, NOW())`,
      [notes[b], c, b],
    );
    await follow(a, c);
    for (const [viewer, other] of pairs) {
      expect((await api.get(viewer, `/api/notes/${notes[other]}`)).status).toBe(404);
      expect(ids((await api.get(viewer, '/api/feed')).body.items)).toEqual([notes[viewer]]);
      expect(ids((await api.get(viewer, '/api/search?q=kernel&tab=notes')).body.items)).toEqual([notes[viewer]]);
      expect((await api.get(viewer, '/api/bookmarks')).body.notes).toEqual([]);
      expect(await counts(viewer)).toEqual([1, 1]);
    }
    expect((await api.get(a, '/api/feed?tab=following')).body.items).toEqual([]);
    expect(ids((await api.get(c, `/api/users/${b}/notes`)).body.notes)).toEqual([notes[b]]); // outside the block
  });

  it('BLK-TC8: like, comment, Super Like and bookmark are refused both ways; reporting stays allowed', async () => {
    const { a, b, pairs } = await blockedPair();
    await pool.query(
      `UPDATE "USER_T" SET usr_role = 'lecturer', usr_lecturer_status = 'approved', usr_staff_id = 'S1' WHERE usr_id IN ($1, $2)`,
      [a, b],
    );
    for (const [x, y] of pairs) {
      const note = await insertNote(y);
      expect((await api.post(x, `/api/notes/${note}/like`)).status).toBe(404);
      expect((await api.post(x, `/api/notes/${note}/comments`, { body: 'hi' })).status).toBe(404);
      expect((await api.get(x, `/api/notes/${note}/comments`)).status).toBe(404);
      expect((await api.post(x, `/api/notes/${note}/verify`)).status).toBe(404);
      expect((await api.post(x, `/api/notes/${note}/bookmark`)).status).toBe(404);
      expect((await api.post(x, `/api/notes/${note}/report`, { reason: 'inappropriate' })).status).toBe(201);
    }
    expect((await pool.query(`SELECT 1 FROM "REPORT_T"`)).rowCount).toBe(2);
  });

  it("BLK-TC9: on a third user's note, each side's comments show as unavailable and cannot be replied to or liked", async () => {
    const { pairs } = await blockedPair();
    const owner = await insertUser();
    const note = await insertNote(owner);
    for (const [x, y] of pairs) {
      await pool.query(`DELETE FROM "COMMENT_T"`);
      const top = (await api.post(y, `/api/notes/${note}/comments`, { body: 'from y' })).body.comment.id;
      await api.post(owner, `/api/notes/${note}/comments`, { body: 'reply', parentId: top });
      const lone = (await api.post(y, `/api/notes/${note}/comments`, { body: 'lone' })).body.comment.id;
      await api.post(owner, `/api/notes/${note}/comments`, { body: 'owner top' });
      const { comments } = (await api.get(x, `/api/notes/${note}/comments`)).body;
      const shown = comments.find((cm: { id: number }) => cm.id === top);
      expect(shown).toMatchObject({ body: '[comment unavailable]', author: null, replies: [{ body: 'reply' }] });
      expect(ids(comments)).not.toContain(lone);
      expect(comments).toHaveLength(2);
      const reply = await api.post(x, `/api/notes/${note}/comments`, { body: 'no', parentId: lone });
      expect(reply.status).toBe(400);
      expect((await api.post(x, `/api/comments/${lone}/like`)).status).toBe(404);
      // the owner, outside the block, still sees y's comments
      expect(ids((await api.get(owner, `/api/notes/${note}/comments`)).body.comments)).toContain(lone);
    }
  });

  it('BLK-TC10: people search hides each side from the other only', async () => {
    const { a, b, pairs } = await blockedPair();
    for (const [x] of pairs) {
      const res = await api.get(x, '/api/search?q=kernel&tab=people');
      expect(ids(res.body.items)).toEqual([x]);
    }
    expect(ids((await api.get(null, '/api/search?q=kernel&tab=people')).body.items).sort()).toEqual([a, b].sort());
  });

  it('BLK-TC11: invites, share links and requests between the pair are refused; existing access pauses until unblock', async () => {
    for (const blockerIsOwner of [false, true]) {
      await truncateAll();
      const [owner, other] = [await insertUser(), await insertUser()];
      const note = await insertNote(owner);
      const link = (await api.post(owner, `/api/notes/${note}/links`, { role: 'edit' })).body.token;
      await api.post(other, `/api/notes/${note}/requests`, { message: 'let me in' });
      const viewNote = await insertNote(owner);
      await api.put(owner, `/api/notes/${viewNote}/collaborators/${other}`, { role: 'view' });
      const editNote = await insertNote(owner);
      await api.put(owner, `/api/notes/${editNote}/collaborators/${other}`, { role: 'edit' });
      expect((await api.post(other, `/api/notes/${editNote}/lock`)).status).toBe(200);
      const [x, y] = blockerIsOwner ? [owner, other] : [other, owner];
      expect((await block(x, y)).status).toBe(201);

      expect((await pool.query(`SELECT 1 FROM "COLLAB_REQUEST_T"`)).rowCount).toBe(0);
      expect(
        (await pool.query(`SELECT pst_lock_usr_id FROM "POST_T" WHERE pst_id = $1`, [editNote])).rows[0]
          .pst_lock_usr_id,
      ).toBeNull();
      expect((await api.put(owner, `/api/notes/${note}/collaborators/${other}`, { role: 'edit' })).status).toBe(404);
      expect((await api.get(other, `/api/share/${link}`)).status).toBe(404);
      expect((await api.post(other, `/api/share/${link}`)).status).toBe(404);
      expect((await api.post(other, `/api/notes/${note}/requests`)).status).toBe(404);
      const stale = (
        await pool.query(`INSERT INTO "COLLAB_REQUEST_T" (crq_pst_id, crq_usr_id) VALUES ($1, $2) RETURNING crq_id`, [
          note,
          other,
        ])
      ).rows[0].crq_id;
      expect((await api.post(owner, `/api/notes/${note}/requests/${stale}`, { decision: 'approve' })).status).toBe(404);
      await pool.query(`DELETE FROM "COLLAB_REQUEST_T"`);
      expect((await api.get(other, `/api/notes/${viewNote}`)).status).toBe(404);
      expect((await api.get(other, '/api/notes/shared')).body.notes).toEqual([]);
      expect((await api.get(null, `/api/share/${link}`)).status).toBe(401); // edit link: guests are asked to log in, as before
      // a collaborator in a block with the owner can still leave
      expect((await api.del(other, `/api/notes/${editNote}/collaborators/${other}`)).status).toBe(204);

      await api.del(x, `/api/users/${y}/block`);
      expect((await api.get(other, `/api/notes/${viewNote}`)).body.note.myRole).toBe('view');
      expect(ids((await api.get(other, '/api/notes/shared')).body.notes)).toEqual([viewNote]);
      expect((await api.post(other, `/api/share/${link}`)).status).toBe(200);
    }
  });

  it('BLK-TC12: guests are unaffected by blocks', async () => {
    const { a, b } = await blockedPair();
    const note = await kernelNote(a);
    expect((await api.get(null, `/api/users/${a}`)).status).toBe(200);
    expect((await api.get(null, `/api/notes/${note}`)).status).toBe(200);
    expect(ids((await api.get(null, '/api/feed')).body.items)).toEqual([note]);
    expect(ids((await api.get(null, '/api/search?q=kernel&tab=notes')).body.items)).toEqual([note]);
    expect((await api.get(null, `/api/users/${b}`)).status).toBe(200);
  });

  it('BLK-TC13: admin moderation views ignore blocks', async () => {
    const admin = await insertUser({ role: 'admin' });
    const [x, y] = [await insertUser({ displayName: 'Blocked Author' }), await insertUser()];
    const note = await insertNote(x, { title: 'Reported note' });
    await block(y, x);
    expect((await api.post(y, `/api/notes/${note}/report`, { reason: 'spam' })).status).toBe(201);
    expect((await block(admin, x)).status).toBe(201);
    expect((await api.get(admin, '/api/admin/users?q=Blocked')).body.users.map((u: { id: number }) => u.id)).toEqual([
      x,
    ]);
    const report = await api.get(admin, `/api/admin/reports/${note}`);
    expect(report.status).toBe(200);
    expect(report.body.group).toMatchObject({ id: note, reportCount: 1 });
    // note detail keeps the admin's review path (D47), even for an author the admin blocked
    expect((await api.get(admin, `/api/notes/${note}`)).status).toBe(200);
  });

  it('BLK-TC14: isBlocked is true in both directions and false for strangers and guests', async () => {
    const { a, b } = await blockedPair();
    const c = await insertUser();
    expect(await isBlocked(a, b)).toBe(true);
    expect(await isBlocked(b, a)).toBe(true);
    expect(await isBlocked(a, c)).toBe(false);
    expect(await isBlocked(0, a)).toBe(false);
  });
});
