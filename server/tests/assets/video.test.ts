import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app';
import { VIDEO } from '../../src/features/assets/config';
import { processVideo, runTool } from '../../src/features/assets/video';
import { env } from '../../src/lib/env';
import { parseRange, storage } from '../../src/lib/storage';
import { pool } from '../../src/lib/pool';
import { asUser, insertUser, truncateAll } from '../helpers';

let dir: string;
const file = (name: string) => path.join(dir, name);
const ffmpeg = (...args: string[]) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args]);
const src = (size: string, rate: number) => ['-f', 'lavfi', '-i', `testsrc=size=${size}:rate=${rate}`];
const tone = ['-f', 'lavfi', '-i', 'sine=frequency=440'];
const secret = ['-metadata', 'title=SECRETTITLE', '-metadata', 'comment=SECRETCOMMENT'];
const h264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p'];

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'parp-fixtures-'));
  ffmpeg(...src('160x120', 10), ...tone, '-t', '2', ...h264, '-c:a', 'aac', ...secret, file('short.mp4'));
  ffmpeg(
    ...src('160x120', 10),
    ...tone,
    '-t',
    '2',
    '-c:v',
    'libvpx-vp9',
    '-c:a',
    'libopus',
    ...secret,
    file('short.webm'),
  );
  ffmpeg(...src('16x16', 1), '-t', '91', ...h264, file('long.mp4'));
  ffmpeg(...src('2000x1100', 2), '-t', '1', ...h264, file('big.mp4'));
  ffmpeg(...src('1920x1080', 1), '-t', '1', ...h264, file('landscape.mp4'));
  ffmpeg('-display_rotation', '90', '-i', file('landscape.mp4'), '-c', 'copy', file('portrait.mp4'));
  ffmpeg(...src('4100x64', 1), '-t', '1', ...h264, file('wide.mp4'));
  ffmpeg(...src('160x120', 10), '-t', '1', '-c:v', 'mpeg4', file('legacy.avi'));
});
beforeEach(truncateAll);
afterAll(async () => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(env.STORAGE_DIR, { recursive: true, force: true });
  await pool.end();
});

const upload = (uid: number, body: Buffer, filename = 'clip.mp4', contentType = 'video/mp4') =>
  request(app).post('/api/assets/videos').set(asUser(uid)).attach('file', body, { filename, contentType });
const tmpDirs = () => readdirSync(os.tmpdir()).filter((n) => n.startsWith(VIDEO.tmpPrefix));
const ready = async (uid: number, name: string) => {
  const res = await upload(uid, readFileSync(file(name)), name);
  expect(res.status).toBe(201);
  return res.body.asset as { id: number; url: string; kind: string; width: number; height: number };
};
const bytesOf = (uid: number, url: string) =>
  request(app)
    .get(url)
    .set(asUser(uid))
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });

describe('Video upload (R29)', () => {
  it('NOTE-TC39: refuses 91 s, non-video, AVI and absurd dimensions; accepts short MP4 and WebM with a poster', async () => {
    const uid = await insertUser();
    const long = await upload(uid, readFileSync(file('long.mp4')));
    expect(long.status).toBe(400);
    expect(long.body.error).toMatch(/90 seconds/);
    expect((await upload(uid, Buffer.from('not a video at all'))).status).toBe(400);
    expect((await upload(uid, readFileSync(file('legacy.avi')), 'clip.mp4')).status).toBe(400);
    expect((await upload(uid, readFileSync(file('wide.mp4')))).body.error).toMatch(/too large/);

    for (const [name, mime] of [
      ['short.mp4', 'video/mp4'],
      ['short.webm', 'video/webm'],
    ]) {
      const asset = await ready(uid, name);
      expect(asset.kind).toBe('video');
      const { rows } = await pool.query(
        `SELECT ast_status, ast_mime, ast_poster_key, ast_duration_ms FROM "ASSET_T" WHERE ast_id = $1`,
        [asset.id],
      );
      expect(rows[0]).toMatchObject({ ast_status: 'ready', ast_mime: mime });
      expect(rows[0].ast_poster_key).toMatch(/^p\//);
      expect(rows[0].ast_duration_ms).toBeGreaterThan(1500);
      const poster = await request(app).get(`${asset.url}?poster=1`).set(asUser(uid));
      expect(poster.status).toBe(200);
      expect(poster.headers['content-type']).toBe('image/webp');
    }
  });

  it('NOTE-TC68: a playlist that points at an http segment is refused without a network call', async () => {
    const hits: string[] = [];
    const server = createServer((req, res) => {
      hits.push(req.url ?? '');
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    const playlist = `#EXTM3U
#EXT-X-TARGETDURATION:1
#EXTINF:1,
http://127.0.0.1:${port}/seg.ts
#EXT-X-ENDLIST
`;
    const res = await upload(await insertUser(), Buffer.from(playlist), 'clip.mp4');
    server.close();
    expect(res.status).toBe(400);
    expect(hits).toEqual([]);
  });

  it('NOTE-TC69: refuses before reading the body when uploads are disabled', async () => {
    env.UPLOADS_DISABLED = true;
    try {
      const res = await upload(await insertUser(), readFileSync(file('short.mp4')));
      expect(res.status).toBe(503);
      expect(tmpDirs()).toEqual([]);
    } finally {
      env.UPLOADS_DISABLED = false;
    }
  });

  it('NOTE-TC71: refuses a body over 50 MB with 413', async () => {
    const res = await upload(await insertUser(), Buffer.alloc(VIDEO.maxBytes + 1024));
    expect(res.status).toBe(413);
  });

  it('NOTE-TC70: scales a video above 1080p down to fit', async () => {
    const asset = await ready(await insertUser(), 'big.mp4');
    expect(asset.width).toBeLessThanOrEqual(VIDEO.maxWidth);
    expect(asset.height).toBeLessThanOrEqual(VIDEO.maxHeight);
  });

  it('NOTE-TC70: a rotated 1920x1080 clip is stored as the 1080x1920 portrait it displays as', async () => {
    const asset = await ready(await insertUser(), 'portrait.mp4');
    expect([asset.width, asset.height]).toEqual([1080, 1920]);
  });

  it('NOTE-TC72: strips metadata from both containers', async () => {
    const uid = await insertUser();
    for (const name of ['short.mp4', 'short.webm']) {
      const asset = await ready(uid, name);
      const bytes = (await bytesOf(uid, asset.url)).body as Buffer;
      expect(bytes.includes('SECRET')).toBe(false);
      const out = file(`out-${name}`);
      writeFileSync(out, bytes);
      const probed = JSON.parse(
        execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', out]).toString(),
      );
      expect(JSON.stringify(probed.format.tags ?? {})).not.toMatch(/SECRET|title|comment/i);
    }
  });

  it('NOTE-TC73: serves byte ranges with 206 and refuses an unsatisfiable one with 416', async () => {
    const uid = await insertUser();
    const asset = await ready(uid, 'short.mp4');
    const size = ((await bytesOf(uid, asset.url)).body as Buffer).length;
    const get = (range: string) => request(app).get(asset.url).set(asUser(uid)).set('Range', range);

    const whole = await request(app).get(asset.url).set(asUser(uid));
    expect(whole.headers['accept-ranges']).toBe('bytes');

    const part = await get('bytes=0-99');
    expect(part.status).toBe(206);
    expect(part.headers['content-range']).toBe(`bytes 0-99/${size}`);
    expect(part.headers['content-length']).toBe('100');

    const tail = await get('bytes=-50');
    expect(tail.status).toBe(206);
    expect(tail.headers['content-range']).toBe(`bytes ${size - 50}-${size - 1}/${size}`);

    const past = await get(`bytes=${size}-`);
    expect(past.status).toBe(416);
    expect(past.headers['content-range']).toBe(`bytes */${size}`);
    expect(parseRange('bytes=0-1,5-6', size)).toBeNull();
  });

  it('NOTE-TC74: removes its temp directory after success, rejection and an oversized body', async () => {
    const uid = await insertUser();
    await upload(uid, readFileSync(file('short.mp4')));
    await upload(uid, Buffer.from('garbage'));
    await upload(uid, Buffer.alloc(VIDEO.maxBytes + 1024));
    await new Promise((r) => setTimeout(r, 300));
    expect(tmpDirs()).toEqual([]);
  });

  it('NOTE-TC75: kills ffmpeg that runs past the timeout and reports it', async () => {
    const started = Date.now();
    const endless = [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=1920x1080:rate=60',
      '-t',
      '3000',
      '-f',
      'null',
      '-',
    ];
    await expect(runTool('ffmpeg', endless, 400)).rejects.toThrow(/too long/);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(await processVideo(file('short.mp4'), dir, 1)).toEqual({
      ok: false,
      error: 'Video processing took too long',
    });
  });

  it('NOTE-TC76: a ready video can be used in a note', async () => {
    const uid = await insertUser();
    const asset = await ready(uid, 'short.webm');
    const element = {
      id: 'abcdef01-0000-4000-8000-000000000001',
      x: 0,
      y: 0,
      w: 300,
      h: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      type: 'video',
      assetId: asset.id,
      loop: false,
    };
    const res = await request(app)
      .post('/api/notes')
      .set(asUser(uid))
      .send({
        title: 'Deck',
        status: 'draft',
        slides: [{ background: { kind: 'color', color: '#ffffff' }, elements: [element], notes: '' }],
      });
    expect(res.status).toBe(201);
  });

  it('NOTE-TC77: a poster follows the video access rules: stranger 404, view link 200', async () => {
    const owner = await insertUser();
    const asset = await ready(owner, 'short.mp4');
    const element = {
      id: 'abcdef01-0000-4000-8000-000000000001',
      x: 0,
      y: 0,
      w: 300,
      h: 200,
      rotation: 0,
      opacity: 1,
      locked: false,
      type: 'video',
      assetId: asset.id,
      loop: false,
    };
    const note = await request(app)
      .post('/api/notes')
      .set(asUser(owner))
      .send({
        title: 'Deck',
        status: 'draft',
        slides: [{ background: { kind: 'color', color: '#ffffff' }, elements: [element], notes: '' }],
      });
    const link = await request(app)
      .post(`/api/notes/${note.body.note.id}/links`)
      .set(asUser(owner))
      .send({ role: 'view' });
    const poster = `?poster=1`;
    expect(
      (
        await request(app)
          .get(asset.url + poster)
          .set(asUser(await insertUser()))
      ).status,
    ).toBe(404);
    const shared = await request(app).get(`/api/share/${link.body.token}/assets/${asset.id}${poster}`);
    expect(shared.status).toBe(200);
    expect(shared.headers['content-type']).toBe('image/webp');
  });
});

it('STO-TC15: a video put that fails removes the key it may have written', async () => {
  const uid = await insertUser();
  const put = vi.spyOn(storage, 'put').mockRejectedValueOnce(new Error('timed out'));
  const remove = vi.spyOn(storage, 'remove');
  const res = await upload(uid, readFileSync(file('short.mp4')));
  expect(res.status).toBe(500);
  expect(remove).toHaveBeenCalledWith(put.mock.calls[0]![0]);
  expect(put.mock.calls[0]![0]).toMatch(/^v\//);
  put.mockRestore();
  remove.mockRestore();
});
