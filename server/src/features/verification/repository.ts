import { pool } from '../../lib/pool';
import { VERIFIED, VERIFIED_BY, VISIBLE } from '../notes/repository';

export interface Verification {
  verifiedBy: string;
  verifiedAt: Date;
  remark: string | null;
}

/**
 * Stores the lecturer's Super Like once (UC19); `added` is false when it already existed, which is then returned unchanged,
 * except that a Super Like older than the note's last content edit is re-confirmed by moving its time to now (R30).
 */
export async function addVerification(
  noteId: number, lecturerId: number, remark: string | null,
): Promise<{ added: boolean; verification: Verification }> {
  const inserted = await pool.query(
    `INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id, ver_remark) VALUES ($1, $2, $3)
     ON CONFLICT (ver_pst_id, ver_usr_id) DO NOTHING`,
    [noteId, lecturerId, remark],
  );
  if (inserted.rowCount === 0) {
    await pool.query(
      `UPDATE "VERIFICATION_T" v SET ver_created_at = NOW(), ver_remark = COALESCE($3, v.ver_remark)
       FROM "POST_T" p
       WHERE v.ver_pst_id = $1 AND v.ver_usr_id = $2 AND p.pst_id = v.ver_pst_id AND v.ver_created_at < p.pst_content_edited_at`,
      [noteId, lecturerId, remark],
    );
  }
  const { rows } = await pool.query<Verification>(
    `SELECT u.usr_display_name AS "verifiedBy", v.ver_created_at AS "verifiedAt", v.ver_remark AS "remark"
     FROM "VERIFICATION_T" v JOIN "USER_T" u ON u.usr_id = v.ver_usr_id
     WHERE v.ver_pst_id = $1 AND v.ver_usr_id = $2`,
    [noteId, lecturerId],
  );
  return { added: inserted.rowCount === 1, verification: rows[0] };
}

/** Removes the lecturer's own Super Like and returns the note's verification state afterwards (another lecturer may still verify it); a note the lecturer can no longer see reports unverified so nothing leaks. */
export async function removeVerification(noteId: number, lecturerId: number): Promise<{ verified: boolean; verifiedBy: string | null }> {
  await pool.query(`DELETE FROM "VERIFICATION_T" WHERE ver_pst_id = $1 AND ver_usr_id = $2`, [noteId, lecturerId]);
  const { rows } = await pool.query<{ verified: boolean; verifiedBy: string | null }>(
    `SELECT ${VERIFIED} AS "verified", ${VERIFIED_BY} AS "verifiedBy" FROM "POST_T" p WHERE p.pst_id = $2 AND ${VISIBLE}`,
    [lecturerId, noteId],
  );
  return rows[0] ?? { verified: false, verifiedBy: null };
}
