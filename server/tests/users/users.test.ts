import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const putMe = (uid: number, body: object) => request(app).put('/api/users/me').set(asUser(uid)).send(body);
const getUser = (viewer: number, id: number) => request(app).get(`/api/users/${id}`).set(asUser(viewer));

async function addNote(uid: number, title: string, status: string, visibility: string | null) {
  const mod = (await pool.query<{ mod_id: number }>(`SELECT mod_id FROM "MODULE_T" LIMIT 1`)).rows[0].mod_id;
  await pool.query(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $4::varchar = 'published' THEN NOW() END)`,
    [uid, mod, title, status, visibility],
  );
}

describe('Profiles', () => {
  it('USR-TC1: blank display name is rejected', async () => {
    const res = await putMe(await insertUser(), { displayName: '  ', programme: 'BSc (Hons) Computer Science', bio: '' });
    expect(res.status).toBe(400);
    expect(res.body.errors.displayName).toBe('Display name is required');
  });

  it('USR-TC2: a bio over 300 characters is rejected', async () => {
    const res = await putMe(await insertUser(), { displayName: 'Ann', bio: 'x'.repeat(301) });
    expect(res.status).toBe(400);
    expect(res.body.errors.bio).toBe('Bio must be at most 300 characters');
  });

  it('USR-TC3: a valid update is stored and shown on the profile', async () => {
    const uid = await insertUser();
    const res = await putMe(uid, { displayName: 'Ann Lee', programme: 'BSc (Hons) Computer Science', bio: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Ann Lee');
    const profile = (await getUser(uid, uid)).body.user;
    expect(profile).toMatchObject({ displayName: 'Ann Lee', programme: 'BSc (Hons) Computer Science', bio: 'Hello' });
  });

  it('USR-TC4: another user sees public notes only; drafts and contacts-only are hidden, draft count is own only', async () => {
    const owner = await insertUser();
    const contact = await insertUser();
    const stranger = await insertUser();
    await befriend(owner, contact);
    await addNote(owner, 'Public', 'published', 'public');
    await addNote(owner, 'Private circle', 'published', 'contacts');
    await addNote(owner, 'Secret draft', 'draft', null);

    const titles = async (viewer: number) => (await getUser(viewer, owner)).body.user.notes.map((n: { title: string }) => n.title).sort();
    expect(await titles(stranger)).toEqual(['Public']);
    expect(await titles(contact)).toEqual(['Private circle', 'Public']);
    expect((await getUser(stranger, owner)).body.user).not.toHaveProperty('draftCount');
    expect((await getUser(owner, owner)).body.user.draftCount).toBe(1);
  });

  it('USR-TC5: unknown user is 404 and unauthenticated is 401', async () => {
    const uid = await insertUser();
    expect((await getUser(uid, 99999)).status).toBe(404);
    expect((await request(app).get(`/api/users/${uid}`)).status).toBe(401);
  });

  it('USR-TC6: display name over 50 and programme over 100 characters are rejected', async () => {
    const res = await putMe(await insertUser(), { displayName: 'n'.repeat(51), programme: 'p'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      displayName: 'Display name must be at most 50 characters',
      programme: 'Programme must be at most 100 characters',
    });
  });

  it('USR-TC7: empty programme and bio are stored as NULL', async () => {
    const uid = await insertUser();
    expect((await putMe(uid, { displayName: 'Ann', programme: '', bio: '  ' })).status).toBe(200);
    const { rows } = await pool.query(`SELECT usr_programme, usr_bio FROM "USER_T" WHERE usr_id = $1`, [uid]);
    expect(rows[0]).toEqual({ usr_programme: null, usr_bio: null });
  });

  it('USR-TC8: a deleted account profile is 404', async () => {
    const viewer = await insertUser();
    const gone = await insertUser({ status: 'deleted' });
    expect((await getUser(viewer, gone)).status).toBe(404);
  });

  it('USR-TC9: a non-numeric user id is 404', async () => {
    const uid = await insertUser();
    expect((await request(app).get('/api/users/abc').set(asUser(uid))).status).toBe(404);
  });

  it('USR-TC11: omitted programme and bio keep their value; empty string clears', async () => {
    const uid = await insertUser();
    await putMe(uid, { displayName: 'Ann', programme: 'BSc (Hons) Computer Science', bio: 'Hi' });
    const kept = await putMe(uid, { displayName: 'Ann B' });
    expect(kept.body.user).toMatchObject({ displayName: 'Ann B', programme: 'BSc (Hons) Computer Science' });
    expect((await getUser(uid, uid)).body.user.bio).toBe('Hi');
    await putMe(uid, { displayName: 'Ann B', bio: '' });
    const profile = (await getUser(uid, uid)).body.user;
    expect(profile.bio).toBeNull();
    expect(profile.programme).toBe('BSc (Hons) Computer Science');
  });

  it('USR-TC10: hidden and deleted notes are not listed on the profile', async () => {
    const owner = await insertUser();
    const viewer = await insertUser();
    await addNote(owner, 'Visible', 'published', 'public');
    await addNote(owner, 'Hidden', 'hidden', 'public');
    await addNote(owner, 'Deleted', 'deleted', 'public');
    const titles = (await getUser(viewer, owner)).body.user.notes.map((n: { title: string }) => n.title);
    expect(titles).toEqual(['Visible']);
  });

  it('USR-TC22: a programme outside the catalogue is rejected; a catalogue programme is accepted', async () => {
    const uid = await insertUser();
    const bad = await putMe(uid, { displayName: 'Ann', programme: 'Underwater Basket Weaving' });
    expect(bad.status).toBe(400);
    expect(bad.body.errors.programme).toBe('Choose a programme from the list');
    const ok = await putMe(uid, { displayName: 'Ann', programme: 'BSc (Hons) Information Technology' });
    expect(ok.status).toBe(200);
    expect(ok.body.user.programme).toBe('BSc (Hons) Information Technology');
  });

  it('USR-TC23: a user whose stored programme left the catalogue can still save the profile', async () => {
    const uid = await insertUser();
    await pool.query(`UPDATE "USER_T" SET usr_programme = 'Legacy Programme' WHERE usr_id = $1`, [uid]);
    const kept = await putMe(uid, { displayName: 'Ann', programme: 'Legacy Programme', bio: 'New bio' });
    expect(kept.status).toBe(200);
    expect(kept.body.user.programme).toBe('Legacy Programme');
    expect((await putMe(await insertUser(), { displayName: 'Bob', programme: 'Legacy Programme' })).status).toBe(400);
  });
});
