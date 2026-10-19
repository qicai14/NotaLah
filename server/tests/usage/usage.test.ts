import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { clearUnsplashCache } from '../../src/features/unsplash/service';
import { capFromEnv, FREE, METRICS, SHARE, STORAGE_CAP_BYTES } from '../../src/features/usage/config';
import { consume, periodKey } from '../../src/features/usage/service';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { storage } from '../../src/lib/storage';
import { asUser, insertUser, truncateAll } from '../helpers';

beforeEach(async () => {
  await truncateAll();
  clearUnsplashCache();
});
const flags = { key: env.UNSPLASH_ACCESS_KEY, off: env.UPLOADS_DISABLED };
afterEach(() => {
  vi.unstubAllGlobals();
  env.UNSPLASH_ACCESS_KEY = flags.key;
  env.UPLOADS_DISABLED = flags.off;
});
afterAll(async () => {
  await rm(env.STORAGE_DIR, { recursive: true, force: true });
  await pool.end();
});

const png = () =>
  sharp({
    create: { width: 40, height: 30, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer();
const upload = async (uid: number) =>
  request(app)
    .post('/api/assets/images')
    .set(asUser(uid))
    .attach('file', await png(), {
      filename: 'a.png',
      contentType: 'image/png',
    });
const setCount = (metric: keyof typeof METRICS, count: number) =>
  pool.query(
    `INSERT INTO "USAGE_COUNTER_T" (ucn_metric, ucn_period, ucn_count) VALUES ($1, $2, $3)
     ON CONFLICT (ucn_metric, ucn_period) DO UPDATE SET ucn_count = $3`,
    [metric, periodKey(METRICS[metric].period), count],
  );
const countOf = async (metric: string) =>
  Number(
    (await pool.query(`SELECT COALESCE(SUM(ucn_count), 0) AS n FROM "USAGE_COUNTER_T" WHERE ucn_metric = $1`, [metric]))
      .rows[0].n,
  );

describe('free-tier cost guard (R34, D57)', () => {
  it('USE-TC1: concurrent consume never overshoots the cap', async () => {
    const results = await Promise.all(Array.from({ length: 40 }, () => consume('unsplash', 1, 25)));
    expect(results.filter(Boolean)).toHaveLength(25);
    expect(await countOf('unsplash')).toBe(25);
    expect(await consume('unsplash', 3, 27)).toBe(false);
    expect(await consume('unsplash', 2, 27)).toBe(true);
    expect(await consume('class_a', 5, 4)).toBe(false);
  });

  it('USE-TC2: a new period starts from zero', async () => {
    const hour1 = new Date('2026-10-18T14:59:00Z');
    const hour2 = new Date('2026-10-18T15:00:00Z');
    expect(periodKey('hour', hour1)).toBe('2026-10-18T14');
    expect(periodKey('month', hour2)).toBe('2026-10');
    expect(periodKey('day', hour2)).toBe('2026-10-18');
    expect(await consume('unsplash', 2, 2, hour1)).toBe(true);
    expect(await consume('unsplash', 1, 2, hour1)).toBe(false);
    expect(await consume('unsplash', 1, 2, hour2)).toBe(true);
  });

  it('USE-TC3: an upload that would pass the global storage cap is refused with 507 and nothing is stored', async () => {
    const a = await insertUser({ email: 'a@notalah.test' });
    const b = await insertUser({ email: 'b@notalah.test' });
    const chunk = 2_000_000_000;
    for (let i = 0; i * chunk < STORAGE_CAP_BYTES; i++) {
      await pool.query(
        `INSERT INTO "ASSET_T" (ast_usr_id, ast_kind, ast_key, ast_mime, ast_bytes, ast_status)
         VALUES ($1, 'image', $2, 'image/webp', $3, 'ready')`,
        [a, `i/00000000-0000-0000-0000-00000000000${i}.webp`, Math.min(chunk, STORAGE_CAP_BYTES - i * chunk)],
      );
    }
    const res = await upload(b);
    expect(res.status).toBe(507);
    expect(res.body.error).toMatch(/storage is full/i);
    expect(await countOf('class_a')).toBe(0);
    await pool.query(`UPDATE "ASSET_T" SET ast_status = 'deleted'`);
    expect((await upload(b)).status).toBe(201);
  });

  it('USE-TC4: Class A exhausted refuses the upload with 503; Class B exhausted stops serving only', async () => {
    const uid = await insertUser();
    const id = (await upload(uid)).body.asset.id;
    expect((await request(app).get(`/api/assets/${id}/file`).set(asUser(uid))).status).toBe(200);
    expect(await countOf('class_a')).toBe(1);
    expect(await countOf('class_b')).toBe(1);

    await setCount('class_b', METRICS.class_b.cap);
    const served = await request(app).get(`/api/assets/${id}/file`).set(asUser(uid));
    expect(served.status).toBe(503);
    expect(served.body.error).toBe('Monthly upload limit reached');
    expect((await request(app).get('/api/modules').set(asUser(uid))).status).toBe(200);

    await setCount('class_a', METRICS.class_a.cap);
    const refused = await upload(uid);
    expect(refused.status).toBe(503);
    expect(refused.body.error).toBe('Monthly upload limit reached');
  });

  it('USE-TC5: the Unsplash proxy stops calling out at the app-wide hourly cap', async () => {
    env.UNSPLASH_ACCESS_KEY = 'test-key';
    const fetchMock = vi.fn(async () => Response.json({ results: [], total_pages: 0 }));
    vi.stubGlobal('fetch', fetchMock);
    const uid = await insertUser();
    await setCount('unsplash', METRICS.unsplash.cap - 1);
    expect((await request(app).get('/api/unsplash/search?q=cats').set(asUser(uid))).status).toBe(200);
    const blocked = await request(app).get('/api/unsplash/search?q=dogs').set(asUser(uid));
    expect(blocked.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await request(app).get('/api/unsplash/search?q=cats').set(asUser(uid))).status).toBe(200);
  });

  it('USE-TC6: UPLOADS_DISABLED refuses uploads with 503 and stores nothing', async () => {
    const uid = await insertUser();
    env.UPLOADS_DISABLED = true;
    const res = await upload(uid);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Uploads are turned off');
    expect(await countOf('class_a')).toBe(0);
  });

  it('USE-TC7: only an admin can read /api/admin/usage, and it lists each metric', async () => {
    const student = await insertUser({ email: 's@notalah.test' });
    const admin = await insertUser({ role: 'admin', email: 'ad@notalah.test' });
    expect((await request(app).get('/api/admin/usage')).status).toBe(401);
    expect((await request(app).get('/api/admin/usage').set(asUser(student))).status).toBe(403);
    await consume('class_a', 3);
    const res = await request(app).get('/api/admin/usage').set(asUser(admin));
    expect(res.status).toBe(200);
    const byMetric = Object.fromEntries(res.body.usage.map((r: { metric: string }) => [r.metric, r]));
    expect(Object.keys(byMetric).sort()).toEqual(['class_a', 'class_b', 'storage_bytes', 'unsplash']);
    expect(byMetric.class_a).toMatchObject({ used: 3, cap: 500_000 });
    expect(byMetric.unsplash.cap).toBe(25);
    expect(byMetric.storage_bytes).toMatchObject({
      used: 0,
      cap: 8_000_000_000,
      period: 'total',
    });
  });

  it('USE-TC8: an env cap can lower the safe default but never raise it', () => {
    expect(capFromEnv('X', FREE.classA, SHARE.classA, undefined)).toBe(500_000);
    expect(capFromEnv('X', FREE.classA, SHARE.classA, '5000')).toBe(5000);
    expect(capFromEnv('X', FREE.classA, SHARE.classA, '600000')).toBe(500_000);
    expect(capFromEnv('X', FREE.classA, SHARE.classA, '999999999')).toBe(500_000);
    expect(capFromEnv('X', FREE.unsplash, SHARE.unsplash, '-1')).toBe(25);
    expect(capFromEnv('X', FREE.unsplash, SHARE.unsplash, 'lots')).toBe(25);
    expect(capFromEnv('X', FREE.storageBytes, SHARE.storage, '9000000000')).toBe(8_000_000_000);
  });

  it('USE-TC9: a counter failure stops uploads and file serving with 500 but not deletes', async () => {
    const uid = await insertUser();
    const id = (await upload(uid)).body.asset.id;
    const key = (await pool.query(`SELECT ast_key FROM "ASSET_T" WHERE ast_id = $1`, [id])).rows[0].ast_key;
    await pool.query(`ALTER TABLE "USAGE_COUNTER_T" RENAME TO "USAGE_COUNTER_OFF"`);
    try {
      const files = await readdir(path.join(env.STORAGE_DIR, 'i'));
      expect((await upload(uid)).status).toBe(500);
      expect(await readdir(path.join(env.STORAGE_DIR, 'i'))).toEqual(files);
      expect((await request(app).get(`/api/assets/${id}/file`).set(asUser(uid))).status).toBe(500);
      await storage.remove(key);
      expect(await readdir(path.join(env.STORAGE_DIR, 'i'))).toHaveLength(files.length - 1);
    } finally {
      await pool.query(`ALTER TABLE "USAGE_COUNTER_OFF" RENAME TO "USAGE_COUNTER_T"`);
    }
  });
});
