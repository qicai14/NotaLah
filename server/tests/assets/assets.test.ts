import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { purgeUnlinkedAssets } from '../../src/features/assets/service';
import { clearUnsplashCache } from '../../src/features/unsplash/service';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, CSRF, insertUser, truncateAll } from '../helpers';

beforeEach(async () => {
  await truncateAll();
  clearUnsplashCache();
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await rm(env.STORAGE_DIR, { recursive: true, force: true });
  await pool.end();
});

const png = (w = 40, h = 30) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();

const upload = (uid: number, body: Buffer, filename = 'a.png', contentType = 'image/png') =>
  request(app).post('/api/assets/images').set(asUser(uid)).attach('file', body, { filename, contentType });

const uploadOk = async (uid: number, body?: Buffer): Promise<number> => {
  const res = await upload(uid, body ?? (await png()));
  expect(res.status).toBe(201);
  return res.body.asset.id;
};

const el = (n: number, type: string, props: object) => ({
  id: `abcdef01-0000-4000-8000-${String(n).padStart(12, '0')}`,
  x: 100,
  y: 100,
  w: 300,
  h: 200,
  rotation: 0,
  opacity: 1,
  locked: false,
  type,
  ...props,
});
const imageEl = (assetId: number, n = 1) =>
  el(n, 'image', {
    source: { kind: 'upload', assetId },
    alt: 'diagram',
    crop: { x: 0, y: 0, w: 1, h: 1 },
    flipX: false,
    flipY: false,
    radius: 0,
  });
const videoEl = (assetId: number) => el(2, 'video', { assetId, loop: false });
const slide = (elements: object[], background: object = { kind: 'color', color: '#ffffff' }) => ({
  background,
  elements,
  notes: '',
});
const saveDraft = (uid: number, elements: object[]) =>
  request(app)
    .post('/api/notes')
    .set(asUser(uid))
    .send({ title: 'Deck', status: 'draft', slides: [slide(elements)] });

const publish = (id: number, visibility = 'public') =>
  pool.query(
    `UPDATE "POST_T" SET pst_status = 'published', pst_visibility = $2, pst_published_at = NOW(),
            pst_mod_id = (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1) WHERE pst_id = $1`,
    [id, visibility],
  );
const getAsset = (id: number, uid?: number) =>
  request(app)
    .get(`/api/assets/${id}/file`)
    .set(uid ? asUser(uid) : {});

/** An author with one published note that uses their uploaded image. */
async function noteWithImage(visibility = 'public') {
  const author = await insertUser();
  const asset = await uploadOk(author);
  const res = await saveDraft(author, [imageEl(asset)]);
  expect(res.status).toBe(201);
  await publish(res.body.note.id, visibility);
  return { author, asset, noteId: res.body.note.id as number };
}

describe('Image upload (R22)', () => {
  it('NOTE-TC38: rejects a file over 5 MB with 413', async () => {
    const res = await upload(await insertUser(), Buffer.alloc(5 * 1024 * 1024 + 1, 1));
    expect(res.status).toBe(413);
  });

  it('NOTE-TC38: rejects a text file renamed to .png, whatever its MIME header says', async () => {
    const res = await upload(await insertUser(), Buffer.from('not an image at all'), 'evil.png', 'image/png');
    expect(res.status).toBe(400);
  });

  it('NOTE-TC38: rejects SVG even with an image MIME type', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    expect((await upload(await insertUser(), svg, 'x.png', 'image/png')).status).toBe(400);
  });

  it('NOTE-TC38: stores an image with GPS EXIF as WebP without EXIF', async () => {
    const uid = await insertUser();
    const withGps = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#ffffff' } })
      .jpeg()
      .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '1/1 2/1 3/1' } })
      .toBuffer();
    expect((await sharp(withGps).metadata()).exif).toBeDefined();
    const res = await upload(uid, withGps, 'photo.png', 'image/png');
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({ kind: 'image', mime: 'image/webp', width: 40, height: 30 });
    const file = await getAsset(res.body.asset.id, uid);
    expect(file.headers['content-type']).toBe('image/webp');
    const meta = await sharp(file.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
  });

  it('NOTE-TC38: stores a GIF as a still WebP and scales the longest edge to 2560', async () => {
    const uid = await insertUser();
    const gif = await sharp({ create: { width: 3000, height: 100, channels: 3, background: '#ff0000' } })
      .gif()
      .toBuffer();
    const res = await upload(uid, gif, 'a.gif', 'image/gif');
    expect(res.status).toBe(201);
    expect(res.body.asset).toMatchObject({ mime: 'image/webp', width: 2560, height: 85 });
  });

  it('requires a signed-in active user and the CSRF header', async () => {
    const body = await png();
    expect((await request(app).post('/api/assets/images').set(CSRF).attach('file', body, 'a.png')).status).toBe(401);
    const restricted = await insertUser({ status: 'restricted' });
    expect((await upload(restricted, body)).status).toBe(403);
    const { Cookie } = asUser(await insertUser());
    const noCsrf = await request(app).post('/api/assets/images').set({ Cookie }).attach('file', body, 'a.png');
    expect(noCsrf.status).toBe(403);
  });

  it('answers 400 when no file is sent', async () => {
    const res = await request(app)
      .post('/api/assets/images')
      .set(asUser(await insertUser()))
      .send({});
    expect(res.status).toBe(400);
  });

  it('enforces the 500 MB storage quota on the stored bytes', async () => {
    const uid = await insertUser();
    await pool.query(
      `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_mime, ast_bytes, ast_status)
       VALUES ($1, 'image', $2, 'image/webp', $3, 'ready')`,
      [uid, `i/${randomUUID()}.webp`, 500 * 1024 * 1024 - 10],
    );
    const res = await upload(uid, await png());
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/500 MB/);
    expect((await upload(await insertUser(), await png())).status).toBe(201);
  });
});

describe('Assets in notes (R22)', () => {
  it('NOTE-TC33: refuses another user asset, an unready asset and a wrong-kind asset', async () => {
    const a = await insertUser();
    const b = await insertUser();
    const asset = await uploadOk(a);
    expect((await saveDraft(b, [imageEl(asset)])).status).toBe(400);

    const pending = await pool.query<{ ast_id: number }>(
      `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_mime, ast_bytes)
       VALUES ($1, 'video', $2, 'video/mp4', 10) RETURNING ast_id`,
      [b, `v/${randomUUID()}.mp4`],
    );
    const bad = await saveDraft(b, [videoEl(pending.rows[0].ast_id)]);
    expect(bad.status).toBe(400);
    expect(bad.body.errors.slides).toBe('Slide 1, element 1: Video not found');

    const mine = await uploadOk(b);
    expect((await saveDraft(b, [videoEl(mine)])).status).toBe(400);
    expect((await saveDraft(b, [imageEl(999999)])).status).toBe(400);
  });

  it('accepts an image element or background, returns the assets map and links it to the note', async () => {
    const uid = await insertUser();
    const a = await uploadOk(uid);
    const res = await request(app)
      .post('/api/notes')
      .set(asUser(uid))
      .send({
        title: 'Deck',
        status: 'draft',
        slides: [slide([imageEl(a)], { kind: 'image', image: { kind: 'upload', assetId: a } })],
      });
    expect(res.status).toBe(201);
    expect(res.body.note.assets).toEqual({ [a]: `/api/assets/${a}/file` });
    const { rows } = await pool.query(`SELECT * FROM "POST_ASSET_T" WHERE pas_pst_id = $1`, [res.body.note.id]);
    expect(rows).toHaveLength(1);

    const cleared = await request(app)
      .put(`/api/notes/${res.body.note.id}`)
      .set(asUser(uid))
      .send({ title: 'Deck', status: 'draft', slides: [slide([])] });
    expect(cleared.status).toBe(200);
    expect(cleared.body.note.assets).toEqual({});
  });

  it('NOTE-TC40: another user cannot use or read an unreferenced asset; the owner can reuse it across notes', async () => {
    const a = await insertUser();
    const b = await insertUser();
    const asset = await uploadOk(a);
    expect((await getAsset(asset, b)).status).toBe(404);
    expect((await getAsset(asset)).status).toBe(404);
    expect((await getAsset(asset, a)).status).toBe(200);
    expect((await saveDraft(a, [imageEl(asset)])).status).toBe(201);
    expect((await saveDraft(a, [imageEl(asset)])).status).toBe(201);
  });

  it('lets an edit collaborator keep the owner asset and add their own', async () => {
    const owner = await insertUser();
    const editor = await insertUser();
    const ownerAsset = await uploadOk(owner);
    const note = (await saveDraft(owner, [imageEl(ownerAsset)])).body.note;
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'edit', $3)`,
      [note.id, editor, owner],
    );
    const own = await uploadOk(editor);
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set(asUser(editor))
      .send({
        title: 'Deck',
        status: 'draft',
        baseUpdatedAt: note.updatedAt,
        slides: [slide([imageEl(ownerAsset), imageEl(own, 9)])],
      });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.note.assets).sort()).toEqual([String(ownerAsset), String(own)].sort());
    expect((await getAsset(own, owner)).status).toBe(200);
  });

  it('NOTE-TC37: a hidden note hides its assets from others, but not from its author', async () => {
    const { author, asset, noteId } = await noteWithImage();
    const reader = await insertUser();
    expect((await getAsset(asset, reader)).status).toBe(200);
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [noteId]);

    const note = await request(app).get(`/api/notes/${noteId}`).set(asUser(reader));
    expect(note.status).toBe(404);
    expect(JSON.stringify(note.body)).not.toContain('/api/assets/');
    expect((await getAsset(asset, reader)).status).toBe(404);
    expect((await getAsset(asset)).status).toBe(404);

    const own = await request(app).get(`/api/notes/${noteId}`).set(asUser(author));
    expect(own.status).toBe(200);
    expect(own.body.note.assets[asset]).toBe(`/api/assets/${asset}/file`);
    expect((await getAsset(asset, author)).status).toBe(200);
  });
});

describe('Asset file access (R22)', () => {
  it('serves a public published note image to a guest and to other users', async () => {
    const { asset } = await noteWithImage();
    const res = await getAsset(asset);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('private');
    expect((await getAsset(asset, await insertUser())).status).toBe(200);
  });

  it('hides a deleted note image from others', async () => {
    const { author, asset, noteId } = await noteWithImage();
    await request(app).delete(`/api/notes/${noteId}`).set(asUser(author));
    expect((await getAsset(asset, await insertUser())).status).toBe(404);
  });

  it('shows a friends-only note image to friends only, never to guests', async () => {
    const { author, asset } = await noteWithImage('contacts');
    const friend = await insertUser();
    await befriend(author, friend);
    expect((await getAsset(asset, friend)).status).toBe(200);
    expect((await getAsset(asset, await insertUser())).status).toBe(404);
    expect((await getAsset(asset)).status).toBe(404);
  });

  it('hides the image from a user in a block with the author, in either direction', async () => {
    const { author, asset } = await noteWithImage();
    const blocker = await insertUser();
    const blocked = await insertUser();
    await pool.query(`INSERT INTO "BLOCK_T" (blk_blocker_id, blk_blocked_id) VALUES ($1, $2), ($3, $4)`, [
      blocker,
      author,
      author,
      blocked,
    ]);
    expect((await getAsset(asset, blocker)).status).toBe(404);
    expect((await getAsset(asset, blocked)).status).toBe(404);
  });

  it('hides a draft image from everyone but the owner and its collaborators', async () => {
    const owner = await insertUser();
    const asset = await uploadOk(owner);
    const note = (await saveDraft(owner, [imageEl(asset)])).body.note;
    const viewer = await insertUser();
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'view', $3)`,
      [note.id, viewer, owner],
    );
    expect((await getAsset(asset, viewer)).status).toBe(200);
    expect((await getAsset(asset, await insertUser())).status).toBe(404);
    expect((await getAsset(asset)).status).toBe(404);
  });

  it('answers 404 for a malformed id', async () => {
    expect((await getAsset(0)).status).toBe(404);
    expect((await request(app).get('/api/assets/abc/file')).status).toBe(404);
  });

  it('purges old assets no live note references and keeps linked ones', async () => {
    const { asset: linked } = await noteWithImage();
    const orphan = await uploadOk(await insertUser());
    const fresh = await uploadOk(await insertUser());
    await pool.query(`UPDATE "ASSET_T" SET ast_created_at = NOW() - INTERVAL '2 days' WHERE ast_id <> $1`, [fresh]);
    expect(await purgeUnlinkedAssets()).toBe(1);
    const { rows } = await pool.query<{ ast_id: number; ast_status: string }>(
      `SELECT ast_id, ast_status FROM "ASSET_T"`,
    );
    const status = Object.fromEntries(rows.map((r) => [r.ast_id, r.ast_status]));
    expect(status).toEqual({ [linked]: 'ready', [orphan]: 'deleted', [fresh]: 'ready' });
  });
});

describe('Unsplash proxy (R22)', () => {
  const photo = (over: object = {}) => ({
    id: 'abc_123',
    width: 4000,
    height: 3000,
    alt_description: 'a desk',
    urls: { regular: 'https://images.unsplash.com/photo-1?w=1080', small: 'https://images.unsplash.com/photo-1?w=400' },
    user: { name: 'Ann Lee', links: { html: 'https://unsplash.com/@ann' } },
    ...over,
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const withKey = (key: string | undefined) => {
    const before = env.UNSPLASH_ACCESS_KEY;
    env.UNSPLASH_ACCESS_KEY = key;
    return () => void (env.UNSPLASH_ACCESS_KEY = before);
  };

  it('NOTE-TC34: answers 503 "not configured" without a key', async () => {
    const restore = withKey(undefined);
    const uid = await insertUser();
    const search = await request(app).get('/api/unsplash/search?q=desk').set(asUser(uid));
    expect(search.status).toBe(503);
    expect(search.body.error).toMatch(/not configured/);
    expect((await request(app).post('/api/unsplash/abc_123/download').set(asUser(uid))).status).toBe(503);
    restore();
  });

  it('requires sign-in and a search term', async () => {
    const restore = withKey('k');
    expect((await request(app).get('/api/unsplash/search?q=x')).status).toBe(401);
    const blank = await request(app)
      .get('/api/unsplash/search?q=%20')
      .set(asUser(await insertUser()));
    expect(blank.status).toBe(400);
    restore();
  });

  it('NOTE-TC34: returns trimmed results with attribution, drops spoofed ones and caches the page', async () => {
    const restore = withKey('secret-key');
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({
        total_pages: 3,
        results: [
          photo(),
          photo({ id: 'evil', urls: { regular: 'https://evil.example/x.jpg' } }),
          photo({ id: 'evil2', user: { name: 'X', links: { html: 'https://evil.example/@x' } } }),
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const uid = await insertUser();
    const res = await request(app).get('/api/unsplash/search?q=desk&page=2').set(asUser(uid));
    expect(res.status).toBe(200);
    expect(res.body.totalPages).toBe(3);
    expect(res.body.results).toEqual([
      {
        photoId: 'abc_123',
        url: 'https://images.unsplash.com/photo-1?w=1080',
        thumbUrl: 'https://images.unsplash.com/photo-1?w=400',
        width: 4000,
        height: 3000,
        alt: 'a desk',
        authorName: 'Ann Lee',
        authorUrl: 'https://unsplash.com/@ann?utm_source=notalah&utm_medium=referral',
      },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('https://api.unsplash.com/search/photos?query=desk&page=2');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Client-ID secret-key');
    await request(app).get('/api/unsplash/search?q=DESK&page=2').set(asUser(uid));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    restore();
  });

  it('answers 503 when Unsplash fails', async () => {
    const restore = withKey('k');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({}, 500)),
    );
    const res = await request(app)
      .get('/api/unsplash/search?q=fail')
      .set(asUser(await insertUser()));
    expect(res.status).toBe(503);
    restore();
  });

  it('records a download through the photo own download_location, never a client URL', async () => {
    const restore = withKey('k');
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/photos/abc_123')
        ? json({ links: { download_location: 'https://api.unsplash.com/photos/abc_123/download?ixid=1' } })
        : json({ url: 'x' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const uid = await insertUser();
    const res = await request(app).post('/api/unsplash/abc_123/download').set(asUser(uid));
    expect(res.status).toBe(204);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      'https://api.unsplash.com/photos/abc_123',
      'https://api.unsplash.com/photos/abc_123/download?ixid=1',
    ]);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({ links: { download_location: 'http://169.254.169.254/' } })),
    );
    expect((await request(app).post('/api/unsplash/abc_123/download').set(asUser(uid))).status).toBe(503);
    expect((await request(app).post('/api/unsplash/..%2Fme/download').set(asUser(uid))).status).toBe(404);
    restore();
  });
});
