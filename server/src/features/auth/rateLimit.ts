import type { Request } from 'express';
import { type ClientRateLimitInfo, ipKeyGenerator, type Options, rateLimit, type Store } from 'express-rate-limit';
import { ASSETS } from '../assets/config';
import { tokenSubject } from './passport';
import { hitRateLimit, purgeRateLimits, resetRateLimit, unhitRateLimit } from './repository';

/** Rate-limit settings (D40): one window for both limiters. */
export const RATE_LIMITS = Object.freeze({
  windowMs: 60_000,
  /** Login and register attempts per client IP per window. */
  authAttempts: 10,
  /** State-changing /api requests per signed-in user (or IP when signed out) per window. */
  writes: 120,
  /** Guest-readable GETs per client IP per window (R31, D45); keyed on req.ip, so it needs `trust proxy` set for the host (D35). */
  guestReads: 120,
  /** Asset file requests per signed-in user (or IP) per window (R34): each one is a counted storage read. */
  files: 300,
});

/**
 * express-rate-limit store on "RATE_LIMIT_T", so every API instance shares the counts (D40). Each limiter needs its
 * own instance; the prefix keeps their keys apart.
 */
export class PgStore implements Store {
  localKeys = false;
  private windowMs: number = RATE_LIMITS.windowMs;

  constructor(readonly prefix: string) {}

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  increment(key: string): Promise<ClientRateLimitInfo> {
    return hitRateLimit(this.prefix + key, this.windowMs);
  }

  decrement(key: string): Promise<void> {
    return unhitRateLimit(this.prefix + key);
  }

  resetKey(key: string): Promise<void> {
    return resetRateLimit(this.prefix + key);
  }
}

const testing = () => process.env.NODE_ENV === 'test';

export const authLimiter = rateLimit({
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.authAttempts,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('auth:'),
  skip: testing,
  message: { error: 'Too many attempts. Try again in a minute.' },
});

/** Mounted in app.ts for state-changing methods only. */
export const writeLimiter = rateLimit({
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.writes,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('write:'),
  keyGenerator: (req: Request) => {
    const user = tokenSubject(req);
    return user ? `user:${user}` : ipKeyGenerator(req.ip ?? '');
  },
  skip: testing,
  message: { error: 'Too many requests. Try again in a minute.' },
});

/** Image uploads per signed-in user per hour (R22); mounted after requireAuth. */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: ASSETS.uploadsPerHour,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('upload:'),
  keyGenerator: (req: Request) => `user:${req.user?.id ?? ''}`,
  skip: testing,
  message: { error: 'Too many uploads. Try again later.' },
});

/** Video uploads per signed-in user per hour (R29, D59); a separate, lower cap because each one runs ffmpeg. */
export const videoUploadLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: ASSETS.videoUploadsPerHour,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('video:'),
  keyGenerator: (req: Request) => `user:${req.user?.id ?? ''}`,
  skip: testing,
  message: { error: 'Too many video uploads. Try again later.' },
});

/** Unsplash searches per signed-in user per hour (R22); the demo tier allows 50 an hour for the whole app. */
export const unsplashLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: ASSETS.unsplashSearchesPerHour,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('unsplash:'),
  keyGenerator: (req: Request) => `user:${req.user?.id ?? ''}`,
  skip: testing,
  message: { error: 'Too many searches. Try again later.' },
});

/** Asset file requests, on both file routes (R34, D57); keyed like the write limiter. */
export const fileLimiter = rateLimit({
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.files,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('file:'),
  keyGenerator: (req: Request) => {
    const user = tokenSubject(req);
    return user ? `user:${user}` : ipKeyGenerator(req.ip ?? '');
  },
  skip: testing,
  message: { error: 'Too many requests. Try again in a minute.' },
});

/** Applied by optionalAuth to signed-out requests only. */
export const guestReadLimiter = rateLimit({
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.guestReads,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: new PgStore('guest:'),
  skip: testing,
  message: { error: 'Too many requests. Log in or try again in a minute.' },
});

export const purgeOldRateLimits = () => purgeRateLimits(RATE_LIMITS.windowMs);
