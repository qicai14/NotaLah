import { jamendoStreamUrl } from '@notalah/shared';
import { env } from '../../lib/env';
import { consume } from '../usage/service';
import { MUSIC } from './config';
import { takeDailyCall } from './rateLimit';

const API = 'https://api.jamendo.com/v3.0/tracks/';

/** 503 when music is off or the monthly cap is reached; 502 when Jamendo timed out or failed. */
export class MusicUnavailable extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503,
  ) {
    super(message);
  }
}

export interface TrackMeta {
  title: string;
  artist: string;
  cover: string;
  licenseUrl: string;
}

export interface Track extends TrackMeta {
  id: number;
  duration: number;
  /** Derived from the id here, never read from Jamendo's reply or the request. */
  audioUrl: string;
}

const DOWN = 'Music search is unavailable right now. Try again later';

async function call(params: Record<string, string>): Promise<unknown[]> {
  const clientId = env.JAMENDO_CLIENT_ID;
  if (!clientId) throw new MusicUnavailable('Music search is not configured', 503);
  if (!(await consume('jamendo'))) throw new MusicUnavailable('Music search is paused', 503);
  const query = new URLSearchParams({ client_id: clientId, format: 'json', imagesize: '200', ...params });
  let body: { headers?: { status?: unknown }; results?: unknown };
  try {
    const res = await fetch(`${API}?${query}`, { signal: AbortSignal.timeout(MUSIC.timeoutMs) });
    if (!res.ok) throw new Error(String(res.status));
    body = await res.json();
  } catch {
    throw new MusicUnavailable(DOWN, 502);
  }
  if (body.headers?.status !== 'success' || !Array.isArray(body.results)) throw new MusicUnavailable(DOWN, 502);
  return body.results;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
/** Jamendo sends titles with HTML entities (`&quot;`); React escapes text itself, so they are decoded once, here. */
const decode = (v: unknown) =>
  str(v).replace(/&(?:#(\d{1,6})|#x([\da-f]{1,5})|([a-z]+));/gi, (m, dec, hex, name) =>
    dec || hex ? String.fromCodePoint(Number(dec ?? `0x${hex}`)) : (ENTITIES[name.toLowerCase()] ?? m),
  );
const jamendoHost = (url: string) => /^https:\/\/([a-z0-9-]+\.)*jamendo\.com(\/|\?|$)/.test(url);

/** One API result as a track, or null when its id, cover or licence cannot be trusted (the licence must be a Creative Commons page). */
function toTrack(r: unknown): Track | null {
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
  const id = Number(o.id);
  const license = str(o.license_ccurl).replace(/^http:/, 'https:');
  const cover = str(o.image) || str(o.album_image);
  if (!Number.isSafeInteger(id) || id < 1 || !license.startsWith('https://creativecommons.org/')) return null;
  if (license.length > 200 || cover.length > 500 || !jamendoHost(cover)) return null;
  return {
    id,
    title: decode(o.name).slice(0, 200),
    artist: decode(o.artist_name).slice(0, 200),
    cover,
    licenseUrl: license,
    duration: Number(o.duration) || 0,
    audioUrl: jamendoStreamUrl(id),
  };
}

const cache = new Map<string, { at: number; results: Track[] }>();
const byId = new Map<number, Track>();

/** Tracks matching `q`, instrumental only when asked, cached for ten minutes. */
export async function searchTracks(q: string, instrumental: boolean, page: number): Promise<{ results: Track[] }> {
  const key = `${q.toLowerCase()}|${instrumental}|${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < MUSIC.cacheMs) return { results: hit.results };
  const raw = await call({
    search: q,
    limit: String(MUSIC.perPage),
    offset: String((page - 1) * MUSIC.perPage),
    ...(instrumental && { vocalinstrumental: 'instrumental' }),
  });
  const results = raw.map(toTrack).filter((t): t is Track => t !== null);
  for (const t of results) {
    if (byId.size >= MUSIC.trackMemory) byId.delete(byId.keys().next().value as number);
    byId.set(t.id, t);
  }
  if (results.length === 0) return { results }; // an empty answer may be a hiccup, so it is not remembered
  if (cache.size >= MUSIC.cacheMax) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), results });
  return { results };
}

/** Looks one track up by id for the save path, from a recent search when possible; null when Jamendo has no such track. */
export async function lookupTrack(id: number, userId: number): Promise<Track | null> {
  const known = byId.get(id);
  if (known) return known;
  if (!(await takeDailyCall(userId))) throw new MusicUnavailable('Music search is paused', 503);
  const [raw] = await call({ id: String(id), limit: '1' });
  return toTrack(raw);
}

export const clearMusicCache = () => {
  cache.clear();
  byId.clear();
};
