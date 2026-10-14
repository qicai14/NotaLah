import { pool } from '../../lib/pool';
import { countingLecturer } from '../users/repository';
import { HASHTAGS_COL, VALID_VERIFICATIONS, VISIBLE, countsCol } from '../notes/repository';
import { RANKING } from './config';
import type { Candidate, InteractionRow } from './service';

export interface CandidateRow extends Candidate {
  id: number;
}

/**
 * Published notes the viewer may see, published at or before asOf: the newest `limit` united with every note holding a
 * valid Super Like made within verifiedCandidateWindowDays before asOf, with only what scoring needs; the page's full notes are loaded afterwards (D24).
 * Likes, comments and Super Likes count only up to asOf, so one asOf always gives the same ranking (pages cannot skip
 * or repeat a note when engagement lands between page requests).
 */
// shortcut: an unverified note older than the newest `limit` is never ranked, however popular; widen if UAT shows misses.
export async function getCandidates(viewerId: number, asOf: Date, limit: number = RANKING.candidateLimit): Promise<CandidateRow[]> {
  const { rows } = await pool.query<CandidateRow>(
    `WITH newest AS (
       SELECT p.pst_id FROM "POST_T" p
       WHERE p.pst_status = 'published' AND p.pst_published_at <= $2::TIMESTAMPTZ AND ${VISIBLE}
       ORDER BY p.pst_published_at DESC, p.pst_id DESC
       LIMIT $3),
     verified AS (SELECT DISTINCT v.ver_pst_id AS pst_id ${VALID_VERIFICATIONS} AND v.ver_created_at <= $2::TIMESTAMPTZ
       AND v.ver_created_at > $2::TIMESTAMPTZ - make_interval(days => $4))
     SELECT p.pst_id AS "id", p.pst_published_at AS "publishedAt", ${HASHTAGS_COL},
            ${countingLecturer('u')} AS "lecturerAuthor", ${countsCol('$2::TIMESTAMPTZ')},
            p.pst_id IN (SELECT pst_id FROM verified) AS "verified"
     FROM (SELECT pst_id FROM newest UNION SELECT pst_id FROM verified) ids
     JOIN "POST_T" p ON p.pst_id = ids.pst_id
     JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
     WHERE p.pst_status = 'published' AND p.pst_published_at <= $2::TIMESTAMPTZ AND ${VISIBLE}`,
    [viewerId, asOf, limit, RANKING.verifiedCandidateWindowDays],
  );
  return rows;
}

/** One row per (interaction, hashtag of its post) for the viewer within the interest window before asOf. */
export async function getInteractionRows(viewerId: number, asOf: Date): Promise<InteractionRow[]> {
  const { rows } = await pool.query<InteractionRow>(
    `SELECT i.int_type AS "type", i.int_created_at AS "createdAt", h.hsh_name AS "hashtag"
     FROM "INTERACTION_T" i
     JOIN "POST_HASHTAG_T" ph ON ph.phs_pst_id = i.int_pst_id
     JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
     WHERE i.int_usr_id = $1 AND i.int_created_at <= $2::TIMESTAMPTZ
       AND i.int_created_at > $2::TIMESTAMPTZ - make_interval(days => $3)`,
    [viewerId, asOf, RANKING.interestWindowDays],
  );
  return rows;
}
