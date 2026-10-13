import bcrypt from 'bcryptjs';
import express from 'express';
import { signToken } from '../src/auth/passport';
import type { AuthUser } from '../src/db/users';
import { pool } from '../src/db/pool';
import { requireAuth, requireRole } from '../src/middleware/auth';

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

/** A valid bearer header for an existing user id; the role claim is ignored by the server. */
export function bearer(id: number): string {
  return `Bearer ${signToken({ id, role: 'student' } as AuthUser)}`;
}

/** Stand-in for Super Like until it exists: any requireRole('lecturer') route. */
export const lecturerOnlyApp = express().post('/like', requireAuth, requireRole('lecturer'), (_req, r) => {
  r.json({ ok: true });
});
