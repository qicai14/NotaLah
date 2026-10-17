import type { Response } from 'express';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import { consume } from '../usage/service';
import { takeUnlinkedAssets } from './repository';

/** Deletes assets that no live note references after a day (R21 spec 2.4); returns how many were removed. */
export async function purgeUnlinkedAssets(): Promise<number> {
  const keys = await takeUnlinkedAssets();
  for (const key of keys) {
    await storage.remove(key).catch((err: unknown) => logger.error({ err, key }, 'asset file removal failed'));
  }
  return keys.length;
}

/** Sends an asset's file, or redirects to the driver's signed URL. Each call counts one Class B read (R34, D57); a signed URL or a streamed file costs at most one, so counting here overcounts, never undercounts. Past the cap nothing is served. Readability depends on who asks, so shared caches must not keep it; the viewer's browser may for a few minutes. */
export async function sendAsset(res: Response, asset: { key: string; mime: string }): Promise<void> {
  if (!(await consume('class_b'))) return void res.status(503).json({ error: 'Monthly image limit reached' });
  const url = await storage.signedUrl(asset.key);
  if (url) return void res.redirect(302, url);
  const body = await storage.read(asset.key);
  if (!body) return void res.status(404).json({ error: 'Asset not found' });
  res
    .set({
      'Content-Type': asset.mime,
      'Cache-Control': 'private, max-age=300',
      'Cross-Origin-Resource-Policy': 'same-site',
    })
    .send(body);
}
