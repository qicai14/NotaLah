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
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),
});

export const env = schema.parse(process.env);
