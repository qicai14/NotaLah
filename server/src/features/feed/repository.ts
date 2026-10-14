import { pool } from '../../lib/pool';
import { ENGAGEMENT_COLS, NOTE_COLS, NOTE_FROM, VISIBLE, type NoteWithEngagement } from '../notes/repository';
import { follows } from '../users/repository';
import { RANKING } from '../ranking/config';
import type { Components } from '../ranking/service';

/** The feed cutoff comes from the database clock, the same one that stamps pst_published_at (D22); a future asOf is capped at now (D30). */
export async function getCutoff(asOf: Date | null): Promise<Date> {
  return (await pool.query<{ t: Date }>(`SELECT LEAST(COALESCE($1::TIMESTAMPTZ, NOW()), NOW()) AS "t"`, [asOf])).rows[0].t;
}

/** Published notes only: VISIBLE lets an author see their own hidden note, which a later page must not show. */
export async function getNotesByIds(viewerId: number, ids: number[]): Promise<NoteWithEngagement[]> {
  const { rows } = await pool.query<NoteWithEngagement>(
    `SELECT ${NOTE_COLS}, ${ENGAGEMENT_COLS} ${NOTE_FROM} WHERE p.pst_id = ANY($2::INT[]) AND p.pst_status = 'published' AND ${VISIBLE}`,
    [viewerId, ids],
  );
  return rows;
}

/** Visible published notes by authors the viewer follows, published by the cutoff, newest first (D38). */
export async function getFollowingNotes(viewerId: number, cutoff: Date, limit: number, offset: number): Promise<NoteWithEngagement[]> {
  const { rows } = await pool.query<NoteWithEngagement>(
    `SELECT ${NOTE_COLS}, ${ENGAGEMENT_COLS} ${NOTE_FROM}
     WHERE p.pst_status = 'published' AND p.pst_published_at <= $2::TIMESTAMPTZ AND ${follows('$1', 'p.pst_usr_id')} AND ${VISIBLE}
     ORDER BY p.pst_published_at DESC, p.pst_id DESC
     LIMIT $3 OFFSET $4`,
    [viewerId, cutoff, limit, offset],
  );
  return rows;
}

export interface RankedEntry {
  id: number;
  score: number;
  components: Components;
}

/** Stores the viewer's ranking for one asOf (one row of [score, E, R, V, M] per id) and drops their expired snapshots and all but the newest snapshotsPerViewer (D40). */
export async function saveSnapshot(viewerId: number, asOf: Date, ranked: RankedEntry[]): Promise<void> {
  await pool.query(
    `WITH expired AS (
       DELETE FROM "FEED_SNAPSHOT_T"
       WHERE fsn_usr_id = $1
         AND (fsn_created_at < NOW() - make_interval(hours => $5)
              OR fsn_as_of IN (SELECT fsn_as_of FROM "FEED_SNAPSHOT_T" WHERE fsn_usr_id = $1
                               ORDER BY fsn_created_at DESC, fsn_as_of DESC OFFSET $6)))
     INSERT INTO "FEED_SNAPSHOT_T" (fsn_usr_id, fsn_as_of, fsn_pst_ids, fsn_scores) VALUES ($1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [viewerId, asOf, ranked.map((r) => r.id), ranked.map(({ score, components: c }) => [score, c.E, c.R, c.V, c.M]),
     RANKING.snapshotTtlHours, RANKING.snapshotsPerViewer - 1],
  );
}

/** Entries from..to-1 (0-based) of the stored ranking and its length; undefined when no snapshot exists for this asOf. */
export async function readSnapshot(
  viewerId: number, asOf: Date, from: number, to: number,
): Promise<{ entries: RankedEntry[]; total: number } | undefined> {
  const { rows } = await pool.query<{ ids: number[]; scores: number[][]; total: number }>(
    `SELECT fsn_pst_ids[$3:$4] AS "ids", fsn_scores[$3:$4][1:5] AS "scores", cardinality(fsn_pst_ids) AS "total"
     FROM "FEED_SNAPSHOT_T" WHERE fsn_usr_id = $1 AND fsn_as_of = $2`,
    [viewerId, asOf, from + 1, to],
  );
  if (!rows[0]) return undefined;
  const { ids, scores, total } = rows[0];
  const entries = ids.map((id, i) => {
    const [score, E, R, V, M] = scores[i];
    return { id, score, components: { E, R, V, M } };
  });
  return { entries, total };
}

/** Deletes every feed snapshot past its TTL; run by the daily purge job (D34, D40). Idempotent. */
export async function purgeFeedSnapshots(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM "FEED_SNAPSHOT_T" WHERE fsn_created_at < NOW() - make_interval(hours => $1)`,
    [RANKING.snapshotTtlHours],
  );
  return rowCount ?? 0;
}
