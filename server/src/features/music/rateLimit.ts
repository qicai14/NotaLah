import { createLimiter, userKey } from '../auth/rateLimit';
import { MUSIC } from './config';

export const musicLimiter = createLimiter({
  name: 'music',
  windowMs: 60_000,
  limit: MUSIC.searchesPerMinute,
  keyGenerator: userKey,
  message: 'Too many searches. Try again in a minute.',
});
