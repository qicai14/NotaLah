import type { Options } from 'express-rate-limit';
import { createLimiter, PgStore, userKey } from '../auth/rateLimit';
import { MUSIC } from './config';

export const musicLimiter = createLimiter({
  name: 'music',
  windowMs: 60_000,
  limit: MUSIC.searchesPerMinute,
  keyGenerator: userKey,
  message: 'Too many searches. Try again in a minute.',
});

const DAY_MS = 24 * 60 * 60_000;

export const musicDailyLimiter = createLimiter({
  name: 'musicday',
  windowMs: DAY_MS,
  limit: MUSIC.callsPerUserPerDay,
  keyGenerator: userKey,
  message: 'Daily music search limit reached. Try again tomorrow.',
});

const dayStore = new PgStore('musicday:');
dayStore.init({ windowMs: DAY_MS } as Options);

/** Counts one save-time Jamendo lookup against the same per-user daily budget as searches; false once it is spent. */
export async function takeDailyCall(userId: number): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_UNDER_TEST !== 'musicday') return true;
  return (await dayStore.increment(`user:${userId}`)).totalHits <= MUSIC.callsPerUserPerDay;
}
