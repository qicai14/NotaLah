import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { VIDEO, videoProfile } from '../../src/features/assets/config';
import { claimVideoJob } from '../../src/features/assets/repository';
import { planEncode } from '../../src/features/assets/video';
import { runNextVideoJob, startVideoWorker } from '../../src/features/assets/worker';
import { env, parseEnv } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { storage } from '../../src/lib/storage';
import { asUser, insertUser, truncateAll } from '../helpers';

let dir: string;
let clip: Buffer;
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'notalah-fixtures-'));
  const out = path.join(dir, 'short.mp4');
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'testsrc=size=160x120:rate=10',
    '-t',
    '1',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    out,
  ]);
  clip = readFileSync(out);
});
beforeEach(truncateAll);
afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(env.STORAGE_DIR, { recursive: true, force: true });
  await pool.end();
});

const upload = (uid: number) =>
  request(app)
    .post('/api/assets/videos')
    .set(asUser(uid))
    .attach('file', clip, { filename: 'clip.mp4', contentType: 'video/mp4' });
const job = async (assetId: number) =>
  (
    await pool.query(
      `SELECT vjb_status AS "status", vjb_attempts AS "attempts", vjb_last_error AS "error",
              vjb_locked_until > NOW() AS "leased"
       FROM "VIDEO_JOB_T" WHERE vjb_ast_id = $1`,
      [assetId],
    )
  ).rows[0];
/** Lets a job's lease or retry delay lapse at once. */
const lapse = () => pool.query(`UPDATE "VIDEO_JOB_T" SET vjb_locked_until = NOW() - INTERVAL '1 second'`);
const videoEl = (assetId: number) => ({
  id: 'abcdef01-0000-4000-8000-000000000001',
  x: 0,
  y: 0,
  w: 300,
  h: 200,
  rotation: 0,
  opacity: 1,
  locked: false,
  type: 'video',
  assetId,
  loop: false,
});

describe('Async video pipeline (R40)', () => {
  it('VID-TC1: an upload answers 202 processing with a queued job, before any encoding', async () => {
    const uid = await insertUser();
    const res = await upload(uid);
    expect(res.status).toBe(202);
    expect(res.body.asset).toMatchObject({ kind: 'video', status: 'processing' });
    expect(await job(res.body.asset.id)).toMatchObject({ status: 'queued', attempts: 0 });
    const { rows } = await pool.query(`SELECT ast_key, ast_bytes FROM "ASSET_T" WHERE ast_id = $1`, [
      res.body.asset.id,
    ]);
    expect(rows[0].ast_key).toMatch(/^o\//);
    expect(rows[0].ast_bytes).toBe(clip.length);
  });

  it('VID-TC2: a processing or failed video answers with its status; the note carries it', async () => {
    const uid = await insertUser();
    const { id, url } = (await upload(uid)).body.asset;
    const processing = await request(app).get(url).set(asUser(uid));
    expect(processing.status).toBe(409);
    expect(processing.body.status).toBe('processing');

    const note = await request(app)
      .post('/api/notes')
      .set(asUser(uid))
      .send({
        title: 'Deck',
        status: 'draft',
        slides: [{ background: { kind: 'color', color: '#ffffff' }, elements: [videoEl(id)], notes: '' }],
      });
    expect(note.status).toBe(201);
    const noteId = note.body.note.id;
    const read = async () => (await request(app).get(`/api/notes/${noteId}`).set(asUser(uid))).body.note;
    expect((await read()).videoStatus).toEqual({ [id]: 'processing' });
    expect((await read()).assets).toEqual({});

    await pool.query(`UPDATE "ASSET_T" SET ast_status = 'failed' WHERE ast_id = $1`, [id]);
    const failed = await request(app).get(url).set(asUser(uid));
    expect(failed.status).toBe(404);
    expect(failed.body.status).toBe('failed');
    expect((await read()).videoStatus).toEqual({ [id]: 'failed' });
    expect((await request(app).get(`/api/assets/${id}`).set(asUser(uid))).body.asset.status).toBe('failed');
  });

  it('VID-TC3: two workers claiming at once never take the same job', async () => {
    const uid = await insertUser();
    await upload(uid);
    const claims = await Promise.all([claimVideoJob(VIDEO.leaseMs), claimVideoJob(VIDEO.leaseMs)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('VID-TC4: a job whose lease lapsed (its worker died) is claimed again', async () => {
    const uid = await insertUser();
    const { id } = (await upload(uid)).body.asset;
    const first = await claimVideoJob(VIDEO.leaseMs);
    expect(first?.attempts).toBe(1);
    expect(await claimVideoJob(VIDEO.leaseMs)).toBeUndefined();
    await lapse();
    const again = await claimVideoJob(VIDEO.leaseMs);
    expect(again).toMatchObject({ id: first!.id, attempts: 2 });
    expect(await job(id)).toMatchObject({ status: 'running', leased: true });
  });

  it('VID-TC5: an unexpected error is retried after a delay, then the video is marked failed', async () => {
    const uid = await insertUser();
    const { id } = (await upload(uid)).body.asset;
    const read = vi.spyOn(storage, 'read').mockRejectedValue(new Error('storage down'));
    try {
      for (let attempt = 1; attempt < VIDEO.maxAttempts; attempt++) {
        expect(await runNextVideoJob()).toBe(true);
        expect(await job(id)).toMatchObject({
          status: 'queued',
          attempts: attempt,
          error: 'storage down',
          leased: true,
        });
        expect(await runNextVideoJob()).toBe(false);
        await lapse();
      }
      expect(await runNextVideoJob()).toBe(true);
    } finally {
      read.mockRestore();
    }
    expect(await job(id)).toMatchObject({ status: 'failed', attempts: VIDEO.maxAttempts });
    const asset = (await request(app).get(`/api/assets/${id}`).set(asUser(uid))).body.asset;
    expect(asset).toMatchObject({ status: 'failed', error: 'Video processing failed. Try uploading it again' });
  });

  it('VID-TC6: a fitting H.264 MP4 is stream-copied; anything else is re-encoded into the profile box', () => {
    const free = videoProfile({ profile: 'free', concurrency: 2 });
    const h264 = { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', width: 1280, height: 720 };
    const aac = { codec_type: 'audio', codec_name: 'aac' };
    const base = { video: h264, audio: aac, isMp4: true, w: 1280, h: 720 };
    expect(planEncode(base, free)).toEqual({ copyVideo: true, copyAudio: true, box: [1280, 720] });
    expect(planEncode({ ...base, audio: undefined }, free).copyAudio).toBe(true);
    expect(planEncode({ ...base, w: 1920, h: 1080 }, free).copyVideo).toBe(false);
    expect(planEncode({ ...base, w: 720, h: 1280 }, free)).toMatchObject({ copyVideo: true, box: [720, 1280] });
    expect(planEncode({ ...base, isMp4: false }, free).copyVideo).toBe(false);
    expect(planEncode({ ...base, video: { ...h264, codec_name: 'hevc' } }, free).copyVideo).toBe(false);
    expect(planEncode({ ...base, video: { ...h264, pix_fmt: 'yuv444p' } }, free).copyVideo).toBe(false);
    expect(planEncode({ ...base, audio: { codec_type: 'audio', codec_name: 'opus' } }, free).copyAudio).toBe(false);
    const standard = videoProfile({ profile: 'standard', concurrency: 2 });
    expect(planEncode({ ...base, w: 1920, h: 1080 }, standard)).toMatchObject({ copyVideo: true, box: [1920, 1080] });
  });

  it('VID-TC7: VIDEO_PROFILE and VIDEO_CONCURRENCY parse into a profile', () => {
    const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(16) };
    const fromEnv = (extra: Record<string, string>) => {
      const e = parseEnv({ ...base, ...extra });
      return videoProfile({ profile: e.VIDEO_PROFILE, concurrency: e.VIDEO_CONCURRENCY });
    };
    expect(fromEnv({})).toEqual({ name: 'free', maxWidth: 1280, maxHeight: 720, concurrency: 1 });
    expect(fromEnv({ VIDEO_CONCURRENCY: '4' }).concurrency).toBe(1);
    expect(fromEnv({ VIDEO_PROFILE: 'standard' })).toEqual({
      name: 'standard',
      maxWidth: 1920,
      maxHeight: 1080,
      concurrency: 2,
    });
    expect(fromEnv({ VIDEO_PROFILE: 'standard', VIDEO_CONCURRENCY: '3' }).concurrency).toBe(3);
    expect(() => parseEnv({ ...base, VIDEO_PROFILE: 'huge' })).toThrow(/VIDEO_PROFILE/);
    expect(() => parseEnv({ ...base, VIDEO_CONCURRENCY: '0' })).toThrow(/VIDEO_CONCURRENCY/);
    expect(parseEnv(base).VIDEO_WORKER_IN_PROCESS).toBe(true);
    expect(parseEnv({ ...base, VIDEO_WORKER_IN_PROCESS: 'false' }).VIDEO_WORKER_IN_PROCESS).toBe(false);
  });

  it('VID-TC8: the limits route states the active profile', async () => {
    const res = await request(app)
      .get('/api/assets/videos/limits')
      .set(asUser(await insertUser()));
    expect(res.body.limits).toEqual({ profile: 'free', maxSeconds: 90, maxBytes: VIDEO.maxBytes, maxHeight: 720 });
  });

  it('VID-TC9: the worker loop picks up an upload, stores the result and removes the original', async () => {
    const uid = await insertUser();
    const worker = startVideoWorker();
    try {
      const { id, url } = (await upload(uid)).body.asset;
      const { rows } = await pool.query(`SELECT ast_key FROM "ASSET_T" WHERE ast_id = $1`, [id]);
      for (let i = 0; i < 100 && (await job(id)).status !== 'done'; i++) await new Promise((r) => setTimeout(r, 100));
      expect(await job(id)).toMatchObject({ status: 'done', attempts: 1 });
      expect((await request(app).get(url).set(asUser(uid))).status).toBe(200);
      expect(await storage.read(rows[0].ast_key)).toBeNull();
    } finally {
      await worker.stop();
    }
  });
});
