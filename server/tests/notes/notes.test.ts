import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { bearer, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const moduleId = async (code = 'CT046-3-M') =>
  (await pool.query<{ mod_id: number }>(`SELECT mod_id FROM "MODULE_T" WHERE mod_code = $1`, [code])).rows[0].mod_id;

const publishBody = async (over: object = {}) => ({
  title: 'MVC basics',
  slides: ['<p>one</p>', '<p>two</p>', '<p>three</p>'],
  moduleId: await moduleId(),
  hashtags: ['#MVC', 'design_patterns'],
  status: 'published',
  visibility: 'public',
  ...over,
});

const post = (uid: number, body: object) => request(app).post('/api/notes').set('Authorization', bearer(uid)).send(body);
const put = (uid: number, id: number, body: object) =>
  request(app).put(`/api/notes/${id}`).set('Authorization', bearer(uid)).send(body);
const get = (uid: number, id: number) => request(app).get(`/api/notes/${id}`).set('Authorization', bearer(uid));
const count = async () => Number((await pool.query('SELECT COUNT(*) FROM "POST_T"')).rows[0].count);

describe('Notes', () => {
  it('NOTE-TC1: publish with blank title and no slides lists both as missing', async () => {
    const uid = await insertUser();
    const res = await post(uid, await publishBody({ title: '', slides: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.errors).toMatchObject({
      title: 'Title is required',
      slides: 'At least one slide with content is required',
    });
    expect(await count()).toBe(0);
  });

  it('NOTE-TC2: publish without module is rejected', async () => {
    const res = await post(await insertUser(), await publishBody({ moduleId: null }));
    expect(res.status).toBe(400);
    expect(res.body.errors.moduleId).toBe('Module is required to publish');
  });

  it('NOTE-TC3: publish without hashtags is rejected', async () => {
    const res = await post(await insertUser(), await publishBody({ hashtags: [] }));
    expect(res.status).toBe(400);
    expect(res.body.errors.hashtags).toBe('At least one hashtag is required');
  });

  it('NOTE-TC4: invalid hashtag is named and six hashtags are rejected', async () => {
    const uid = await insertUser();
    const bad = await post(uid, await publishBody({ hashtags: ['data base!'] }));
    expect(bad.status).toBe(400);
    expect(bad.body.errors.hashtags).toContain('data base!');
    const six = await post(uid, await publishBody({ hashtags: ['a', 'b', 'c', 'd', 'e', 'f'] }));
    expect(six.status).toBe(400);
    expect(six.body.errors.hashtags).toBe('Maximum 5 hashtags');
  });

  it('NOTE-TC5: incomplete note is saved as a draft and listed in drafts only', async () => {
    const uid = await insertUser();
    const res = await post(uid, { title: 'Draft 1', status: 'draft' });
    expect(res.status).toBe(201);
    expect(res.body.note).toMatchObject({ status: 'draft', module: null, hashtags: [], slides: [], publishedAt: null });
    const drafts = await request(app).get('/api/notes/drafts').set('Authorization', bearer(uid));
    expect(drafts.body.notes.map((n: { title: string }) => n.title)).toEqual(['Draft 1']);
    // Not public: another user gets 404 (feed/search exclusion arrives with those features).
    expect((await get(await insertUser(), res.body.note.id)).status).toBe(404);
  });

  it('NOTE-TC6: valid public note is published with normalised hashtags and ordered slides', async () => {
    const uid = await insertUser({ displayName: 'Author' });
    const res = await post(uid, await publishBody());
    expect(res.status).toBe(201);
    const n = res.body.note;
    expect(n).toMatchObject({
      title: 'MVC basics',
      status: 'published',
      visibility: 'public',
      module: { code: 'CT046-3-M' },
      author: { id: uid, displayName: 'Author', isVerifiedLecturer: false },
    });
    expect(n.publishedAt).toBeTruthy();
    expect([...n.hashtags].sort()).toEqual(['design_patterns', 'mvc']);
    expect(n.slides).toEqual([
      { position: 1, content: '<p>one</p>' },
      { position: 2, content: '<p>two</p>' },
      { position: 3, content: '<p>three</p>' },
    ]);
    const { rows } = await pool.query(
      `SELECT pst_search_doc @@ plainto_tsquery('english', 'mvc') AS hit FROM "POST_T" WHERE pst_id = $1`,
      [n.id],
    );
    expect(rows[0].hit).toBe(true);
  });

  it('NOTE-TC7: contacts-only note is visible to a contact but not to a non-contact', async () => {
    const author = await insertUser();
    const contact = await insertUser();
    const stranger = await insertUser();
    await pool.query(`INSERT INTO "CONTACT_T" (con_usr_id, con_contact_id) VALUES ($1, $2)`, [author, contact]);
    const res = await post(author, await publishBody({ visibility: 'contacts' }));
    expect(res.status).toBe(201);
    const id = res.body.note.id;
    expect((await get(author, id)).status).toBe(200);
    expect((await get(contact, id)).status).toBe(200);
    expect((await get(stranger, id)).status).toBe(404);
  });

  it('NOTE-TC8: editing own published note stores new title and slide order and bumps updatedAt', async () => {
    const uid = await insertUser();
    const created = (await post(uid, await publishBody())).body.note;
    const res = await put(uid, created.id, await publishBody({
      title: 'MVC revised',
      slides: ['<p>two</p>', '<p>one</p>', '<p>three</p>'],
    }));
    expect(res.status).toBe(200);
    expect(res.body.note.title).toBe('MVC revised');
    expect(res.body.note.slides.map((s: { content: string }) => s.content)).toEqual(['<p>two</p>', '<p>one</p>', '<p>three</p>']);
    expect(new Date(res.body.note.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime());
    expect(res.body.note.publishedAt).toBe(created.publishedAt);
  });

  it('NOTE-TC9: another user gets 403 on PUT and DELETE and the note is unchanged', async () => {
    const a = await insertUser();
    const b = await insertUser();
    const id = (await post(a, await publishBody())).body.note.id;
    expect((await put(b, id, await publishBody({ title: 'hijack' }))).status).toBe(403);
    expect((await request(app).delete(`/api/notes/${id}`).set('Authorization', bearer(b))).status).toBe(403);
    const note = (await get(a, id)).body.note;
    expect(note.title).toBe('MVC basics');
    expect(note.status).toBe('published');
  });

  it('NOTE-TC10: script is removed from slide content and formatting is kept', async () => {
    const uid = await insertUser();
    const res = await post(uid, await publishBody({ slides: ['<script>alert(1)</script><b>ok</b>'] }));
    expect(res.status).toBe(201);
    expect(res.body.note.slides[0].content).toBe('<strong>ok</strong>');
  });

  it('NOTE-TC11: attributes and disallowed tags are stripped', async () => {
    const res = await post(await insertUser(), {
      title: 'x',
      status: 'draft',
      slides: ['<p onclick="x()" style="color:red">hi <a href="javascript:alert(1)">link</a><img src=x onerror=alert(1)></p>'],
    });
    expect(res.body.note.slides[0].content).toBe('<p>hi link</p>');
  });

  it('NOTE-TC12: a draft needs a title', async () => {
    const res = await post(await insertUser(), { title: '   ', status: 'draft' });
    expect(res.status).toBe(400);
    expect(res.body.errors.title).toBe('Title is required');
  });

  it('NOTE-TC13: more than 30 slides is rejected', async () => {
    const res = await post(await insertUser(), { title: 'x', status: 'draft', slides: Array(31).fill('<p>a</p>') });
    expect(res.status).toBe(400);
    expect(res.body.errors.slides).toBe('Maximum 30 slides');
  });

  it('NOTE-TC14: an unknown module id is rejected', async () => {
    const res = await post(await insertUser(), await publishBody({ moduleId: 99999 }));
    expect(res.status).toBe(400);
    expect(res.body.errors.moduleId).toBe('Module not found');
  });

  it('NOTE-TC15: a restricted user cannot create or edit notes', async () => {
    const ok = await insertUser();
    const id = (await post(ok, await publishBody())).body.note.id;
    await pool.query(`UPDATE "USER_T" SET usr_status = 'restricted' WHERE usr_id = $1`, [ok]);
    expect((await post(ok, await publishBody())).status).toBe(403);
    expect((await put(ok, id, await publishBody())).status).toBe(403);
  });

  it('NOTE-TC16: a published note cannot go back to draft', async () => {
    const uid = await insertUser();
    const id = (await post(uid, await publishBody())).body.note.id;
    const res = await put(uid, id, await publishBody({ status: 'draft' }));
    expect(res.status).toBe(400);
    expect(res.body.errors.status).toBe('A published note cannot be changed back to a draft');
  });

  it('NOTE-TC17: author deletes own note (soft delete) and it then returns 404', async () => {
    const uid = await insertUser();
    const id = (await post(uid, await publishBody())).body.note.id;
    expect((await request(app).delete(`/api/notes/${id}`).set('Authorization', bearer(uid))).status).toBe(204);
    expect((await get(uid, id)).status).toBe(404);
    const { rows } = await pool.query(`SELECT pst_status FROM "POST_T" WHERE pst_id = $1`, [id]);
    expect(rows[0].pst_status).toBe('deleted');
  });

  it('NOTE-TC18: a draft saved then published keeps one row and sets the published time', async () => {
    const uid = await insertUser();
    const id = (await post(uid, { title: 'WIP', status: 'draft' })).body.note.id;
    const res = await put(uid, id, await publishBody({ title: 'WIP' }));
    expect(res.status).toBe(200);
    expect(res.body.note.status).toBe('published');
    expect(res.body.note.publishedAt).toBeTruthy();
    expect(await count()).toBe(1);
  });

  it('NOTE-TC19: modules list and unauthenticated requests', async () => {
    const uid = await insertUser();
    const res = await request(app).get('/api/modules').set('Authorization', bearer(uid));
    expect(res.status).toBe(200);
    expect(res.body.modules[0]).toHaveProperty('code');
    expect((await request(app).get('/api/modules')).status).toBe(401);
    expect((await request(app).post('/api/notes').send({})).status).toBe(401);
  });
});
