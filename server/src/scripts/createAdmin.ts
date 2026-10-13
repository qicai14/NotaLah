import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { BCRYPT_COST } from '../features/auth/passport';
import '../lib/env'; // loads the root .env into process.env
import { pool } from '../lib/pool';
import { type AuthUser, upsertAdmin } from '../features/users/repository';

// Admins are never self-registered (D6); this is the only way to create one.
const adminSchema = z.object({
  ADMIN_EMAIL: z.string({ error: 'ADMIN_EMAIL is required' }).trim().toLowerCase().pipe(z.email({ error: 'ADMIN_EMAIL must be a valid email' })),
  ADMIN_PASSWORD: z
    .string({ error: 'ADMIN_PASSWORD is required' })
    .min(12, 'ADMIN_PASSWORD must be at least 12 characters')
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'ADMIN_PASSWORD must be at most 72 bytes')
    .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), 'ADMIN_PASSWORD needs upper, lower case and a digit'),
  ADMIN_NAME: z.string({ error: 'ADMIN_NAME is required' }).trim().min(1, 'ADMIN_NAME is required').max(50),
});

export async function createAdmin(input: Record<string, string | undefined>): Promise<AuthUser> {
  const parsed = adminSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = parsed.data;
  return upsertAdmin(ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_COST), ADMIN_NAME);
}

if (require.main === module) {
  createAdmin(process.env)
    .then((u) => console.log(`Admin ready: ${u.email} (id ${u.id})`))
    .catch((err: Error) => {
      console.error(`admin:create failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
