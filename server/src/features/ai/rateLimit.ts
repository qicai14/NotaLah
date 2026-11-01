import { createLimiter, userKey } from '../auth/rateLimit';
import { AI } from './config';

export const aiMinuteLimiter = createLimiter({
  name: 'ai',
  windowMs: 60_000,
  limit: AI.callsPerMinute,
  keyGenerator: userKey,
  message: 'Too many AI requests. Try again in a minute.',
});

export const aiDailyLimiter = createLimiter({
  name: 'aiday',
  windowMs: 24 * 60 * 60_000,
  limit: AI.callsPerDay,
  keyGenerator: userKey,
  message: `You have used today's ${AI.callsPerDay} AI requests. Try again tomorrow.`,
});
