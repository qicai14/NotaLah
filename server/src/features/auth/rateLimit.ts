import type { Request } from 'express';
import { type ClientRateLimitInfo, ipKeyGenerator, type Options, rateLimit, type Store } from 'express-rate-limit';
import { tokenSubject } from './passport';
import { hitRateLimit, purgeRateLimits, resetRateLimit, unhitRateLimit } from './repository';

/** Rate-limit settings (D40): one window for every per-minute limiter. */
export const RATE_LIMITS = Object.freeze({
  windowMs: 60_000,
  /** Login and register attempts per client IP per window; a campus lab shares one IP (R37). */
  authAttempts: 60,
  /** Failed logins per client IP and email per window (R37), so one account's guesses do not lock out the lab. */
  loginFailures: 10,
  /** State-changing /api requests per signed-in user (or IP when signed out) per window. */
  writes: 120,
  /** Guest-readable GETs per client IP per window (R31, D45); keyed on req.ip, so it needs `trust proxy` set for the host (D35). */
  guestReads: 120,
});

/**
 * express-rate-limit store on "RATE_LIMIT_T", so every API instance shares the counts (D40). Each limiter needs its
 * own instance; the prefix keeps their keys apart.
 */
export class PgStore implements Store {
  localKeys = false;
  private windowMs: number = RATE_LIMITS.windowMs;

  constructor(readonly prefix: string) {}

  /** Each prefix's window, so the purge never ends a longer (hourly) window early (R37). */
  static readonly windows = new Map<string, number>();

  init(options: Options): void {
    this.windowMs = options.windowMs;
    PgStore.windows.set(this.prefix, options.windowMs);
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

/** Limiters are off under tests, except the one a test file names in RATE_LIMIT_UNDER_TEST (its PgStore prefix without the colon). */
const skipUnderTest = (name: string) => () =>
  process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_UNDER_TEST !== name;

interface LimiterOptions {
  /** PgStore prefix without the colon; also the name RATE_LIMIT_UNDER_TEST uses to switch it on. */
  name: string;
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

/** One limiter on "RATE_LIMIT_T" with the shared headers, store and test switch; every feature builds its own. */
export const createLimiter = ({
  name,
  windowMs,
  limit,
  message,
  keyGenerator,
  skipSuccessfulRequests,
}: LimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: new PgStore(`${name}:`),
    skip: skipUnderTest(name),
    keyGenerator,
    skipSuccessfulRequests,
    message: { error: message },
  });

/** Signed-in user, else client IP. */
export const userOrIpKey = (req: Request) => {
  const user = tokenSubject(req);
  return user ? `user:${user}` : ipKeyGenerator(req.ip ?? '');
};

/** For routes mounted after requireAuth. */
export const userKey = (req: Request) => `user:${req.user?.id ?? ''}`;

export const authLimiter = createLimiter({
  name: 'auth',
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.authAttempts,
  message: 'Too many attempts. Try again in a minute.',
});

/** Failed logins per IP and normalised email (R37); a successful login takes its hit back. */
export const loginFailureLimiter = createLimiter({
  name: 'login',
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.loginFailures,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email: unknown = req.body?.email;
    // Sliced so the key fits rlt_key VARCHAR(200) whatever the body sends.
    const normalised = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 150) : '';
    return `${ipKeyGenerator(req.ip ?? '')}:${normalised}`;
  },
  message: 'Too many failed attempts for this account. Try again in a minute.',
});

/** Mounted in app.ts for state-changing methods only. */
export const writeLimiter = createLimiter({
  name: 'write',
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.writes,
  keyGenerator: userOrIpKey,
  message: 'Too many requests. Try again in a minute.',
});

/** Applied by optionalAuth to signed-out requests only. */
export const guestReadLimiter = createLimiter({
  name: 'guest',
  windowMs: RATE_LIMITS.windowMs,
  limit: RATE_LIMITS.guestReads,
  message: 'Too many requests. Log in or try again in a minute.',
});

export const purgeOldRateLimits = () => purgeRateLimits([...PgStore.windows]);
