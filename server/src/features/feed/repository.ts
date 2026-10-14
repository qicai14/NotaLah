import { pool } from '../../lib/pool';
import { ENGAGEMENT_COLS, NOTE_COLS, NOTE_FROM, VISIBLE, type NoteWithEngagement } from '../notes/repository';

/** The feed cutoff comes from the database clock, the same one that stamps pst_published_at (D22); a future asOf is capped at now (D30). */
export async function getCutoff(asOf: Date | null): Promise<Date> {
  return (await pool.query<{ t: Date }>(`SELECT LEAST(COALESCE($1::TIMESTAMPTZ, NOW()), NOW()) AS "t"`, [asOf])).rows[0].t;
}

export async function getNotesByIds(viewerId: number, ids: number[]): Promise<NoteWithEngagement[]> {
  const { rows } = await pool.query<NoteWithEngagement>(
    `SELECT ${NOTE_COLS}, ${ENGAGEMENT_COLS} ${NOTE_FROM} WHERE p.pst_id = ANY($2::INT[]) AND ${VISIBLE}`,
    [viewerId, ids],
  );
  return rows;
}
