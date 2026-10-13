import { pool } from '../../lib/pool';
import { approvedLecturer } from '../users/repository';
import { ENGAGEMENT_COLS, HASHTAGS_COL, VISIBLE } from '../notes/repository';
import { RANKING } from './config';
import type { Candidate, InteractionRow } from './service';

export interface CandidateRow extends Candidate {
  id: number;
}

/**
 * The most recent `candidateLimit` published notes the viewer may see, published at or before asOf,
 * with only what scoring needs; the page's full notes are loaded afterwards (D24).
 */
export async function getCandidates(viewerId: number, asOf: Date): Promise<CandidateRow[]> {
  const { rows } = await pool.query<CandidateRow>(
    `SELECT p.pst_id AS "id", p.pst_published_at AS "publishedAt", ${HASHTAGS_COL},
            ${approvedLecturer('u')} AS "lecturerAuthor", ${ENGAGEMENT_COLS}
     FROM "POST_T" p JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
     WHERE p.pst_status = 'published' AND p.pst_published_at <= $2::TIMESTAMPTZ AND ${VISIBLE}
     ORDER BY p.pst_published_at DESC, p.pst_id DESC
     LIMIT $3`,
    [viewerId, asOf, RANKING.candidateLimit],
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
