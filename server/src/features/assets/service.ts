import type { Response } from 'express';
import { logger } from '../../lib/logger';
import { storage } from '../../lib/storage';
import { takeUnlinkedAssets } from './repository';

/** Deletes assets that no live note references after a day (R21 spec 2.4); returns how many were removed. */
export async function purgeUnlinkedAssets(): Promise<number> {
  const keys = await takeUnlinkedAssets();
  for (const key of keys) {
    await storage.remove(key).catch((err: unknown) => logger.error({ err, key }, 'asset file removal failed'));
  }
  return keys.length;
}

/** Sends an asset's file, or redirects to the driver's signed URL. Readability depends on who asks, so shared caches must not keep it; the viewer's browser may for a few minutes. */
export async function sendAsset(res: Response, asset: { key: string; mime: string }): Promise<void> {
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
