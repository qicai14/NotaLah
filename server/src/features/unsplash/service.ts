import { imageSourceSchema } from '@parp/shared';
import { env } from '../../lib/env';
import { consume } from '../usage/service';

const API = 'https://api.unsplash.com';
const TIMEOUT_MS = 5000;
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;
const PER_PAGE = 20;
/** Unsplash asks for a referral link back to them on every attribution. */
const UTM = 'utm_source=notalah&utm_medium=referral';

export class UnsplashUnavailable extends Error {}
export class UnsplashNotFound extends Error {}

export interface UnsplashPhoto {
  photoId: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
  authorName: string;
  authorUrl: string;
}

export interface UnsplashPage {
  results: UnsplashPhoto[];
  totalPages: number;
}

async function call(path: string): Promise<unknown> {
  const key = env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new UnsplashUnavailable('Unsplash is not configured');
  if (!(await consume('unsplash'))) throw new UnsplashUnavailable('Unsplash search is busy. Try again later');
  let res: Response;
  try {
    res = await fetch(path.startsWith('https://') ? path : `${API}${path}`, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new UnsplashUnavailable('Unsplash is unavailable');
  }
  if (res.status === 404) throw new UnsplashNotFound('Photo not found');
  if (!res.ok) throw new UnsplashUnavailable('Unsplash is unavailable');
  return res.json().catch(() => {
    throw new UnsplashUnavailable('Unsplash is unavailable');
  });
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
type Raw = Record<string, Record<string, unknown> | string | number | undefined>;

/**
 * One API result as a photo, or null when it would not pass the deck schema: the image must be on images.unsplash.com and
 * the credit must link to unsplash.com, so whatever the editor stores is already valid (NOTE-TC34).
 */
function toPhoto(r: Raw): UnsplashPhoto | null {
  const urls = (r.urls ?? {}) as Record<string, unknown>;
  const user = (r.user ?? {}) as { name?: unknown; links?: { html?: unknown } };
  const profile = str(user.links?.html);
  const source = imageSourceSchema.safeParse({
    kind: 'unsplash',
    photoId: str(r.id),
    url: str(urls.regular),
    authorName: str(user.name),
    authorUrl: profile && `${profile}?${UTM}`,
  });
  if (!source.success || source.data.kind !== 'unsplash') return null;
  const { photoId, url, authorName, authorUrl } = source.data;
  return {
    photoId,
    url,
    thumbUrl: str(urls.small) || url,
    width: Number(r.width) || 0,
    height: Number(r.height) || 0,
    alt: str(r.alt_description) || str(r.description),
    authorName,
    authorUrl,
  };
}

const cache = new Map<string, { at: number; page: UnsplashPage }>();

/** Trimmed search results, cached for an hour (Unsplash's demo tier allows 50 requests an hour). */
export async function searchPhotos(query: string, page: number): Promise<UnsplashPage> {
  const cacheKey = `${query.toLowerCase()}|${page}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.page;
  const params = new URLSearchParams({
    query,
    page: String(page),
    per_page: String(PER_PAGE),
  });
  const body = (await call(`/search/photos?${params}`)) as {
    results?: Raw[];
    total_pages?: number;
  };
  const result: UnsplashPage = {
    results: (body.results ?? []).map(toPhoto).filter((p): p is UnsplashPhoto => p !== null),
    totalPages: Number(body.total_pages) || 0,
  };
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, { at: Date.now(), page: result });
  return result;
}

/** Tells Unsplash the photo was used, as their guidelines require. The URL comes from Unsplash's own response, never from the client. */
export async function trackDownload(photoId: string): Promise<void> {
  const photo = (await call(`/photos/${photoId}`)) as {
    links?: { download_location?: unknown };
  };
  const location = str(photo.links?.download_location);
  if (!location.startsWith(`${API}/`)) throw new UnsplashUnavailable('Unsplash is unavailable');
  await call(location);
}

export const clearUnsplashCache = () => cache.clear();
