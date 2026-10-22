import path from 'node:path';
import { z } from 'zod';

// Load the monorepo-root .env; real environment variables (CI, Docker) win over the file.
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../../../.env'));
} catch {
  /* no .env file: rely on the process environment */
}

const R2_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const;

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    TEST_DATABASE_URL: z.string().min(1).optional(),
    JWT_SECRET: z.string().min(16),
    NODE_ENV: z.string().optional(),
    // Render sets RENDER=true on its services; treated as production for the guards below (R37).
    RENDER: z.string().optional(),
    PORT: z.coerce.number().int().positive().default(4000),
    PG_POOL_MAX: z.coerce.number().int().positive().default(10),
    PG_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30000),
    PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(10000),
    // bcrypt work factor for new hashes (R20, D81). Old hashes keep verifying: each one stores its own cost. Render's
    // 0.1 CPU sets 10, the OWASP minimum; 12 costs about 3 s of that CPU per login.
    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
    // Login and register attempts per client IP per minute (R37, D81); Render lowers it so bcrypt cannot starve the CPU.
    AUTH_ATTEMPTS_PER_MINUTE: z.coerce.number().int().positive().default(60),
    // Optional error tracking (D41); empty means off.
    SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
    CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),
    // Where the local-disk storage driver keeps uploads (D54); the default is gitignored.
    STORAGE_DIR: z
      .string()
      .min(1)
      .default(path.resolve(import.meta.dirname, '../../../uploads')),
    // Which storage driver serves uploads (D60); r2 needs the four R2_* values below.
    STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    // Unsplash search proxy (R22); empty means the routes answer 503.
    UNSPLASH_ACCESS_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    // Jamendo music search and track lookup (R9); empty means the routes answer 503.
    JAMENDO_CLIENT_ID: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
    // Kill switch (R34): true refuses every upload with 503.
    UPLOADS_DISABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
    // Video pipeline (R40, D67): `free` stream-copies compatible MP4 and re-encodes the rest at most 720p, one job at a time;
    // `standard` allows 1080p and VIDEO_CONCURRENCY jobs. Turn the in-process worker off when a separate worker service runs.
    VIDEO_PROFILE: z.enum(['free', 'standard']).default('free'),
    VIDEO_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
    VIDEO_WORKER_IN_PROCESS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    // Express `trust proxy` (R37, D65): a hop count, or `loopback` for the Vite dev proxy. Never `true`, which lets a client forge X-Forwarded-For.
    TRUST_PROXY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .union([
          z.literal('loopback'),
          z.string().regex(/^\d+$/, 'TRUST_PROXY must be a hop count or loopback').transform(Number),
        ])
        .default('loopback'),
    ),
    // Secure auth cookie (D35); defaults to on in production only, since local http would drop it.
    COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    // Hard cap on a sliding session (R37): past this many hours since login the cookie is no longer renewed.
    MAX_SESSION_HOURS: z.coerce.number().positive().default(12),
    // First-deploy check (D65): 1 logs req.ip beside the raw X-Forwarded-For on each health check, to confirm TRUST_PROXY.
    // Shared with the Pages Function (D77): requests without it are refused, so only the proxy reaches the API.
    PROXY_SECRET: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(16).optional()),
    // Set by Render on each deploy; reported by /api/health so the deploy workflow can wait for the new commit.
    RENDER_GIT_COMMIT: z.string().optional(),
    DEBUG_PROXY: z
      .enum(['1', '0'])
      .optional()
      .transform((v) => v === '1'),
  })
  .transform((v) => {
    const production = v.NODE_ENV === 'production' || v.RENDER === 'true';
    return { ...v, production, COOKIE_SECURE: v.COOKIE_SECURE === undefined ? production : v.COOKIE_SECURE === 'true' };
  })
  .superRefine((v, ctx) => {
    const fail = (name: string, message: string) => ctx.addIssue({ code: 'custom', path: [name], message });
    // Production guards (R37, D65): each message names the variable, never its value.
    if (v.production) {
      if (v.STORAGE_DRIVER === 'local')
        fail('STORAGE_DRIVER', 'STORAGE_DRIVER must be r2 in production: the disk is wiped on restart');
      if (!v.CLIENT_ORIGIN.startsWith('https://'))
        fail('CLIENT_ORIGIN', 'CLIENT_ORIGIN must be an https:// origin in production');
      if (!v.COOKIE_SECURE) fail('COOKIE_SECURE', 'COOKIE_SECURE must be true in production');
      if (v.TRUST_PROXY === 'loopback' || v.TRUST_PROXY === 0)
        fail('TRUST_PROXY', 'TRUST_PROXY must be the proxy hop count (2 behind the Pages proxy) in production');
      if (!v.PROXY_SECRET) fail('PROXY_SECRET', 'PROXY_SECRET must be set in production (at least 16 characters)');
    }
    if (v.STORAGE_DRIVER !== 'r2') return;
    for (const name of R2_VARS) {
      if (!v[name]) fail(name, `${name} is required when STORAGE_DRIVER=r2`);
    }
  });

export const parseEnv = (source: NodeJS.ProcessEnv) => schema.parse(source);
export const env = parseEnv(process.env);
