import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import { UsageLimitError } from '../usage/service';
import { takeUnlinkedAssets, type StoredFile } from './repository';

/**
 * Deletes assets that no live note references after a day (R21 spec 2.4). Rows are marked deleted before their files go,
 * so a note cannot link an asset whose file is being removed; a file that fails to go is logged as orphaned (R37).
 */
export async function purgeUnlinkedAssets(): Promise<{ assets: number; orphanedFiles: number }> {
  const assets = await takeUnlinkedAssets();
  const orphaned: string[] = [];
  for (const key of assets.flatMap((a) => (a.posterKey ? [a.key, a.posterKey] : [a.key]))) {
    await storage.remove(key).catch((err: unknown) => {
      orphaned.push(key);
      logger.error({ err, key }, 'asset file removal failed');
    });
  }
  if (orphaned.length > 0)
    logger.error({ keys: orphaned }, 'purge left orphaned asset files; remove them from storage');
  return { assets: assets.length, orphanedFiles: orphaned.length };
}

/**
 * Sends an asset's file, or a video's poster with `?poster=1`, answering a `Range` header with 206 (R29). The file is
 * streamed from storage, never held whole. Every call is one Class B read in `metered`, however small the range, so past
 * the cap nothing is served. Readability depends on who asks, so shared caches must not keep it; the viewer's browser may for a few minutes.
 */
export async function sendAsset(req: Request, res: Response, asset: StoredFile): Promise<void> {
  // A video has no file until the worker finishes (R40): 409 while it may still come, 404 once it never will.
  if (asset.status === 'processing') {
    return void res.status(409).json({ error: 'Video is still processing', status: asset.status });
  }
  if (asset.status === 'failed') {
    return void res.status(404).json({ error: 'Video could not be processed', status: asset.status });
  }
  const poster = req.query.poster === '1' && asset.posterKey !== null;
  let found;
  try {
    found = await storage.read(poster ? asset.posterKey! : asset.key, req.headers.range);
  } catch (err) {
    if (err instanceof UsageLimitError) return void res.status(503).json({ error: err.message });
    throw err;
  }
  if (!found) return void res.status(404).json({ error: 'Asset not found' });
  if ('unsatisfiable' in found)
    return void res.status(416).set('Content-Range', `bytes */${found.unsatisfiable}`).end();
  res.set({
    'Content-Type': poster ? 'image/webp' : asset.mime,
    'Content-Length': String(found.end - found.start + 1),
    'Cache-Control': 'private, max-age=300',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Accept-Ranges': 'bytes',
  });
  if (found.partial) res.status(206).set('Content-Range', `bytes ${found.start}-${found.end}/${found.size}`);
  await pipeline(found.stream, res).catch(() => undefined);
}
