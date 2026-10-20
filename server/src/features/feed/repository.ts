import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { pool } from '../../lib/pool';
import {
  CREDITED_EDITOR,
  ENGAGEMENT_COLS,
  noteCols,
  NOTE_FROM,
  VISIBLE,
  type NoteWithEngagement,
} from '../notes/repository';
import { assetRefs } from '../notes/service';
import { follows } from '../users/repository';
import { RANKING } from '../ranking/config';
import type { Components } from '../ranking/service';

/** The feed cutoff comes from the database clock, the same one that stamps pst_published_at (D22); a future asOf is capped at now (D30). */
export async function getCutoff(asOf: Date | null): Promise<Date> {
  return (await pool.query<{ t: Date }>(`SELECT LEAST(COALESCE($1::TIMESTAMPTZ, NOW()), NOW()) AS "t"`, [asOf])).rows[0]
    .t;
}

/** Slides a feed card carries: the visible one and the hidden neighbour the carousel preloads; the client fetches the rest on demand (D71). */
const CARD_SLIDES = 2;
const CARD_COLS = noteCols(CARD_SLIDES);

/** Keeps only the assets the loaded slides reference, so a card does not carry the files of slides it does not have (D71). */
function trimAssets(note: NoteWithEngagement): NoteWithEngagement {
  if (note.slides.length >= note.slideCount) return note;
  const used = new Set(assetRefs(note.slides as Parameters<typeof assetRefs>[0]).map((r) => String(r.id)));
  const pick = <T>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([id]) => used.has(id)));
  return { ...note, assets: pick(note.assets), videoStatus: pick(note.videoStatus) };
}

/** Published notes only: VISIBLE lets an author see their own hidden note, which a later page must not show. */
export async function getNotesByIds(viewerId: number, ids: number[]): Promise<NoteWithEngagement[]> {
  const { rows } = await pool.query<NoteWithEngagement>(
    `SELECT ${CARD_COLS}, ${ENGAGEMENT_COLS} ${NOTE_FROM} WHERE p.pst_id = ANY($2::INT[]) AND p.pst_status = 'published' AND ${VISIBLE}`,
    [viewerId, ids],
  );
  return rows.map(trimAssets);
}

/** One page of visible published notes by authors the viewer follows or co-authored by them (an edit collaborator who has saved it, R30, D46), published by the cutoff, newest first; keyset on (published_at, id), D38. */
export async function getFollowingNotes(
  viewerId: number,
  cutoff: Date,
  { cursor, limit }: KeysetPage,
): Promise<{ items: NoteWithEngagement[]; nextCursor: string | null }> {
  const { rows } = await pool.query<NoteWithEngagement & { cursor: string }>(
    `SELECT ${CARD_COLS}, ${ENGAGEMENT_COLS}, ${micros('p.pst_published_at')} || '_' || p.pst_id AS "cursor" ${NOTE_FROM}
     WHERE p.pst_status = 'published' AND p.pst_published_at <= $2::TIMESTAMPTZ AND ${VISIBLE}
       AND (${follows('$1', 'p.pst_usr_id')}
            OR EXISTS (SELECT 1 FROM "COLLABORATOR_T" c WHERE c.clb_pst_id = p.pst_id AND ${CREDITED_EDITOR}
                       AND ${follows('$1', 'c.clb_usr_id')}))
       AND ($3::BIGINT IS NULL OR (p.pst_published_at, p.pst_id) < (${fromMicros('$3')}, $4::INT))
     ORDER BY p.pst_published_at DESC, p.pst_id DESC
     LIMIT $5`,
    [viewerId, cutoff, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  const page = toPage(rows, limit);
  return { ...page, items: page.items.map(trimAssets) };
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
    [
      viewerId,
      asOf,
      ranked.map((r) => r.id),
      ranked.map(({ score, components: c }) => [score, c.E, c.R, c.V, c.M]),
      RANKING.snapshotTtlHours,
      RANKING.snapshotsPerViewer - 1,
    ],
  );
}

/** Entries from..to-1 (0-based) of the stored ranking and its length; undefined when no snapshot exists for this asOf. */
export async function readSnapshot(
  viewerId: number,
  asOf: Date,
  from: number,
  to: number,
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
