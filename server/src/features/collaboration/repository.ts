import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { inTransaction, pool } from '../../lib/pool';
import { SHAREABLE } from '../notes/repository';
import { COLLABORATION } from './config';

export type CollabRole = 'view' | 'edit';

interface Person {
  id: number;
  displayName: string;
}

export interface NoteAccess {
  collaborators: { user: Person; role: CollabRole; addedAt: Date }[];
  links: { role: CollabRole; createdAt: Date }[];
  requests: { id: number; user: Person; message: string | null; createdAt: Date }[];
}

const person = (alias: string) => `json_build_object('id', ${alias}.usr_id, 'displayName', ${alias}.usr_display_name)`;

/** Everything the owner manages on one note; active links never include their token. */
export async function getAccess(noteId: number): Promise<NoteAccess> {
  const [collaborators, links, requests] = await Promise.all([
    pool.query(
      `SELECT ${person('u')} AS "user", c.clb_role AS "role", c.clb_created_at AS "addedAt"
       FROM "COLLABORATOR_T" c JOIN "USER_T" u ON u.usr_id = c.clb_usr_id
       WHERE c.clb_pst_id = $1 ORDER BY c.clb_created_at, u.usr_id`,
      [noteId],
    ),
    pool.query(
      `SELECT shl_role AS "role", shl_created_at AS "createdAt" FROM "SHARE_LINK_T"
       WHERE shl_pst_id = $1 AND shl_revoked_at IS NULL ORDER BY shl_role`,
      [noteId],
    ),
    pool.query(
      `SELECT r.crq_id AS "id", ${person('u')} AS "user", r.crq_message AS "message", r.crq_created_at AS "createdAt"
       FROM "COLLAB_REQUEST_T" r JOIN "USER_T" u ON u.usr_id = r.crq_usr_id
       WHERE r.crq_pst_id = $1 AND r.crq_status = 'pending' ORDER BY r.crq_created_at, r.crq_id`,
      [noteId],
    ),
  ]);
  return { collaborators: collaborators.rows, links: links.rows, requests: requests.rows };
}

/** Adds the user as a collaborator or changes their role; false when no active or restricted account has that id. */
export async function setCollaborator(noteId: number, userId: number, role: CollabRole, addedBy: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by)
     SELECT $1, usr_id, $3, $4 FROM "USER_T" WHERE usr_id = $2 AND usr_status IN ('active', 'restricted')
     ON CONFLICT (clb_pst_id, clb_usr_id) DO UPDATE SET clb_role = EXCLUDED.clb_role`,
    [noteId, userId, role, addedBy],
  );
  return rowCount === 1;
}

/** Removes the collaborator and releases any edit lock they hold on the note. */
export function removeCollaborator(noteId: number, userId: number): Promise<void> {
  return inTransaction(async (c) => {
    await c.query(`DELETE FROM "COLLABORATOR_T" WHERE clb_pst_id = $1 AND clb_usr_id = $2`, [noteId, userId]);
    await c.query(
      `UPDATE "POST_T" SET pst_lock_usr_id = NULL, pst_lock_expires_at = NULL WHERE pst_id = $1 AND pst_lock_usr_id = $2`,
      [noteId, userId],
    );
  });
}

/** Revokes the note's active link of this role, if any, and stores the hash of its replacement. */
export function replaceLink(noteId: number, role: CollabRole, tokenHash: string): Promise<void> {
  return inTransaction(async (c) => {
    await c.query(
      `UPDATE "SHARE_LINK_T" SET shl_revoked_at = NOW() WHERE shl_pst_id = $1 AND shl_role = $2 AND shl_revoked_at IS NULL`,
      [noteId, role],
    );
    await c.query(`INSERT INTO "SHARE_LINK_T" (shl_pst_id, shl_role, shl_token_hash) VALUES ($1, $2, $3)`, [noteId, role, tokenHash]);
  });
}

export async function revokeLink(noteId: number, role: CollabRole): Promise<void> {
  await pool.query(
    `UPDATE "SHARE_LINK_T" SET shl_revoked_at = NOW() WHERE shl_pst_id = $1 AND shl_role = $2 AND shl_revoked_at IS NULL`,
    [noteId, role],
  );
}

/** The active link with this token hash on a SHAREABLE note, or undefined. */
export async function findLink(tokenHash: string): Promise<{ noteId: number; ownerId: number; role: CollabRole } | undefined> {
  const { rows } = await pool.query(
    `SELECT p.pst_id AS "noteId", p.pst_usr_id AS "ownerId", s.shl_role AS "role"
     FROM "SHARE_LINK_T" s JOIN "POST_T" p ON p.pst_id = s.shl_pst_id
     WHERE s.shl_token_hash = $1 AND s.shl_revoked_at IS NULL AND ${SHAREABLE}`,
    [tokenHash],
  );
  return rows[0];
}

/** Redeems an edit link: the user becomes (or is upgraded to) an edit collaborator, credited as added by the owner. */
export async function joinAsEditor(noteId: number, userId: number, ownerId: number): Promise<void> {
  await pool.query(
    `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'edit', $3)
     ON CONFLICT (clb_pst_id, clb_usr_id) DO UPDATE SET clb_role = 'edit'`,
    [noteId, userId, ownerId],
  );
}

/** Throws a unique violation when the user already has a pending request on the note; the caller maps it to 409. */
export async function createRequest(noteId: number, userId: number, message: string | null): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO "COLLAB_REQUEST_T" (crq_pst_id, crq_usr_id, crq_message) VALUES ($1, $2, $3) RETURNING crq_id AS "id"`,
    [noteId, userId, message],
  );
  return rows[0].id;
}

/**
 * Approves (adding the requester with `role`) or declines a pending request on the note in one transaction. 'not_found'
 * when the request is not on this note, 'decided' when it is no longer pending.
 */
export function decideRequest(
  noteId: number, requestId: number, approve: boolean, role: CollabRole, ownerId: number,
): Promise<'ok' | 'not_found' | 'decided'> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{ userId: number; status: string }>(
      `SELECT crq_usr_id AS "userId", crq_status AS "status" FROM "COLLAB_REQUEST_T"
       WHERE crq_id = $1 AND crq_pst_id = $2 FOR UPDATE`,
      [requestId, noteId],
    );
    if (!rows[0]) return 'not_found';
    if (rows[0].status !== 'pending') return 'decided';
    await c.query(
      `UPDATE "COLLAB_REQUEST_T" SET crq_status = $2, crq_decided_at = NOW() WHERE crq_id = $1`,
      [requestId, approve ? 'approved' : 'declined'],
    );
    if (approve) {
      await c.query(
        `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, $3, $4)
         ON CONFLICT (clb_pst_id, clb_usr_id) DO UPDATE SET clb_role = EXCLUDED.clb_role`,
        [noteId, rows[0].userId, role, ownerId],
      );
    }
    return 'ok';
  });
}

export interface SharedNote {
  id: number;
  title: string;
  status: string;
  role: CollabRole;
  owner: Person;
  updatedAt: Date;
}

/** One page of the SHAREABLE notes the user collaborates on, last edited first; keyset on (updated_at, id), D40. */
export async function listShared(userId: number, { cursor, limit }: KeysetPage): Promise<{ items: SharedNote[]; nextCursor: string | null }> {
  const { rows } = await pool.query<SharedNote & { cursor: string }>(
    `SELECT p.pst_id AS "id", p.pst_title AS "title", p.pst_status AS "status", c.clb_role AS "role", ${person('u')} AS "owner",
            p.pst_updated_at AS "updatedAt", ${micros('p.pst_updated_at')} || '_' || p.pst_id AS "cursor"
     FROM "COLLABORATOR_T" c
     JOIN "POST_T" p ON p.pst_id = c.clb_pst_id
     JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
     WHERE c.clb_usr_id = $1 AND ${SHAREABLE}
       AND ($2::BIGINT IS NULL OR (p.pst_updated_at, p.pst_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY p.pst_updated_at DESC, p.pst_id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

/**
 * Takes or renews the note's soft edit lock for lockTtlSeconds when it is free, expired or already the user's. Returns the
 * new expiry, or the current holder when someone else has it.
 */
export async function takeLock(
  noteId: number, userId: number,
): Promise<{ ok: true; expiresAt: Date } | { ok: false; holder: Person | null }> {
  const taken = await pool.query<{ expiresAt: Date }>(
    `UPDATE "POST_T" SET pst_lock_usr_id = $2, pst_lock_expires_at = NOW() + make_interval(secs => $3)
     WHERE pst_id = $1 AND (pst_lock_usr_id IS NULL OR pst_lock_usr_id = $2 OR pst_lock_expires_at <= NOW())
     RETURNING pst_lock_expires_at AS "expiresAt"`,
    [noteId, userId, COLLABORATION.lockTtlSeconds],
  );
  if (taken.rows[0]) return { ok: true, expiresAt: taken.rows[0].expiresAt };
  const { rows } = await pool.query<{ holder: Person }>(
    `SELECT ${person('u')} AS "holder" FROM "POST_T" p JOIN "USER_T" u ON u.usr_id = p.pst_lock_usr_id WHERE p.pst_id = $1`,
    [noteId],
  );
  return { ok: false, holder: rows[0]?.holder ?? null }; // null: the holder released it between the two statements

}

/** Releases the lock if this user holds it. */
export async function releaseLock(noteId: number, userId: number): Promise<void> {
  await pool.query(
    `UPDATE "POST_T" SET pst_lock_usr_id = NULL, pst_lock_expires_at = NULL WHERE pst_id = $1 AND pst_lock_usr_id = $2`,
    [noteId, userId],
  );
}
