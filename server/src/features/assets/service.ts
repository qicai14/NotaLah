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
