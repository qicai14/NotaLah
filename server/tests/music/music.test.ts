import { deckSchema, jamendoStreamUrl, musicSchema } from '@notalah/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { clearMusicCache } from '../../src/features/music/service';
import { METRICS } from '../../src/features/usage/config';
import { consume } from '../../src/features/usage/service';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, insertUser, truncateAll } from '../helpers';

const flags = { key: env.JAMENDO_CLIENT_ID };
beforeEach(async () => {
  await truncateAll();
  clearMusicCache();
  env.JAMENDO_CLIENT_ID = 'test-client';
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  env.JAMENDO_CLIENT_ID = flags.key;
});
afterAll(() => pool.end());

const raw = (id: number, over: object = {}) => ({
  id: String(id),
  name: `Track ${id}`,
  artist_name: 'An Artist',
  duration: 180,
  image: `https://usercontent.jamendo.com?type=album&id=${id}&width=200`,
  license_ccurl: 'http://creativecommons.org/licenses/by-nc-sa/3.0/',
  audio: 'https://evil.example/should-not-be-used.mp3',
  ...over,
});
const reply = (results: object[], status = 'success') =>
  Response.json({ headers: { status, code: 0, results_count: results.length }, results });
const stub = (...replies: (() => Response | Promise<Response>)[]) => {
  const fn = vi.fn();
  replies.forEach((r) => fn.mockImplementationOnce(async () => r()));
  fn.mockImplementation(async () => reply([]));
  vi.stubGlobal('fetch', fn);
  return fn;
};
const calledUrl = (fn: ReturnType<typeof vi.fn>, n = 0) => new URL(String(fn.mock.calls[n][0]));
const search = (uid: number, qs: string) => request(app).get(`/api/music/search?${qs}`).set(asUser(uid));

const id = (n: number) => `abcdef01-0000-4000-8000-${String(n).padStart(12, '0')}`;
const box = { x: 100, y: 100, w: 300, h: 200, rotation: 0, opacity: 1, locked: false };
const videoEl = { id: id(1), ...box, type: 'video', assetId: 1, loop: false };
const slide = (elements: object[]) => ({ background: { kind: 'color', color: '#ffffff' }, elements, notes: '' });
const note = (over: object = {}) => ({ title: 'Deck', status: 'draft', slides: [slide([])], ...over });
const music = (trackId = 168, volume = 60) => ({ provider: 'jamendo', trackId, volume });
const post = (uid: number, body: object) => request(app).post('/api/notes').set(asUser(uid)).send(body);
const put = (uid: number, noteId: number, body: object) =>
  request(app).put(`/api/notes/${noteId}`).set(asUser(uid)).send(body);
const stored = async (noteId: number) =>
  (
    await pool.query(
      `SELECT pst_music_provider AS "provider", pst_music_track_id::INT AS "trackId", pst_music_title AS "title",
              pst_music_artist AS "artist", pst_music_cover AS "cover", pst_music_license AS "license"
       FROM "POST_T" WHERE pst_id = $1`,
      [noteId],
    )
  ).rows[0];

describe('Background music (R9)', () => {
  it('MUS-TC1: the music provider is jamendo and Deezer is no longer accepted', () => {
    expect(musicSchema.safeParse(music()).success).toBe(true);
    expect(musicSchema.safeParse({ ...music(), provider: 'deezer' }).success).toBe(false);
    expect(musicSchema.safeParse({ ...music(), trackId: 0 }).success).toBe(false);
  });

  it('MUS-TC2: a deck with a video cannot have music, in the schema and on save', async () => {
    const deck = { aspect: '4:5', theme: 'plain', slides: [slide([videoEl])], music: music() };
    const bad = deckSchema.safeParse(deck);
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]).toMatchObject({ path: ['music'], message: 'Remove videos to add music' });
    expect(deckSchema.safeParse({ ...deck, music: null }).success).toBe(true);
    expect(deckSchema.safeParse({ ...deck, slides: [slide([])] }).success).toBe(true);

    const fetchMock = stub();
    const res = await post(await insertUser(), note({ slides: [slide([videoEl])], music: music() }));
    expect(res.status).toBe(400);
    expect(res.body.errors.music).toBe('Remove videos to add music');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('MUS-TC3: search asks Jamendo for 20 instrumental tracks and maps the answer', async () => {
    const fetchMock = stub(() =>
      reply([
        raw(168, { name: 'The &quot;Best&quot; &amp; Brightest', artist_name: 'A&#39;s Band' }),
        raw(2, { license_ccurl: 'https://jamendo.com/own' }),
        raw(3, { image: 'https://jamendo.com.evil.example/x.png' }),
        raw(4, { image: 'http://usercontent.jamendo.com/x.png' }),
      ]),
    );
    const res = await search(await insertUser(), 'q=piano&instrumental=1&page=2');
    expect(res.status).toBe(200);
    const url = calledUrl(fetchMock);
    expect(url.origin + url.pathname).toBe('https://api.jamendo.com/v3.0/tracks/');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'test-client',
      format: 'json',
      search: 'piano',
      limit: '20',
      offset: '20',
      vocalinstrumental: 'instrumental',
    });
    expect(res.body.results).toEqual([
      {
        id: 168,
        title: 'The "Best" & Brightest',
        artist: "A's Band",
        cover: 'https://usercontent.jamendo.com?type=album&id=168&width=200',
        licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
        duration: 180,
        audioUrl: jamendoStreamUrl(168),
      },
    ]);
    const off = stub(() => reply([]));
    await search(await insertUser({ email: 'b@notalah.test' }), 'q=piano&instrumental=0');
    expect(calledUrl(off).searchParams.has('vocalinstrumental')).toBe(false);
  });

  it('MUS-TC4: search needs a signed-in user, a query and a configured client id', async () => {
    const fetchMock = stub();
    expect((await request(app).get('/api/music/search?q=piano')).status).toBe(401);
    const uid = await insertUser();
    expect((await search(uid, 'q=%20%20')).status).toBe(400);
    expect((await search(uid, `q=${'a'.repeat(101)}`)).status).toBe(400);
    expect((await search(uid, 'q=piano&page=0')).status).toBe(400);
    env.JAMENDO_CLIENT_ID = undefined;
    expect((await search(uid, 'q=piano')).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('MUS-TC5: at the monthly cap search answers 503 "Music search is paused" with no outbound call, cached searches still work', async () => {
    const fetchMock = stub(() => reply([raw(1)]));
    const uid = await insertUser();
    expect((await search(uid, 'q=piano')).status).toBe(200);
    expect(METRICS.jamendo.cap).toBe(28_000);
    await consume('jamendo', METRICS.jamendo.cap - 1);
    const blocked = await search(uid, 'q=guitar');
    expect(blocked.status).toBe(503);
    expect(blocked.body.error).toBe('Music search is paused');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await search(uid, 'q=piano')).status).toBe(200);
  });

  it('MUS-TC6: search is limited to 20 a minute per user', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'music');
    stub();
    const uid = await insertUser();
    for (let i = 0; i < 20; i++) expect((await search(uid, `q=word${i}`)).status).toBe(200);
    const limited = await search(uid, 'q=word20');
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('Too many searches. Try again in a minute.');
  });

  it('MUS-TC7: a Jamendo timeout, error status or failed reply is a friendly 502', async () => {
    const uid = await insertUser();
    stub(() => {
      throw new DOMException('timed out', 'TimeoutError');
    });
    const timeout = await search(uid, 'q=a');
    expect(timeout.status).toBe(502);
    expect(timeout.body.error).toBe('Music search is unavailable right now. Try again later');
    stub(() => new Response('down', { status: 500 }));
    expect((await search(uid, 'q=b')).status).toBe(502);
    stub(() => reply([], 'failed'));
    expect((await search(uid, 'q=c')).status).toBe(502);
    stub(() => new Response('<html>', { status: 200 }));
    expect((await search(uid, 'q=d')).status).toBe(502);
  });

  it('MUS-TC8: saving fills the title, artist, cover and licence, and only looks up a track once', async () => {
    const fetchMock = stub(
      () => reply([raw(168)]),
      () => reply([raw(77, { name: 'Other' })]),
    );
    const uid = await insertUser();
    const created = await post(uid, note({ music: music(168) }));
    expect(created.status).toBe(201);
    const noteId = created.body.note.id;
    expect(calledUrl(fetchMock).searchParams.get('id')).toBe('168');
    expect(created.body.note.music).toEqual({
      trackId: 168,
      title: 'Track 168',
      artist: 'An Artist',
      cover: 'https://usercontent.jamendo.com?type=album&id=168&width=200',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
      volume: 60,
    });

    const louder = await put(uid, noteId, note({ music: music(168, 90) }));
    expect(louder.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(louder.body.note.music).toMatchObject({ title: 'Track 168', volume: 90 });

    const swapped = await put(uid, noteId, note({ music: music(77) }));
    expect(swapped.body.note.music).toMatchObject({ trackId: 77, title: 'Other' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const removed = await put(uid, noteId, note({ music: null }));
    expect(removed.body.note.music).toBeNull();
    expect(await stored(noteId)).toEqual({
      provider: null,
      trackId: null,
      title: null,
      artist: null,
      cover: null,
      license: null,
    });
  });

  it('MUS-TC9: an unknown track is 400 and nothing is saved', async () => {
    const uid = await insertUser();
    stub(() => reply([]));
    const unknown = await post(uid, note({ music: music(999999) }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.errors.music).toBe('Unknown music track');
    expect((await pool.query(`SELECT 1 FROM "POST_T"`)).rowCount).toBe(0);
  });

  it('MUS-TC14: a user has 300 Jamendo calls a day, searches and save lookups together', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'musicday');
    const fetchMock = stub(() => reply([raw(1)]));
    const uid = await insertUser();
    expect((await search(uid, 'q=piano')).status).toBe(200);
    await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_hits = 299 WHERE rlt_key = $1`, [`musicday:user:${uid}`]);
    expect((await search(uid, 'q=guitar')).status).toBe(200);
    const limited = await search(uid, 'q=drums');
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('Daily music search limit reached. Try again tomorrow.');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const saved = await post(uid, note({ music: music(555) }));
    expect(saved.status).toBe(201);
    expect(saved.body.note.music).toMatchObject({ trackId: 555, title: null, licenseUrl: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const other = await insertUser({ email: 'o@notalah.test' });
    expect((await search(other, 'q=drums')).status).toBe(200);
  });

  it('MUS-TC15: Jamendo down or the cap reached still saves the track with no details, a vanished stored track is dropped, and a later save fills them', async () => {
    const uid = await insertUser();
    stub(() => new Response('down', { status: 503 }));
    const down = await post(uid, note({ music: music(168) }));
    expect(down.status).toBe(201);
    expect(down.body.note.music).toMatchObject({ trackId: 168, title: null, volume: 60 });
    const noteId = down.body.note.id;

    await pool.query(`DELETE FROM "USAGE_COUNTER_T"`);
    await consume('jamendo', METRICS.jamendo.cap);
    const atCap = stub();
    const capped = await put(uid, noteId, note({ music: music(168, 70) }));
    expect(capped.status).toBe(200);
    expect(capped.body.note.music).toMatchObject({ trackId: 168, title: null, volume: 70 });
    expect(atCap).not.toHaveBeenCalled();

    await pool.query(`DELETE FROM "USAGE_COUNTER_T"`);
    stub(() => reply([]));
    const empty = await put(uid, noteId, note({ music: music(168, 70) }));
    expect(empty.status).toBe(200);
    expect(empty.body.note.music).toBeNull();

    await pool.query(`DELETE FROM "USAGE_COUNTER_T"`);
    stub(() => reply([raw(168)]));
    const later = await put(uid, noteId, note({ music: music(168, 70) }));
    expect(later.body.note.music).toMatchObject({ title: 'Track 168', volume: 70 });

    await pool.query(`DELETE FROM "USAGE_COUNTER_T"`);
    await consume('jamendo', METRICS.jamendo.cap);
    const swapped = await put(uid, noteId, note({ music: music(77) }));
    expect(swapped.status).toBe(200);
    expect(swapped.body.note.music).toMatchObject({ trackId: 77, title: null, licenseUrl: null });
  });

  it('MUS-TC16: a track found by search is saved without a second Jamendo call', async () => {
    const fetchMock = stub(() => reply([raw(168)]));
    const uid = await insertUser();
    await search(uid, 'q=piano');
    const res = await post(uid, note({ music: music(168) }));
    expect(res.status).toBe(201);
    expect(res.body.note.music).toMatchObject({ trackId: 168, title: 'Track 168' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
