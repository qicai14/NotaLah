import bcrypt from 'bcryptjs';
import { signToken } from '../src/features/auth/passport';
import type { AuthUser } from '../src/features/users/repository';
import { pool } from '../src/lib/pool';

/** Empties every table except the migration log and the seeded module catalogue. */
export async function truncateAll(): Promise<void> {
  const { rows } = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', 'MODULE_T')`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestUserInput {
  email?: string;
  password?: string;
  displayName?: string;
  role?: 'student' | 'lecturer' | 'admin';
  status?: 'active' | 'restricted' | 'suspended' | 'deleted';
  lecturerStatus?: 'pending' | 'approved' | 'rejected' | null;
  staffId?: string | null;
}

/** Inserts a user directly (low bcrypt cost keeps tests fast) and returns its id. */
export async function insertUser(u: TestUserInput = {}): Promise<number> {
  const hash = await bcrypt.hash(u.password ?? 'Passw0rd!', 4);
  const { rows } = await pool.query<{ usr_id: number }>(
    `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role, usr_status,
                           usr_lecturer_status, usr_staff_id, usr_programme)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'Software Engineering')
     RETURNING usr_id`,
    [
      u.email ?? `user${Math.random().toString(36).slice(2)}@mail.apu.edu.my`,
      hash,
      u.displayName ?? 'Test User',
      u.role ?? 'student',
      u.status ?? 'active',
      u.lecturerStatus ?? null,
      u.staffId ?? null,
    ],
  );
  return rows[0].usr_id;
}

/** CSRF header every state-changing /api request must carry (D35). */
export const CSRF = { 'X-Requested-With': 'parp' };

/** Headers for an existing user id: the auth cookie plus the CSRF header. The role claim is ignored by the server. */
export function asUser(id: number): Record<string, string> {
  return { Cookie: `parp_token=${signToken({ id, role: 'student' } as AuthUser)}`, ...CSRF };
}

export interface NoteOpts {
  status?: string;
  visibility?: string;
  slides?: number;
  title?: string;
}

/** Inserts a note directly with `slides` slides; returns its id. */
export async function insertNote(authorId: number, o: NoteOpts = {}): Promise<number> {
  const status = o.status ?? 'published';
  const { rows } = await pool.query<{ pst_id: number }>(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at)
     VALUES ($1, (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1), $2, $3, $4,
             CASE WHEN $3::VARCHAR = 'published' THEN NOW() END)
     RETURNING pst_id`,
    [authorId, o.title ?? 'A note', status, o.visibility ?? 'public'],
  );
  const id = rows[0].pst_id;
  for (let i = 1; i <= (o.slides ?? 3); i++) {
    await pool.query(`INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_content) VALUES ($1, $2, '<p>x</p>')`, [id, i]);
  }
  return id;
}

export async function follow(follower: number, followee: number): Promise<void> {
  await pool.query(`INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [follower, followee]);
}

/** Makes two users friends (a mutual follow, D38). */
export async function befriend(a: number, b: number): Promise<void> {
  await follow(a, b);
  await follow(b, a);
}

/** Follows `nextCursor` from the first page to the last; returns each page's `key` list (keyset lists, D40). */
export async function walkPages<T>(
  fetchPage: (cursor?: string) => Promise<{ body: Record<string, unknown> }>, key: string,
): Promise<T[][]> {
  const pages: T[][] = [];
  let cursor: string | undefined;
  do {
    const { body } = await fetchPage(cursor);
    pages.push(body[key] as T[]);
    cursor = (body.nextCursor as string | null) ?? undefined;
  } while (cursor);
  return pages;
}
