import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { inTransaction, pool } from '../../lib/pool';
import { MODULE_COL, NOTE_COLS, NOTE_FROM, type Note } from '../notes/repository';
import type { LecturerStatus, Role, UserStatus } from '../users/repository';

type Reports = { id: number; reason: string; details: string | null; reporter: string; createdAt: Date }[];

/** A reported note in the queue: summary columns, no slides (D40). */
export interface ReportSummary {
  id: number;
  title: string;
  status: string;
  module: { id: number; code: string; name: string } | null;
  author: { id: number; displayName: string };
  reportCount: number;
  oldestReportAt: Date;
  reports: Reports;
}

/** A reported note (full, for the review panel) with its open reports. */
export interface ReportGroup extends Note {
  reportCount: number;
  oldestReportAt: Date;
  reports: Reports;
}

/** Open reports grouped by note ($1 = one note id, or NULL for all); a note its author deleted drops out (D26). */
const OPEN_GROUPS = `
     WITH g AS (
       SELECT r.rpt_pst_id, COUNT(*)::INT AS n, MIN(r.rpt_created_at) AS oldest,
              json_agg(json_build_object('id', r.rpt_id, 'reason', r.rpt_reason, 'details', r.rpt_details,
                                         'reporter', ru.usr_display_name, 'createdAt', r.rpt_created_at)
                       ORDER BY r.rpt_created_at, r.rpt_id) AS reports
       FROM "REPORT_T" r JOIN "USER_T" ru ON ru.usr_id = r.rpt_reporter_id
       WHERE r.rpt_status = 'open' AND ($1::INT IS NULL OR r.rpt_pst_id = $1)
       GROUP BY r.rpt_pst_id)`;
const GROUP_COLS = `g.n AS "reportCount", g.oldest AS "oldestReportAt", g.reports AS "reports"`;

/** One page of the queue, the note with the oldest open report first; keyset on (oldest report, note id), D40. */
export async function listOpenReports({
  cursor,
  limit,
}: KeysetPage): Promise<{ items: ReportSummary[]; nextCursor: string | null }> {
  const { rows } = await pool.query<ReportSummary & { cursor: string }>(
    `${OPEN_GROUPS}
     SELECT p.pst_id AS "id", p.pst_title AS "title", p.pst_status AS "status",
            ${MODULE_COL},
            json_build_object('id', u.usr_id, 'displayName', u.usr_display_name) AS "author", ${GROUP_COLS},
            ${micros('g.oldest')} || '_' || p.pst_id AS "cursor"
     ${NOTE_FROM} JOIN g ON g.rpt_pst_id = p.pst_id
     WHERE p.pst_status <> 'deleted' AND ($2::BIGINT IS NULL OR (g.oldest, p.pst_id) > (${fromMicros('$2')}, $3::INT))
     ORDER BY g.oldest, p.pst_id
     LIMIT $4`,
    [null, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

/** The full note with its open reports, or undefined when it has none or was deleted. */
export async function getOpenReportGroup(noteId: number): Promise<ReportGroup | undefined> {
  const { rows } = await pool.query<ReportGroup>(
    `${OPEN_GROUPS}
     SELECT ${NOTE_COLS}, ${GROUP_COLS}
     ${NOTE_FROM} JOIN g ON g.rpt_pst_id = p.pst_id
     WHERE p.pst_status <> 'deleted'`,
    [noteId],
  );
  return rows[0];
}

/**
 * Resolves every open report on the note in one transaction: 'dismiss' marks them dismissed, 'hide' marks them upheld
 * and hides the note if it is published. Returns the number resolved (0 = the note had no open reports or was deleted)
 * and, when this call hid the note, its author.
 */
export async function resolveReports(
  noteId: number,
  adminId: number,
  outcome: 'dismiss' | 'hide',
  remark: string,
): Promise<{ resolved: number; hiddenAuthorId: number | null }> {
  return inTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE "REPORT_T"
       SET rpt_status = $2, rpt_resolved_by = $3, rpt_remark = $4, rpt_resolved_at = NOW()
       WHERE rpt_pst_id = $1 AND rpt_status = 'open'
         AND EXISTS (SELECT 1 FROM "POST_T" WHERE pst_id = $1 AND pst_status <> 'deleted')`,
      [noteId, outcome === 'hide' ? 'upheld' : 'dismissed', adminId, remark],
    );
    if (!rowCount || outcome !== 'hide') return { resolved: rowCount ?? 0, hiddenAuthorId: null };
    const { rows } = await client.query<{ authorId: number }>(
      `UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1 AND pst_status = 'published' RETURNING pst_usr_id AS "authorId"`,
      [noteId],
    );
    return { resolved: rowCount, hiddenAuthorId: rows[0]?.authorId ?? null };
  });
}

export interface AdminUserRow {
  id: number;
  displayName: string;
  email: string;
  role: Role;
  status: UserStatus;
  lecturerStatus: LecturerStatus | null;
  upheldReports: number;
  createdAt: Date;
}

const ADMIN_USER_COLS = `u.usr_id AS "id", u.usr_display_name AS "displayName", u.usr_email AS "email", u.usr_role AS "role",
            u.usr_status AS "status", u.usr_lecturer_status AS "lecturerStatus", u.usr_created_at AS "createdAt",
            (SELECT COUNT(*)::INT FROM "REPORT_T" r JOIN "POST_T" rp ON rp.pst_id = r.rpt_pst_id
             WHERE rp.pst_usr_id = u.usr_id AND r.rpt_status = 'upheld') AS "upheldReports"`;

// shortcut: first 50 matches only; add paging if the user base outgrows a search box.
export async function searchUsers(q: string): Promise<AdminUserRow[]> {
  const { rows } = await pool.query<AdminUserRow>(
    `SELECT ${ADMIN_USER_COLS}
     FROM "USER_T" u
     WHERE STRPOS(LOWER(u.usr_display_name), LOWER($1)) > 0 OR STRPOS(LOWER(u.usr_email), LOWER($1)) > 0
     ORDER BY LOWER(u.usr_display_name), u.usr_id
     LIMIT 50`,
    [q],
  );
  return rows;
}

export type AccountAction = 'restrict' | 'suspend' | 'reinstate' | 'delete';
const NEW_STATUS: Record<AccountAction, UserStatus> = {
  restrict: 'restricted',
  suspend: 'suspended',
  reinstate: 'active',
  delete: 'deleted',
};

/**
 * Applies an account action and logs it in "ACCOUNT_ACTION_T" in one transaction (UC21). Delete also anonymises the
 * profile (the row stays for foreign keys), hides the user's published notes and removes their follows both ways (D38). Returns the updated user, or a reason
 * it was refused: unknown user, administrator target, or an already deleted account.
 */
export async function applyAccountAction(
  userId: number,
  adminId: number,
  action: AccountAction,
  reason: string,
): Promise<AdminUserRow | 'not_found' | 'admin' | 'deleted'> {
  return inTransaction(async (client) => {
    const {
      rows: [target],
    } = await client.query<{ usr_role: Role; usr_status: UserStatus }>(
      `SELECT usr_role, usr_status FROM "USER_T" WHERE usr_id = $1 FOR UPDATE`,
      [userId],
    );
    if (!target) return 'not_found';
    if (target.usr_role === 'admin') return 'admin';
    if (target.usr_status === 'deleted') return 'deleted';
    if (action === 'delete') {
      await client.query(
        `UPDATE "USER_T"
         SET usr_status = 'deleted', usr_display_name = 'Deleted user', usr_email = 'deleted-' || usr_id || '@invalid',
             usr_bio = NULL, usr_avatar_url = NULL, usr_staff_id = NULL, usr_programme = NULL, usr_lecturer_status = NULL
         WHERE usr_id = $1`,
        [userId],
      );
      // shortcut: a note published in a concurrent request just after this UPDATE stays visible (the deleted user's token
      // is refused from the next request); lock the user's posts first if that race ever matters.
      await client.query(
        `UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_usr_id = $1 AND pst_status = 'published'`,
        [userId],
      );
      await client.query(`DELETE FROM "FOLLOW_T" WHERE fol_follower_id = $1 OR fol_followee_id = $1`, [userId]);
    } else {
      await client.query(`UPDATE "USER_T" SET usr_status = $2 WHERE usr_id = $1`, [userId, NEW_STATUS[action]]);
    }
    await client.query(
      `INSERT INTO "ACCOUNT_ACTION_T" (aac_usr_id, aac_admin_id, aac_action, aac_reason) VALUES ($1, $2, $3, $4)`,
      [userId, adminId, action, reason],
    );
    const { rows } = await client.query<AdminUserRow>(`SELECT ${ADMIN_USER_COLS} FROM "USER_T" u WHERE u.usr_id = $1`, [
      userId,
    ]);
    return rows[0];
  });
}
