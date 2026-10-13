import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { bearer, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const putMe = (uid: number, body: object) => request(app).put('/api/users/me').set('Authorization', bearer(uid)).send(body);
const getUser = (viewer: number, id: number) => request(app).get(`/api/users/${id}`).set('Authorization', bearer(viewer));

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
    const res = await putMe(await insertUser(), { displayName: '  ', programme: 'SE', bio: '' });
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
    const res = await putMe(uid, { displayName: 'Ann Lee', programme: 'BSc SE', bio: 'Hello' });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Ann Lee');
    const profile = (await getUser(uid, uid)).body.user;
    expect(profile).toMatchObject({ displayName: 'Ann Lee', programme: 'BSc SE', bio: 'Hello' });
  });

  it('USR-TC4: another user sees public notes only; drafts and contacts-only are hidden, draft count is own only', async () => {
    const owner = await insertUser();
    const contact = await insertUser();
    const stranger = await insertUser();
    await pool.query(`INSERT INTO "CONTACT_T" (con_usr_id, con_contact_id) VALUES ($1, $2)`, [owner, contact]);
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
});
