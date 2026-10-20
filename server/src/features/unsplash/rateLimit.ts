import { ASSETS } from '../assets/config';
import { createLimiter, userKey } from '../auth/rateLimit';

/** Unsplash searches per signed-in user per hour (R22); the demo tier allows 50 an hour for the whole app. */
export const unsplashLimiter = createLimiter({
  name: 'unsplash',
  windowMs: 60 * 60_000,
  limit: ASSETS.unsplashSearchesPerHour,
  keyGenerator: userKey,
  message: 'Too many searches. Try again later.',
});
