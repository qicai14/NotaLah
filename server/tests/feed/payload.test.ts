import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { agePublished, asUser, befriend, follow, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const get = (uid: number, url: string) => request(app).get(url).set(asUser(uid));

/** A ready image asset linked to note `noteId` and drawn on slide `position`. */
async function imageOnSlide(owner: number, noteId: number, position: number, kind = 'image'): Promise<number> {
  const { rows } = await pool.query<{ ast_id: number }>(
    `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_mime, ast_bytes, ast_status)
     VALUES ($1, $3, $2, 'image/webp', 10, 'ready') RETURNING ast_id`,
    [owner, `k${noteId}-${position}-${kind}`, kind],
  );
  const id = rows[0].ast_id;
  await pool.query(`INSERT INTO "POST_ASSET_T" (pas_pst_id, pas_ast_id) VALUES ($1, $2)`, [noteId, id]);
  const doc = {
    background: { kind: 'color', color: '#ffffff' },
    elements: [
      kind === 'video' ? { type: 'video', assetId: id } : { type: 'image', source: { kind: 'upload', assetId: id } },
    ],
  };
  await pool.query(`UPDATE "SLIDE_T" SET sld_doc = $3 WHERE sld_pst_id = $1 AND sld_position = $2`, [
    noteId,
    position,
    JSON.stringify(doc),
  ]);
  return id;
}

describe('Feed payload (R39, D71)', () => {
  it('FEED-TC1: ranked feed carries only the first slides, slideCount and their assets', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const note = await insertNote(author, { slides: 6 });
    const first = await imageOnSlide(author, note, 1);
    const late = await imageOnSlide(author, note, 5);
    await imageOnSlide(author, note, 6, 'video');
    const short = await insertNote(author, { slides: 1 });

    const res = await get(viewer, '/api/feed');
    const item = (id: number) => res.body.items.find((i: { id: number }) => i.id === id);
    expect(item(note).slideCount).toBe(6);
    expect(item(note).slides.map((s: { position: number }) => s.position)).toEqual([1, 2]);
    expect(Object.keys(item(note).assets)).toEqual([String(first)]);
    expect(Object.keys(item(note).assets)).not.toContain(String(late));
    expect(item(note).videoStatus).toEqual({});
    expect(item(short).slideCount).toBe(1);
    expect(item(short).slides).toHaveLength(1);
  });

  it('FEED-TC2: Following feed and guest feed also carry only the first slides', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    await follow(viewer, author);
    await insertNote(author, { slides: 5 });
    await agePublished();

    const following = await get(viewer, '/api/feed?tab=following');
    const guest = await request(app).get('/api/feed');
    for (const item of [following.body.items[0], guest.body.items[0]]) {
      expect(item.slideCount).toBe(5);
      expect(item.slides).toHaveLength(2);
    }
  });

  it('FEED-TC3: the full note comes from GET /notes/:id with every slide and asset', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const note = await insertNote(author, { slides: 5 });
    const late = await imageOnSlide(author, note, 5);

    const res = await get(viewer, `/api/notes/${note}`);
    expect(res.status).toBe(200);
    expect(res.body.note.slides).toHaveLength(5);
    expect(res.body.note.slideCount).toBe(5);
    expect(Object.keys(res.body.note.assets)).toEqual([String(late)]);
  });

  it('FEED-TC4: friends-only and hidden notes stay protected when the rest is fetched', async () => {
    const author = await insertUser();
    const friend = await insertUser();
    const stranger = await insertUser();
    await befriend(author, friend);
    const contacts = await insertNote(author, { slides: 5, visibility: 'contacts' });
    const hiding = await insertNote(author, { slides: 5 });

    expect((await get(friend, '/api/feed')).body.items.map((i: { id: number }) => i.id)).toContain(contacts);
    expect((await get(friend, `/api/notes/${contacts}`)).body.note.slides).toHaveLength(5);
    expect((await get(stranger, `/api/notes/${contacts}`)).status).toBe(404);
    expect((await request(app).get(`/api/notes/${contacts}`)).status).toBe(404);

    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [hiding]);
    expect((await get(friend, `/api/notes/${hiding}`)).status).toBe(404);
    expect((await get(friend, '/api/feed')).body.items.map((i: { id: number }) => i.id)).not.toContain(hiding);
  });
});
