import path from 'node:path';
import { z } from 'zod';

// Load the monorepo-root .env; real environment variables (CI, Docker) win over the file.
try {
  process.loadEnvFile(path.resolve(__dirname, '../../../.env'));
} catch {
  /* no .env file: rely on the process environment */
}

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16),
  PORT: z.coerce.number().int().positive().default(4000),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  PG_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30000),
  PG_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(10000),
  // Optional error tracking (D41); empty means off.
  SENTRY_DSN: z.preprocess((v) => (v === '' ? undefined : v), z.url().optional()),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  // Where the local-disk storage driver keeps uploads (D54); the default is gitignored.
  STORAGE_DIR: z.string().min(1).default(path.resolve(__dirname, '../../../uploads')),
  // Unsplash search proxy (R22); empty means the routes answer 503.
  UNSPLASH_ACCESS_KEY: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  // Secure auth cookie (D35); defaults to on in production only, since local http would drop it.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? process.env.NODE_ENV === 'production' : v === 'true')),
});

export const env = schema.parse(process.env);
