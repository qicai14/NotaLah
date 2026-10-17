import type { Request, Response } from 'express';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import { UsageLimitError } from '../usage/service';
import { takeUnlinkedAssets, type StoredFile } from './repository';

/** Deletes assets that no live note references after a day (R21 spec 2.4); returns how many were removed. */
export async function purgeUnlinkedAssets(): Promise<number> {
  const keys = await takeUnlinkedAssets();
  for (const key of keys) {
    await storage.remove(key).catch((err: unknown) => logger.error({ err, key }, 'asset file removal failed'));
  }
  return keys.length;
}

/** A single `bytes=` range against a file of `size` bytes, or null when it is absent, malformed or multi-range (served whole). 'unsatisfiable' maps to 416. */
export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    start = Math.max(size - Number(m[2]), 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start >= size || start > end ? 'unsatisfiable' : { start, end };
}

/**
 * Sends an asset's file, or a video's poster with `?poster=1`, answering a `Range` header with 206 (R29). Every call
 * is one Class B read in `metered`, however small the range, so past the cap nothing is served. shortcut: the whole
 * object is read and sliced, which is fine at 50 MB and the local driver; give Storage a ranged read before moving
 * big videos to R2. Readability depends on who asks, so shared caches must not keep it; the viewer's browser may for a few minutes.
 */
export async function sendAsset(req: Request, res: Response, asset: StoredFile): Promise<void> {
  const poster = req.query.poster === '1' && asset.posterKey !== null;
  let body: Buffer | null;
  try {
    body = await storage.read(poster ? asset.posterKey! : asset.key);
  } catch (err) {
    if (err instanceof UsageLimitError) return void res.status(503).json({ error: err.message });
    throw err;
  }
  if (!body) return void res.status(404).json({ error: 'Asset not found' });
  res.set({
    'Content-Type': poster ? 'image/webp' : asset.mime,
    'Cache-Control': 'private, max-age=300',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Accept-Ranges': 'bytes',
  });
  const range = parseRange(req.headers.range, body.length);
  if (range === 'unsatisfiable') return void res.status(416).set('Content-Range', `bytes */${body.length}`).end();
  if (!range) return void res.send(body);
  res
    .status(206)
    .set('Content-Range', `bytes ${range.start}-${range.end}/${body.length}`)
    .send(body.subarray(range.start, range.end + 1));
}
