import { pool } from '../../lib/pool';

export type Role = 'student' | 'lecturer' | 'admin';
export type UserStatus = 'active' | 'restricted' | 'suspended' | 'deleted';
export type LecturerStatus = 'pending' | 'approved' | 'rejected';

/** The user as the API exposes it; never carries the password hash. */
export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  lecturerStatus: LecturerStatus | null;
  programme: string | null;
}

interface UserRow {
  usr_id: number;
  usr_email: string;
  usr_password_hash: string;
  usr_display_name: string;
  usr_role: Role;
  usr_status: UserStatus;
  usr_lecturer_status: LecturerStatus | null;
  usr_programme: string | null;
}

const USER_COLUMNS = `usr_id, usr_email, usr_password_hash, usr_display_name, usr_role, usr_status,
       usr_lecturer_status, usr_programme`;

export function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.usr_id,
    email: row.usr_email,
    displayName: row.usr_display_name,
    role: row.usr_role,
    status: row.usr_status,
    lecturerStatus: row.usr_lecturer_status,
    programme: row.usr_programme,
  };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const { rows } = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM "USER_T" WHERE usr_email = $1`,
    [email],
  );
  return rows[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM "USER_T" WHERE usr_id = $1`, [id]);
  return rows[0];
}

export interface NewUser {
  email: string;
  passwordHash: string;
  displayName: string;
  programme: string | null;
  role: Role;
  lecturerStatus: LecturerStatus | null;
  staffId: string | null;
}

export async function createUser(u: NewUser): Promise<AuthUser> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_programme,
                           usr_role, usr_lecturer_status, usr_staff_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${USER_COLUMNS}`,
    [u.email, u.passwordHash, u.displayName, u.programme, u.role, u.lecturerStatus, u.staffId],
  );
  return toAuthUser(rows[0]);
}

/** Creates the admin, or resets name, password and role if the email already exists (D6 bootstrap). */
export async function upsertAdmin(email: string, passwordHash: string, displayName: string): Promise<AuthUser> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (usr_email) DO UPDATE
        SET usr_password_hash = EXCLUDED.usr_password_hash,
            usr_display_name = EXCLUDED.usr_display_name,
            usr_role = 'admin',
            usr_status = 'active',
            usr_lecturer_status = NULL
     RETURNING ${USER_COLUMNS}`,
    [email, passwordHash, displayName],
  );
  return toAuthUser(rows[0]);
}

export interface LecturerApplication {
  id: number;
  displayName: string;
  email: string;
  staffId: string | null;
  programme: string | null;
  createdAt: Date;
}

export async function listPendingLecturers(): Promise<LecturerApplication[]> {
  const { rows } = await pool.query<LecturerApplication>(
    `SELECT usr_id AS "id", usr_display_name AS "displayName", usr_email AS "email",
            usr_staff_id AS "staffId", usr_programme AS "programme", usr_created_at AS "createdAt"
     FROM "USER_T"
     WHERE usr_lecturer_status = 'pending' AND usr_status = 'active'
     ORDER BY usr_created_at ASC, usr_id ASC`,
  );
  return rows;
}

/**
 * Approves or rejects a pending lecturer application and logs it in one transaction (UC22).
 * Returns undefined when the user does not exist or has no pending application from an active account.
 */
export async function decideLecturer(
  userId: number,
  adminId: number,
  approve: boolean,
  reason: string,
): Promise<AuthUser | undefined> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<UserRow>(
      `UPDATE "USER_T"
       SET usr_role = $2, usr_lecturer_status = $3
       WHERE usr_id = $1 AND usr_lecturer_status = 'pending' AND usr_status = 'active'
       RETURNING ${USER_COLUMNS}`,
      [userId, approve ? 'lecturer' : 'student', approve ? 'approved' : 'rejected'],
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return undefined;
    }
    await client.query(
      `INSERT INTO "ACCOUNT_ACTION_T" (aac_usr_id, aac_admin_id, aac_action, aac_reason)
       VALUES ($1, $2, $3, $4)`,
      [userId, adminId, approve ? 'approve_lecturer' : 'reject_lecturer', reason],
    );
    await client.query('COMMIT');
    return toAuthUser(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
