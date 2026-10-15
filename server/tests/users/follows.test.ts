import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, follow, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const followReq = (uid: number, target: number) => request(app).post(`/api/users/${target}/follow`).set(asUser(uid));
const unfollowReq = (uid: number, target: number) => request(app).delete(`/api/users/${target}/follow`).set(asUser(uid));
const get = (uid: number, url: string) => request(app).get(url).set(asUser(uid));
const ids = (items: { id: number }[]) => items.map((i) => i.id);

describe('Follows', () => {
  it('USR-TC12: following a user returns 201 and shows on both profiles', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const res = await followReq(a, b);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ followerCount: 1, followingCount: 0, followedByMe: true, followsMe: false, isFriend: false });
    expect((await get(a, `/api/users/${a}`)).body.user).toMatchObject({ followerCount: 0, followingCount: 1 });
    expect((await get(b, `/api/users/${a}`)).body.user).toMatchObject({ followedByMe: false, followsMe: true, isFriend: false });
  });

  it('USR-TC13: a repeated follow returns 200 and keeps one row', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await followReq(a, b);
    const res = await followReq(a, b);
    expect(res.status).toBe(200);
    expect(res.body.followerCount).toBe(1);
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(1);
  });

  it('USR-TC14: following yourself is 400', async () => {
    const a = await insertUser();
    const res = await followReq(a, a);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You cannot follow yourself');
  });

  it('USR-TC15: unfollow is idempotent; a restricted user can unfollow but not follow', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await follow(a, b);
    for (let i = 0; i < 2; i++) {
      const res = await unfollowReq(a, b);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ followerCount: 0, followedByMe: false });
    }
    const r = await insertUser({ status: 'restricted' });
    await follow(r, b);
    expect((await unfollowReq(r, b)).status).toBe(200);
    expect((await followReq(r, b)).status).toBe(403);
  });

  it('USR-TC16: a suspended, deleted or unknown user is 404 for follow and unfollow', async () => {
    const a = await insertUser();
    for (const target of [await insertUser({ status: 'suspended' }), await insertUser({ status: 'deleted' }), 99999]) {
      for (const res of [await followReq(a, target), await unfollowReq(a, target)]) {
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('User not found');
      }
    }
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(0);
    const later = await insertUser();
    await followReq(a, later);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [later]);
    expect((await unfollowReq(a, later)).status).toBe(204); // a hidden target can still be left
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(0);
  });

  it('USR-TC27: a suspended profile is 404 for guests and signed-in users and open to admins', async () => {
    const [suspended, fan, admin] = [await insertUser(), await insertUser(), await insertUser({ role: 'admin' })];
    const note = await insertNote(suspended);
    await follow(fan, suspended);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [suspended]);
    const profile = `/api/users/${suspended}`;
    for (const url of [profile, `${profile}/notes`]) expect((await request(app).get(url)).status).toBe(404);
    for (const url of [profile, `${profile}/notes`, `${profile}/followers`, `${profile}/following`]) {
      expect((await get(fan, url)).status).toBe(404);
      expect((await get(admin, url)).status).toBe(200);
    }
    const asAdmin = (await get(admin, profile)).body.user;
    expect(asAdmin).toMatchObject({ id: suspended, followerCount: 1 });
    expect(asAdmin.notes.map((n: { id: number }) => n.id)).toEqual([note]);
    expect((await get(admin, `/api/notes/${note}`)).status).toBe(200);
    expect((await get(fan, `/api/notes/${note}`)).status).toBe(404);
    expect((await get(admin, '/api/feed')).body.items).toEqual([]); // the feed keeps D26 for admins too
    expect((await get(fan, `/api/users/${fan}/following`)).body.items).toEqual([]);
  });

  it('USR-TC17: a mutual follow makes two users friends; a one-way follow does not', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await followReq(a, b);
    expect((await get(a, `/api/users/${b}`)).body.user.isFriend).toBe(false);
    const back = await followReq(b, a);
    expect(back.body).toMatchObject({ followedByMe: true, followsMe: true, isFriend: true });
    expect((await get(a, `/api/users/${b}`)).body.user.isFriend).toBe(true);
    expect((await get(b, `/api/users/${b}/followers`)).body.items).toEqual([
      expect.objectContaining({ id: a, followedByMe: true, isFriend: true }),
    ]);
  });

  it('USR-TC18: a contacts-only note is visible to a friend, not to a one-way follower', async () => {
    const [author, friend, fan, followee] = [await insertUser(), await insertUser(), await insertUser(), await insertUser()];
    await befriend(author, friend);
    await follow(fan, author);
    await follow(author, followee);
    const note = await insertNote(author, { visibility: 'contacts' });
    expect((await get(friend, `/api/notes/${note}`)).status).toBe(200);
    expect((await get(fan, `/api/notes/${note}`)).status).toBe(404);
    expect((await get(followee, `/api/notes/${note}`)).status).toBe(404);
    await unfollowReq(author, friend); // friendship ends when either side unfollows
    expect((await get(friend, `/api/notes/${note}`)).status).toBe(404);
  });

  it('USR-TC19: follower and following lists page 20 at a time, newest first', async () => {
    const target = await insertUser();
    const fans: number[] = [];
    for (let i = 0; i < 25; i++) fans.push(await insertUser());
    await pool.query(
      `INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id, fol_created_at)
       SELECT t.f, $1, NOW() - make_interval(secs => 100 - t.n) FROM unnest($2::INT[]) WITH ORDINALITY AS t(f, n)`,
      [target, fans],
    );
    const p1 = await get(target, `/api/users/${target}/followers`);
    expect(p1.status).toBe(200);
    expect(ids(p1.body.items)).toEqual(fans.slice(5).reverse());
    expect(p1.body.items[0]).toEqual({
      id: fans[24], displayName: 'Test User', role: 'student', isVerifiedLecturer: false, followedByMe: false, isFriend: false,
    });
    const p2 = await get(target, `/api/users/${target}/followers?cursor=${p1.body.nextCursor}`);
    expect(ids(p2.body.items)).toEqual(fans.slice(0, 5).reverse());
    expect(p2.body.nextCursor).toBeNull();
    expect(ids((await get(target, `/api/users/${fans[0]}/following`)).body.items)).toEqual([target]);
    expect((await get(target, `/api/users/${target}/followers?cursor=abc`)).status).toBe(400);
    expect((await get(target, `/api/users/${await insertUser({ status: 'deleted' })}/followers`)).status).toBe(404);
  });

  it('USR-TC24: followers made at the same instant page by id without gaps or repeats', async () => {
    const target = await insertUser();
    const fans: number[] = [];
    for (let i = 0; i < 23; i++) fans.push(await insertUser());
    await pool.query(
      `INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id) SELECT f, $1 FROM unnest($2::INT[]) AS f`,
      [target, fans],
    );
    const p1 = await get(target, `/api/users/${target}/followers`);
    const p2 = await get(target, `/api/users/${target}/followers?cursor=${p1.body.nextCursor}`);
    expect([...ids(p1.body.items), ...ids(p2.body.items)]).toEqual([...fans].sort((x, y) => y - x));
    expect(p2.body.nextCursor).toBeNull();
  });

  it('USR-TC20: counts and lists exclude deleted and suspended users', async () => {
    const [target, ok] = [await insertUser(), await insertUser()];
    const suspended = await insertUser({ status: 'suspended' });
    const deleted = await insertUser({ status: 'deleted' });
    for (const u of [ok, suspended, deleted]) {
      await follow(u, target);
      await follow(target, u);
    }
    expect((await get(ok, `/api/users/${target}`)).body.user).toMatchObject({ followerCount: 1, followingCount: 1 });
    expect(ids((await get(ok, `/api/users/${target}/followers`)).body.items)).toEqual([ok]);
    expect(ids((await get(ok, `/api/users/${target}/following`)).body.items)).toEqual([ok]);
  });

  it('USR-TC21: deleting an account removes its follows in both directions', async () => {
    const admin = await insertUser({ role: 'admin' });
    const [gone, other, third] = [await insertUser(), await insertUser(), await insertUser()];
    await befriend(gone, other);
    await follow(other, third);
    const res = await request(app).post(`/api/admin/users/${gone}/delete`).set(asUser(admin)).send({ reason: 'Spam' });
    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT 1 FROM "FOLLOW_T" WHERE $1 IN (fol_follower_id, fol_followee_id)`, [gone]);
    expect(rows).toHaveLength(0);
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(1);
  });
});
