import { createLimiter, RATE_LIMITS, userKey, userOrIpKey } from '../auth/rateLimit';
import { ASSETS } from './config';

const HOUR_MS = 60 * 60_000;

/** Image uploads per signed-in user per hour (R22); mounted after requireAuth. */
export const uploadLimiter = createLimiter({
  name: 'upload',
  windowMs: HOUR_MS,
  limit: ASSETS.uploadsPerHour,
  keyGenerator: userKey,
  message: 'Too many uploads. Try again later.',
});

/** Video uploads per signed-in user per hour (R29, D59); a separate, lower cap because each one runs ffmpeg. */
export const videoUploadLimiter = createLimiter({
  name: 'video',
  windowMs: HOUR_MS,
  limit: ASSETS.videoUploadsPerHour,
  keyGenerator: userKey,
  message: 'Too many video uploads. Try again later.',
});

/** Asset file requests, on both file routes (R34, D57); keyed like the write limiter. */
export const fileLimiter = createLimiter({
  name: 'file',
  windowMs: RATE_LIMITS.windowMs,
  limit: ASSETS.fileRequestsPerMinute,
  keyGenerator: userOrIpKey,
  message: 'Too many requests. Try again in a minute.',
});
