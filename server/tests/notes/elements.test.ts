import { readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, CSRF, insertUser, slideHtml, textEl, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

// The spec numbers these NOTE-TC26 to NOTE-TC42, but TC26 and TC27 already name the drafts and guest tests.
const post = (uid: number, body: object) => request(app).post('/api/notes').set(asUser(uid)).send(body);
const put = (uid: number, id: number, body: object) => request(app).put(`/api/notes/${id}`).set(asUser(uid)).send(body);
const get = (uid: number, id: number) => request(app).get(`/api/notes/${id}`).set(asUser(uid));

const id = (n: number) => `abcdef01-0000-4000-8000-${String(n).padStart(12, '0')}`;
const box = { x: 100, y: 100, w: 300, h: 200, rotation: 0, opacity: 1, locked: false };
const el = (n: number, type: string, props: object) => ({ id: id(n), ...box, type, ...props });
const shape = (n: number, over: object = {}) =>
  el(n, 'shape', { shape: 'rect', fill: null, stroke: null, strokeWidth: 0, radius: 0, ...over });
const code = (n: number, chars: number) =>
  el(n, 'code', { code: 'x'.repeat(chars), language: 'sql', theme: 'light', size: 20 });
const table = (cells: string[][]) =>
  el(7, 'table', { cells, font: 'lora', size: 24, color: '#111111', borderColor: '#cccccc', headerRow: true });
const image = (n: number, alt: string) =>
  el(n, 'image', {
    source: {
      kind: 'unsplash',
      photoId: 'abc_123',
      url: 'https://images.unsplash.com/photo-1',
      authorName: 'A B',
      authorUrl: 'https://unsplash.com/@ab',
    },
    alt,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    flipX: false,
    flipY: true,
    radius: 12,
  });

const deck = (elements: object[], over: object = {}) => ({
  background: { kind: 'color', color: '#ffffff' },
  elements,
  notes: '',
  ...over,
});
const oneSlide = (elements: object[]) => ({ slides: [deck(elements)] });
const draft = (over: object = {}) => ({ title: 'Deck', status: 'draft', ...over });
const text = (html: string, over: object = {}) => textEl(html, { id: id(1), ...over });

const rejected = async (body: object) => {
  const res = await post(await insertUser(), draft(body));
  expect(res.status).toBe(400);
  return res.body.errors as Record<string, string>;
};

describe('Slide elements (R21a)', () => {
  it('NOTE-TC26: a deck with every element type is stored and returned unchanged', async () => {
    const uid = await insertUser();
    const elements = [
      text('<p>Hello</p>'),
      shape(2, { shape: 'ellipse', fill: '#ff0000' }),
      el(3, 'line', { stroke: '#000000', strokeWidth: 4, dash: 'dashed', startCap: 'none', endCap: 'arrow' }),
      image(4, 'A diagram'),
      el(5, 'code', { code: 'SELECT 1;', language: 'sql', theme: 'dark', size: 28 }),
      el(6, 'video', { assetId: 7, loop: true }),
      table([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ];
    const background = { kind: 'gradient', from: '#112233', to: '#445566', angle: 90 };
    const body = draft({ aspect: '9:16', theme: 'lecture', slides: [deck(elements, { background, notes: 'say hi' })] });
    const res = await post(uid, body);
    expect(res.status).toBe(201);
    const got = (await get(uid, res.body.note.id)).body.note;
    expect(got).toMatchObject({ aspect: '9:16', theme: 'lecture', music: null, assets: {} });
    expect(got.slides).toEqual([{ position: 1, background, elements, notes: 'say hi' }]);
  });

  it('NOTE-TC27: an unknown element type or an extra key is a 400 naming the slide and element', async () => {
    const unknown = await rejected(oneSlide([text('<p>a</p>'), el(2, 'iframe', {})]));
    expect(unknown.slides).toMatch(/^Slide 1, element 2: /);
    const extra = await rejected(oneSlide([text('<p>a</p>', { style: 'x' })]));
    expect(extra.slides).toMatch(/^Slide 1, element 1: .*style/);
  });

  it('NOTE-TC28: out-of-range geometry is rejected', async () => {
    for (const bad of [{ x: 1e9 }, { rotation: 400 }, { opacity: 2 }, { w: 0 }]) {
      const errors = await rejected(oneSlide([shape(1, bad)]));
      expect(errors.slides).toMatch(/^Slide 1, element 1: /);
    }
  });

  it('NOTE-TC29: an invalid colour, font or aspect is rejected', async () => {
    expect((await rejected(oneSlide([text('<p>a</p>', { color: 'red;background:url(x)' })]))).slides).toMatch(/colour/);
    expect((await rejected(oneSlide([text('<p>a</p>', { font: 'Comic Sans' })]))).slides).toMatch(/font/);
    expect((await rejected({ aspect: '1:1' })).aspect).toBe('Invalid aspect');
  });

  it('NOTE-TC30: two elements with the same id are rejected', async () => {
    const errors = await rejected({ slides: [deck([text('<p>a</p>')]), deck([text('<p>b</p>')])] });
    expect(errors.slides).toBe('Slide 2, element 1: Duplicate element id');
  });

  it('NOTE-TC31: only a text colour span survives sanitising', async () => {
    const html =
      '<p><span style="color:#ff0000;font-size:99px" onclick="x()">hi</span> <u>u</u><script>alert(1)</script></p>';
    const res = await post(await insertUser(), draft(oneSlide([text(html)])));
    expect(res.status).toBe(201);
    expect(slideHtml(res.body.note.slides)[0]).toBe('<p><span style="color:#ff0000">hi</span> <u>u</u></p>');
  });

  it('NOTE-TC32: slide, element, video, text and note limits are enforced', async () => {
    const slides31 = Array.from({ length: 31 }, () => deck([]));
    expect((await rejected({ slides: slides31 })).slides).toBe('Maximum 30 slides');
    const many = Array.from({ length: 61 }, (_, i) => shape(i + 1));
    expect((await rejected(oneSlide(many))).slides).toBe('Slide 1: Maximum 60 elements per slide');
    const video = (n: number) => el(n, 'video', { assetId: n, loop: false });
    expect((await rejected(oneSlide([video(1), video(2)]))).slides).toBe('Slide 1: Maximum 1 video per slide');
    const long = [code(1, 5000), code(2, 5000), code(3, 5000), code(4, 5000), code(5, 1)];
    expect((await rejected(oneSlide(long))).slides).toBe('Slide 1: Text must be at most 20,000 characters');
    const big = oneSlide([text(`<p>${'a'.repeat(5000)}</p>`)]);
    expect((await rejected(big)).slides).toBe('Slide 1, element 1: Text is too long');
    const notes = { slides: [deck([], { notes: 'n'.repeat(2001) })] };
    expect((await rejected(notes)).slides).toBe('Slide 1: Notes must be at most 2000 characters');
    const exact = await post(
      await insertUser(),
      draft({ slides: [deck(long.slice(0, 4), { notes: 'n'.repeat(2000) })] }),
    );
    expect(exact.status).toBe(201);
  });

  it('NOTE-TC35: search finds words in text, code, table and alt text but not in page notes', async () => {
    const elements = [
      text('<p>zebrafish</p>'),
      el(2, 'code', { code: 'kangaroo()', language: 'javascript', theme: 'light', size: 20 }),
      image(3, 'wombat'),
      table([['axolotl']]),
    ];
    const res = await post(await insertUser(), draft({ slides: [deck(elements, { notes: 'platypus' })] }));
    expect(res.status).toBe(201);
    const hit = async (word: string) =>
      (
        await pool.query(
          `SELECT pst_search_doc @@ plainto_tsquery('english', $2) AS hit FROM "POST_T" WHERE pst_id = $1`,
          [res.body.note.id, word],
        )
      ).rows[0].hit;
    const words = ['zebrafish', 'kangaroo', 'wombat', 'axolotl'];
    expect(await Promise.all(words.map(hit))).toEqual([true, true, true, true]);
    expect(await hit('platypus')).toBe(false);
  });

  it('NOTE-TC36: page notes reach the author, not other readers or guests', async () => {
    const author = await insertUser();
    const reader = await insertUser();
    const body = {
      ...draft({ status: 'published', visibility: 'public', hashtags: ['x'] }),
      moduleId: (await pool.query(`SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1`)).rows[0].mod_id,
      slides: [deck([text('<p>x</p>')], { notes: 'secret' })],
    };
    const res = await post(author, body);
    expect(res.status).toBe(201);
    const noteId = res.body.note.id;
    expect(res.body.note.slides[0].notes).toBe('secret');
    expect((await get(author, noteId)).body.note.slides[0].notes).toBe('secret');
    expect((await get(reader, noteId)).body.note.slides[0]).not.toHaveProperty('notes');
    const guest = await request(app).get(`/api/notes/${noteId}`).set(CSRF);
    expect(guest.body.note.slides[0]).not.toHaveProperty('notes');
  });

  it('NOTE-TC41: a save with an old baseUpdatedAt is a 409 and changes nothing', async () => {
    const uid = await insertUser();
    const created = (await post(uid, draft(oneSlide([text('<p>a</p>')])))).body.note;
    const saved = await put(uid, created.id, draft({ title: 'Second', baseUpdatedAt: created.updatedAt }));
    expect(saved.status).toBe(200);
    const stale = await put(uid, created.id, draft({ title: 'Third', baseUpdatedAt: created.updatedAt }));
    expect(stale.status).toBe(409);
    expect((await get(uid, created.id)).body.note.title).toBe('Second');
  });

  it('NOTE-TC42: the migration turns HTML slides into text elements and the down step restores them', async () => {
    const uid = await insertUser();
    const htmls = ['<p>one</p>', '<p>two</p>', '<p>three</p>'];
    const slides = htmls.map((h, i) => deck([text(h, { id: id(i + 1) })]));
    const created = (await post(uid, draft({ slides }))).body.note;
    const searchDoc = async (c: { query: typeof pool.query }) =>
      (await c.query(`SELECT pst_search_doc::TEXT AS d FROM "POST_T" WHERE pst_id = $1`, [created.id])).rows[0].d;
    const file = readFileSync(path.resolve(__dirname, '../../db/migrations/20261017000001_slide_elements.sql'), 'utf8');
    const [up, down] = file.replace('-- migrate:up', '').split('-- migrate:down');
    const before = await searchDoc(pool);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(down);
      const old = await c.query(`SELECT sld_content FROM "SLIDE_T" WHERE sld_pst_id = $1 ORDER BY sld_position`, [
        created.id,
      ]);
      expect(old.rows.map((r) => r.sld_content)).toEqual(htmls);
      await c.query(up);
      const now = await c.query(`SELECT sld_doc FROM "SLIDE_T" WHERE sld_pst_id = $1 ORDER BY sld_position`, [
        created.id,
      ]);
      const texts = now.rows.map((r) =>
        r.sld_doc.elements.map((e: { type: string; html: string }) => [e.type, e.html]),
      );
      expect(texts).toEqual(htmls.map((h) => [['text', h]]));
      expect(await searchDoc(c)).toBe(before);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });
});
