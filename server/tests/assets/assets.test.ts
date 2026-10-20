import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { purgeUnlinkedAssets } from '../../src/features/assets/service';
import { clearUnsplashCache } from '../../src/features/unsplash/service';
import { env } from '../../src/lib/env';
import { storage } from '../../src/lib/storage';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, CSRF, insertUser, truncateAll } from '../helpers';

beforeEach(async () => {
  await truncateAll();
  clearUnsplashCache();
});
const unsplashKey = env.UNSPLASH_ACCESS_KEY;
afterEach(() => {
  vi.unstubAllGlobals();
  env.UNSPLASH_ACCESS_KEY = unsplashKey;
});
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
  it('NOTE-TC83: Your uploads lists only your own ready images, newest first, in pages', async () => {
    const me = await insertUser();
    const other = await insertUser();
    const a = await uploadOk(me);
    const b = await uploadOk(me);
    await uploadOk(other);
    await pool.query(`UPDATE "ASSET_T" SET ast_status = 'deleted' WHERE ast_id = $1`, [a]);
    const c = await uploadOk(me);
    const first = await request(app).get('/api/assets/images?limit=1').set(asUser(me));
    expect(first.status).toBe(200);
    expect(first.body.assets).toEqual([expect.objectContaining({ id: c, url: `/api/assets/${c}/file` })]);
    const next = await request(app).get(`/api/assets/images?limit=1&cursor=${first.body.nextCursor}`).set(asUser(me));
    expect(next.body.assets.map((x: { id: number }) => x.id)).toEqual([b]);
    expect(next.body.nextCursor).toBeNull();
    expect((await request(app).get('/api/assets/images')).status).toBe(401);
  });

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

  it('NOTE-TC53: upload requires a signed-in active user and the CSRF header', async () => {
    const body = await png();
    expect((await request(app).post('/api/assets/images').set(CSRF).attach('file', body, 'a.png')).status).toBe(401);
    const restricted = await insertUser({ status: 'restricted' });
    expect((await upload(restricted, body)).status).toBe(403);
    const { Cookie } = asUser(await insertUser());
    const noCsrf = await request(app).post('/api/assets/images').set({ Cookie }).attach('file', body, 'a.png');
    expect(noCsrf.status).toBe(403);
  });

  it('NOTE-TC53: upload answers 400 when no file is sent', async () => {
    const res = await request(app)
      .post('/api/assets/images')
      .set(asUser(await insertUser()))
      .send({});
    expect(res.status).toBe(400);
  });

  it('NOTE-TC49: enforces the 500 MB storage quota on the stored bytes', async () => {
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

  it('NOTE-TC54: an image element or background is accepted, linked to the note and listed in its assets map', async () => {
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

  it('NOTE-TC55: an edit collaborator keeps the owner asset and adds their own, then the owner saves again', async () => {
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

    const ownerSave = await request(app)
      .put(`/api/notes/${note.id}`)
      .set(asUser(owner))
      .send({
        title: 'Deck',
        status: 'draft',
        slides: [slide([imageEl(ownerAsset), imageEl(own, 9)])],
      });
    expect(ownerSave.status).toBe(200);
  });

  it('NOTE-TC55: an edit collaborator cannot add an owner asset that is not linked to this note', async () => {
    const owner = await insertUser();
    const editor = await insertUser();
    const unrelated = await uploadOk(owner);
    const note = (await saveDraft(owner, [])).body.note;
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'edit', $3)`,
      [note.id, editor, owner],
    );
    const res = await request(app)
      .put(`/api/notes/${note.id}`)
      .set(asUser(editor))
      .send({ title: 'Deck', status: 'draft', baseUpdatedAt: note.updatedAt, slides: [slide([imageEl(unrelated)])] });
    expect(res.status).toBe(400);
    expect(res.body.errors.slides).toBe('Slide 1, element 1: Image not found');
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
  it('NOTE-TC50: serves a public published note image to a guest and to other users', async () => {
    const { asset } = await noteWithImage();
    const res = await getAsset(asset);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['cache-control']).toContain('private');
    expect((await getAsset(asset, await insertUser())).status).toBe(200);
  });

  it('CLN-TC2: asset files are cached privately for a year as immutable', async () => {
    const { asset } = await noteWithImage();
    expect((await getAsset(asset)).headers['cache-control']).toBe('private, max-age=31536000, immutable');
  });

  it('NOTE-TC50: hides a deleted note image from others', async () => {
    const { author, asset, noteId } = await noteWithImage();
    await request(app).delete(`/api/notes/${noteId}`).set(asUser(author));
    expect((await getAsset(asset, await insertUser())).status).toBe(404);
  });

  it('NOTE-TC50: shows a friends-only note image to friends only, never to guests', async () => {
    const { author, asset } = await noteWithImage('contacts');
    const friend = await insertUser();
    await befriend(author, friend);
    expect((await getAsset(asset, friend)).status).toBe(200);
    expect((await getAsset(asset, await insertUser())).status).toBe(404);
    expect((await getAsset(asset)).status).toBe(404);
  });

  it('NOTE-TC50: hides the image from a user in a block with the author, in either direction', async () => {
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

  it('NOTE-TC50: hides a draft image from everyone but the owner and its collaborators', async () => {
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

  it('NOTE-TC50: a view link serves its note images to a guest, and nothing outside that note', async () => {
    const owner = await insertUser();
    const asset = await uploadOk(owner);
    const other = await uploadOk(owner);
    const note = (await saveDraft(owner, [imageEl(asset)])).body.note;
    const link = await request(app).post(`/api/notes/${note.id}/links`).set(asUser(owner)).send({ role: 'view' });
    expect(link.status).toBe(201);

    const shared = await request(app).get(`/api/share/${link.body.token}`);
    expect(shared.status).toBe(200);
    const url = shared.body.note.assets[asset];
    expect(url).toBe(`/api/share/${link.body.token}/assets/${asset}`);
    expect((await request(app).get(url)).status).toBe(200);
    expect((await getAsset(asset)).status).toBe(404);
    expect((await request(app).get(`/api/share/${link.body.token}/assets/${other}`)).status).toBe(404);
    expect((await request(app).get(`/api/share/${link.body.token}/assets/abc`)).status).toBe(404);
  });

  it('NOTE-TC53: asset file answers 404 for a malformed id', async () => {
    expect((await getAsset(0)).status).toBe(404);
    expect((await request(app).get('/api/assets/abc/file')).status).toBe(404);
  });

  it('NOTE-TC52: purges old assets no live note references and keeps linked ones', async () => {
    const { asset: linked } = await noteWithImage();
    const orphan = await uploadOk(await insertUser());
    const fresh = await uploadOk(await insertUser());
    await pool.query(`UPDATE "ASSET_T" SET ast_created_at = NOW() - INTERVAL '2 days' WHERE ast_id <> $1`, [fresh]);
    expect(await purgeUnlinkedAssets()).toEqual({ assets: 1, orphanedFiles: 0 });
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
  const withKey = (key: string | undefined) => void (env.UNSPLASH_ACCESS_KEY = key);

  it('NOTE-TC51: answers 503 "not configured" without a key', async () => {
    withKey(undefined);
    const uid = await insertUser();
    const search = await request(app).get('/api/unsplash/search?q=desk').set(asUser(uid));
    expect(search.status).toBe(503);
    expect(search.body.error).toMatch(/not configured/);
    expect((await request(app).post('/api/unsplash/abc_123/download').set(asUser(uid))).status).toBe(503);
  });

  it('NOTE-TC51: the Unsplash proxy requires sign-in and a search term', async () => {
    withKey('k');
    expect((await request(app).get('/api/unsplash/search?q=x')).status).toBe(401);
    const blank = await request(app)
      .get('/api/unsplash/search?q=%20')
      .set(asUser(await insertUser()));
    expect(blank.status).toBe(400);
  });

  it('NOTE-TC51: returns trimmed results with attribution, drops spoofed ones and caches the page', async () => {
    withKey('secret-key');
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
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe('Client-ID secret-key');
    await request(app).get('/api/unsplash/search?q=DESK&page=2').set(asUser(uid));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('NOTE-TC51: the Unsplash proxy answers 503 when Unsplash fails', async () => {
    withKey('k');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json({}, 500)),
    );
    const res = await request(app)
      .get('/api/unsplash/search?q=fail')
      .set(asUser(await insertUser()));
    expect(res.status).toBe(503);
  });

  it('NOTE-TC51: a download goes through the photo own download_location, never a client URL', async () => {
    withKey('k');
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
  });
});

it('STO-TC14: an image put that fails (such as an R2 timeout) removes the key it may have written', async () => {
  const uid = await insertUser();
  const put = vi.spyOn(storage, 'put').mockRejectedValueOnce(new Error('timed out'));
  const remove = vi.spyOn(storage, 'remove');
  const res = await upload(uid, await png());
  expect(res.status).toBe(500);
  expect(remove).toHaveBeenCalledWith(put.mock.calls[0]![0]);
  put.mockRestore();
  remove.mockRestore();
});

it('DEP-TC10: a file the purge cannot remove is counted as orphaned while its row stays deleted', async () => {
  const orphan = await uploadOk(await insertUser());
  await pool.query(`UPDATE "ASSET_T" SET ast_created_at = NOW() - INTERVAL '2 days'`);
  const remove = vi.spyOn(storage, 'remove').mockRejectedValueOnce(new Error('R2 delete failed with status 500'));
  expect(await purgeUnlinkedAssets()).toEqual({ assets: 1, orphanedFiles: 1 });
  remove.mockRestore();
  const { rows } = await pool.query(`SELECT ast_status FROM "ASSET_T" WHERE ast_id = $1`, [orphan]);
  expect(rows).toEqual([{ ast_status: 'deleted' }]);
});
