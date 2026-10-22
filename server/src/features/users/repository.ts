import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import type { Pool, PoolClient } from 'pg';
import { inTransaction, pool } from '../../lib/pool';

export type Role = 'student' | 'lecturer' | 'admin';
export type UserStatus = 'active' | 'restricted' | 'suspended' | 'deleted';
export type LecturerStatus = 'pending' | 'approved' | 'rejected';

/** Viewer id of a signed-out visitor (R31): matches no account, so `VISIBLE` passes only public notes and no flag is set. */
export const GUEST_ID = 0;

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
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM "USER_T" WHERE usr_email = $1`, [email]);
  return rows[0];
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM "USER_T" WHERE usr_id = $1`, [id]);
  return rows[0];
}

interface NewUser {
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
  await pool.query(`DELETE FROM "BLOCK_T" WHERE blk_blocked_id = $1`, [rows[0].usr_id]); // admins cannot be blocked (D49)
  return toAuthUser(rows[0]);
}

interface LecturerApplication {
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
     ORDER BY usr_created_at ASC, usr_id ASC
     LIMIT 100`, // bounded (D81): oldest first, and each decision lets the next one in
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
  return inTransaction(async (client) => {
    const { rows } = await client.query<UserRow>(
      `UPDATE "USER_T"
       SET usr_role = $2, usr_lecturer_status = $3
       WHERE usr_id = $1 AND usr_lecturer_status = 'pending' AND usr_status = 'active'
       RETURNING ${USER_COLUMNS}`,
      [userId, approve ? 'lecturer' : 'student', approve ? 'approved' : 'rejected'],
    );
    if (rows.length === 0) return undefined;
    await client.query(
      `INSERT INTO "ACCOUNT_ACTION_T" (aac_usr_id, aac_admin_id, aac_action, aac_reason)
       VALUES ($1, $2, $3, $4)`,
      [userId, adminId, approve ? 'approve_lecturer' : 'reject_lecturer', reason],
    );
    return toAuthUser(rows[0]);
  });
}

export interface Profile {
  id: number;
  displayName: string;
  role: Role;
  programme: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
}

/** SQL for "approved lecturer" (D21) on a USER_T alias; the one definition every query shares. Never NULL (a deleted lecturer has no lecturer status). */
export const approvedLecturer = (alias: string) =>
  `(${alias}.usr_role = 'lecturer' AND COALESCE(${alias}.usr_lecturer_status = 'approved', FALSE))`;

/** An approved lecturer whose account is active or restricted: who earns V in the ranking, as verifier or author (D24). */
export const countingLecturer = (alias: string) =>
  `(${approvedLecturer(alias)} AND ${alias}.usr_status IN ('active', 'restricted'))`;

/** True for a lecturer account whose registration an admin approved (D21). */
export const isApprovedLecturer = (u: Pick<AuthUser, 'role' | 'lecturerStatus'>) =>
  u.role === 'lecturer' && u.lecturerStatus === 'approved';

/** SQL: `{id, displayName}` JSON of the "USER_T" row aliased `alias`. */
export const userRef = (alias: string) =>
  `json_build_object('id', ${alias}.usr_id, 'displayName', ${alias}.usr_display_name)`;

/** SQL: user `a` follows user `b`. Arguments are SQL constants or placeholders, never user input. */
export const follows = (a: string, b: string) =>
  `EXISTS (SELECT 1 FROM "FOLLOW_T" WHERE fol_follower_id = ${a} AND fol_followee_id = ${b})`;

/** SQL: `a` and `b` follow each other, which makes them friends (D38). */
export const friends = (a: string, b: string) => `(${follows(a, b)} AND ${follows(b, a)})`;

/** SQL: viewer `v` (an id expression) is an admin; GUEST_ID matches no account. */
export const viewerIsAdmin = (v: string) =>
  `EXISTS (SELECT 1 FROM "USER_T" va WHERE va.usr_id = ${v} AND va.usr_role = 'admin')`;

/**
 * SQL: users `v` and `other` have a block in either direction (D49). Put the fixed side (usually the viewer `$1`) in `v`:
 * the subquery then does not depend on the row, so the planner hashes v's block list once instead of probing per row.
 * GUEST_ID has no blocks. Arguments are SQL constants or placeholders, never user input.
 */
export const blockedWith = (v: string, other: string) =>
  `(${other} IN (SELECT blk_blocked_id FROM "BLOCK_T" WHERE blk_blocker_id = ${v}
                 UNION ALL SELECT blk_blocker_id FROM "BLOCK_T" WHERE blk_blocked_id = ${v}))`;

/** True when either user blocked the other (D49); messaging reuses it to refuse blocked pairs, inside its own transaction via `q`. */
export async function isBlocked(a: number, b: number, q: Pool | PoolClient = pool): Promise<boolean> {
  return (await q.query<{ blocked: boolean }>(`SELECT ${blockedWith('$1::INT', '$2::INT')} AS "blocked"`, [a, b]))
    .rows[0].blocked;
}

/** SQL: account u may be shown to viewer $1: not deleted, and not suspended unless the viewer is an admin (D26, D47). */
export const SHOWN_USER = `(u.usr_status <> 'deleted' AND (u.usr_status <> 'suspended' OR ${viewerIsAdmin('$1')}))`;

/** Accounts that appear in follow lists and counts: not deleted or suspended (D38). */
const LISTED = `IN ('active', 'restricted')`;

export interface FollowState {
  followerCount: number;
  followingCount: number;
  followedByMe: boolean;
  followsMe: boolean;
  isFriend: boolean;
}

/** Follow columns of USER_T alias u as viewer $1 sees them. */
const FOLLOW_STATE_COLS = `
            (SELECT COUNT(*)::INT FROM "FOLLOW_T" f JOIN "USER_T" fu ON fu.usr_id = f.fol_follower_id
             WHERE f.fol_followee_id = u.usr_id AND fu.usr_status ${LISTED}) AS "followerCount",
            (SELECT COUNT(*)::INT FROM "FOLLOW_T" f JOIN "USER_T" fu ON fu.usr_id = f.fol_followee_id
             WHERE f.fol_follower_id = u.usr_id AND fu.usr_status ${LISTED}) AS "followingCount",
            ${follows('$1', 'u.usr_id')} AS "followedByMe", ${follows('u.usr_id', '$1')} AS "followsMe",
            ${friends('$1', 'u.usr_id')} AS "isFriend"`;

/** Public profile fields plus the viewer's follow and block state; undefined for unknown accounts, those not SHOWN_USER and those who blocked the viewer, unless the viewer blocked them too (D49). */
export async function findProfile(
  id: number,
  viewerId: number,
): Promise<(Profile & FollowState & { blockedByMe: boolean }) | undefined> {
  const { rows } = await pool.query<Profile & FollowState & { blockedByMe: boolean }>(
    `SELECT usr_id AS "id", usr_display_name AS "displayName", usr_role AS "role", usr_programme AS "programme",
            usr_bio AS "bio", usr_avatar_url AS "avatarUrl",
            ${approvedLecturer('u')} AS "isVerifiedLecturer", ${FOLLOW_STATE_COLS},
            EXISTS (SELECT 1 FROM "BLOCK_T" WHERE blk_blocker_id = $1 AND blk_blocked_id = u.usr_id) AS "blockedByMe"
     FROM "USER_T" u WHERE usr_id = $2 AND ${SHOWN_USER}
       AND (EXISTS (SELECT 1 FROM "BLOCK_T" WHERE blk_blocker_id = $1 AND blk_blocked_id = u.usr_id)
            OR NOT EXISTS (SELECT 1 FROM "BLOCK_T" WHERE blk_blocker_id = u.usr_id AND blk_blocked_id = $1))`,
    [viewerId, id],
  );
  return rows[0];
}

/** The follow state of a SHOWN_USER as the viewer sees it; undefined otherwise. */
export async function getFollowState(viewerId: number, targetId: number): Promise<FollowState | undefined> {
  const { rows } = await pool.query<FollowState>(
    `SELECT ${FOLLOW_STATE_COLS} FROM "USER_T" u WHERE u.usr_id = $2 AND ${SHOWN_USER}`,
    [viewerId, targetId],
  );
  return rows[0];
}

/**
 * Follows a SHOWN_USER outside any block (D38, D49); 'exists' when already following. The target is share-locked in its
 * own statement first, so the check below takes a fresh snapshot: a concurrent block (which locks both users) is either
 * committed and seen, or waits and then deletes this follow.
 */
export function follow(followerId: number, followeeId: number): Promise<'created' | 'exists' | 'not_found'> {
  return inTransaction(async (c) => {
    await c.query(`SELECT 1 FROM "USER_T" WHERE usr_id = $1 FOR SHARE`, [followeeId]);
    const { rows } = await c.query<{ found: boolean; created: boolean }>(
      `WITH t AS (SELECT u.usr_id FROM "USER_T" u WHERE u.usr_id = $2 AND ${SHOWN_USER} AND NOT ${blockedWith('$1', 'u.usr_id')}),
            ins AS (INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id) SELECT $1, usr_id FROM t
                    ON CONFLICT DO NOTHING RETURNING 1)
       SELECT EXISTS (SELECT 1 FROM t) AS "found", EXISTS (SELECT 1 FROM ins) AS "created"`,
      [followerId, followeeId],
    );
    return !rows[0].found ? 'not_found' : rows[0].created ? 'created' : 'exists';
  });
}

/** True when a follow row was removed. */
export async function unfollow(followerId: number, followeeId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`DELETE FROM "FOLLOW_T" WHERE fol_follower_id = $1 AND fol_followee_id = $2`, [
    followerId,
    followeeId,
  ]);
  return rowCount === 1;
}

interface FollowListItem {
  id: number;
  displayName: string;
  role: Role;
  isVerifiedLecturer: boolean;
  followedByMe: boolean;
  isFriend: boolean;
}

const SIDES = {
  followers: { list: 'fol_follower_id', of: 'fol_followee_id' },
  following: { list: 'fol_followee_id', of: 'fol_follower_id' },
} as const;

/** One page of a user's followers or followings (not deleted or suspended), newest follow first. */
export async function listFollows(
  userId: number,
  viewerId: number,
  side: keyof typeof SIDES,
  { cursor, limit }: KeysetPage,
): Promise<{ items: FollowListItem[]; nextCursor: string | null }> {
  const { list, of } = SIDES[side];
  const { rows } = await pool.query<FollowListItem & { cursor: string }>(
    `SELECT u.usr_id AS "id", u.usr_display_name AS "displayName", u.usr_role AS "role",
            ${approvedLecturer('u')} AS "isVerifiedLecturer",
            ${follows('$1', 'u.usr_id')} AS "followedByMe", ${friends('$1', 'u.usr_id')} AS "isFriend",
            ${micros('f.fol_created_at')} || '_' || u.usr_id AS "cursor"
     FROM "FOLLOW_T" f JOIN "USER_T" u ON u.usr_id = f.${list}
     WHERE f.${of} = $2 AND u.usr_status ${LISTED}
       AND ($3::BIGINT IS NULL OR (f.fol_created_at, u.usr_id) < (${fromMicros('$3')}, $4::INT))
     ORDER BY f.fol_created_at DESC, u.usr_id DESC
     LIMIT $5`,
    [viewerId, userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

export async function updateProfile(
  id: number,
  p: { displayName: string; programme?: string | null; bio?: string | null },
): Promise<AuthUser> {
  // $3/$5 flag a field as present, so an omitted one keeps its value while null clears it
  const { rows } = await pool.query<UserRow>(
    `UPDATE "USER_T" SET usr_display_name = $2,
            usr_programme = CASE WHEN $3::BOOLEAN THEN $4 ELSE usr_programme END,
            usr_bio = CASE WHEN $5::BOOLEAN THEN $6 ELSE usr_bio END
     WHERE usr_id = $1 RETURNING ${USER_COLUMNS}`,
    [id, p.displayName, p.programme !== undefined, p.programme ?? null, p.bio !== undefined, p.bio ?? null],
  );
  return toAuthUser(rows[0]);
}

/**
 * Blocks a user who is not deleted and not an admin (D49), and in the same transaction removes follows both ways and
 * their follow notifications (D51), pending
 * collaboration requests either user made on the other's notes, and edit locks either holds on the other's notes.
 * 'exists' when already blocked. Both users are locked in id order, which serialises it against follow().
 */
export function block(blockerId: number, blockedId: number): Promise<'created' | 'exists' | 'not_found' | 'admin'> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{ id: number; role: Role; status: UserStatus }>(
      `SELECT usr_id AS "id", usr_role AS "role", usr_status AS "status" FROM "USER_T"
       WHERE usr_id IN ($1, $2) ORDER BY usr_id FOR NO KEY UPDATE`,
      [blockerId, blockedId],
    );
    const target = rows.find((r) => r.id === blockedId);
    if (!target || target.status === 'deleted') return 'not_found';
    if (target.role === 'admin') return 'admin';
    const { rowCount } = await c.query(
      `INSERT INTO "BLOCK_T" (blk_blocker_id, blk_blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [blockerId, blockedId],
    );
    await c.query(
      `DELETE FROM "FOLLOW_T" WHERE (fol_follower_id = $1 AND fol_followee_id = $2) OR (fol_follower_id = $2 AND fol_followee_id = $1)`,
      [blockerId, blockedId],
    );
    await c.query(
      `DELETE FROM "NOTIFICATION_T" WHERE ntf_type = 'follow'
         AND ((ntf_usr_id = $1 AND ntf_actor_id = $2) OR (ntf_usr_id = $2 AND ntf_actor_id = $1))`,
      [blockerId, blockedId],
    );
    await c.query(
      `DELETE FROM "COLLAB_REQUEST_T" r USING "POST_T" p
       WHERE p.pst_id = r.crq_pst_id AND r.crq_status = 'pending'
         AND ((r.crq_usr_id = $1 AND p.pst_usr_id = $2) OR (r.crq_usr_id = $2 AND p.pst_usr_id = $1))`,
      [blockerId, blockedId],
    );
    await c.query(
      `UPDATE "POST_T" SET pst_lock_usr_id = NULL, pst_lock_expires_at = NULL
       WHERE (pst_usr_id = $1 AND pst_lock_usr_id = $2) OR (pst_usr_id = $2 AND pst_lock_usr_id = $1)`,
      [blockerId, blockedId],
    );
    return rowCount === 1 ? 'created' : 'exists';
  });
}

export async function unblock(blockerId: number, blockedId: number): Promise<void> {
  await pool.query(`DELETE FROM "BLOCK_T" WHERE blk_blocker_id = $1 AND blk_blocked_id = $2`, [blockerId, blockedId]);
}

export interface BlockedUser {
  id: number;
  displayName: string;
  blockedAt: Date;
}

/** One page of the accounts the user blocked (deleted ones left out), newest block first; keyset on (blocked at, id), D40. */
export async function listBlocks(
  userId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: BlockedUser[]; nextCursor: string | null }> {
  const { rows } = await pool.query<BlockedUser & { cursor: string }>(
    `SELECT u.usr_id AS "id", u.usr_display_name AS "displayName", b.blk_created_at AS "blockedAt",
            ${micros('b.blk_created_at')} || '_' || u.usr_id AS "cursor"
     FROM "BLOCK_T" b JOIN "USER_T" u ON u.usr_id = b.blk_blocked_id
     WHERE b.blk_blocker_id = $1 AND u.usr_status <> 'deleted'
       AND ($2::BIGINT IS NULL OR (b.blk_created_at, u.usr_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY b.blk_created_at DESC, u.usr_id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}
