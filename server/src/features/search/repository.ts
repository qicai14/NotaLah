import { type KeysetPage, toPage } from '../../lib/keyset';
import { pool } from '../../lib/pool';
import { VALID_VERIFICATIONS, VERIFIED, VISIBLE, countsCol } from '../notes/repository';
import { approvedLecturer, countingLecturer } from '../users/repository';
import { RANKING } from '../ranking/config';

export interface NoteFilters {
  /** 'any': authored or validly Super Liked by a counting lecturer; a number: by that lecturer. */
  lecturer: 'any' | number | null;
  /** Inclusive calendar dates (YYYY-MM-DD), read in campus time. */
  from: string | null;
  to: string | null;
  moduleId: number | null;
}

/** Every user is at APU, so date filters and terms mean Malaysian calendar days, not UTC ones. */
const CAMPUS_TIME_ZONE = 'Asia/Kuala_Lumpur';

/** User text as a LIKE pattern that matches it literally (backslash is the default LIKE escape). */
const literal = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export interface NoteMatch {
  id: number;
  publishedAt: Date;
  textRank: number;
  counts: { likes: number; comments: number };
  verified: boolean;
  lecturerAuthor: boolean;
}

/** `#tag` finds notes carrying exactly that hashtag (SRCH-TC4). */
const TAG_MATCH = `EXISTS (SELECT 1 FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                   WHERE ph.phs_pst_id = p.pst_id AND h.hsh_name = $2)`;

/** Title, slide text and hashtags through the GIN-indexed search document, or the note's module (CTE `mods`) by code, name or programme. */
const TEXT_MATCH = `(p.pst_search_doc @@ websearch_to_tsquery('english', $2) OR p.pst_mod_id = ANY (ARRAY(SELECT mod_id FROM mods)))`;

/**
 * Every published note viewer $1 may see that matches `q` and the filters, with only what ordering needs (D48). Suspended
 * authors' notes never match (VISIBLE). E's inputs are the ranking counts (no self-likes, D47), so search and feed agree.
 */
export async function matchNotes(viewerId: number, q: string, f: NoteFilters): Promise<NoteMatch[]> {
  const tag = q.startsWith('#') ? q.slice(1).toLowerCase() : null;
  const text = tag ?? q;
  const { rows } = await pool.query<NoteMatch>(
    `WITH mods AS (SELECT mod_id FROM "MODULE_T"
                   WHERE mod_code ILIKE $3 || '%' OR mod_name ILIKE '%' || $3 || '%' OR mod_programme ILIKE '%' || $3 || '%')
     SELECT p.pst_id AS "id", p.pst_published_at AS "publishedAt",
            ts_rank_cd(p.pst_search_doc, websearch_to_tsquery('english', $2), $4) AS "textRank",
            ${countsCol('NOW()')}, ${VERIFIED} AS "verified", ${countingLecturer('u')} AS "lecturerAuthor"
     FROM "POST_T" p JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
     WHERE p.pst_status = 'published' AND ${VISIBLE} AND ${tag === null ? TEXT_MATCH : TAG_MATCH}
       AND ($5::BOOLEAN IS NOT TRUE OR ${countingLecturer('u')} OR ${VERIFIED})
       AND ($6::INT IS NULL OR (p.pst_usr_id = $6 AND ${countingLecturer('u')})
            OR EXISTS (SELECT 1 ${VALID_VERIFICATIONS} AND v.ver_pst_id = p.pst_id AND v.ver_usr_id = $6))
       AND ($7::DATE IS NULL OR p.pst_published_at >= $7::DATE::TIMESTAMP AT TIME ZONE $9)
       AND ($8::DATE IS NULL OR p.pst_published_at < ($8::DATE + 1)::TIMESTAMP AT TIME ZONE $9)
       AND ($10::INT IS NULL OR p.pst_mod_id = $10)`,
    [viewerId, text, literal(text), RANKING.searchRankNormalization, f.lecturer === 'any',
     typeof f.lecturer === 'number' ? f.lecturer : null, f.from, f.to, CAMPUS_TIME_ZONE, f.moduleId],
  );
  return rows;
}

type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * One keyset page of `sql`'s rows ordered by text match then id. `sql` must select "id" and "match" (0 exact, 1 prefix,
 * 2 contains); its own placeholders are `params`, and the paging placeholders follow them.
 */
async function pageByMatch<T>(sql: string, params: unknown[], { cursor, limit }: KeysetPage): Promise<Page<T>> {
  const n = params.length;
  const { rows } = await pool.query<T & { match: number; cursor: string }>(
    `SELECT s.*, s."match" || '_' || s."id" AS "cursor" FROM (${sql}) s
     WHERE $${n + 1}::INT IS NULL OR (s."match", s."id") > ($${n + 1}::INT, $${n + 2}::INT)
     ORDER BY s."match", s."id"
     LIMIT $${n + 3}`,
    [...params, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  const page = toPage(rows, limit);
  return { ...page, items: page.items.map(({ match: _match, ...item }) => item as T) };
}

/** `lower` holds the term lowercased and `pattern` the term as a literal LIKE pattern (placeholders from termParams). */
const matchClass = (col: string, lower = '$2', pattern = '$3') =>
  `CASE WHEN LOWER(${col}) = ${lower} THEN 0 WHEN ${col} ILIKE ${pattern} || '%' THEN 1 ELSE 2 END`;
const termParams = (term: string) => [term.toLowerCase(), literal(term)];

export interface PersonResult {
  id: number;
  displayName: string;
  role: string;
  programme: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
}

/** Active and restricted accounts whose display name contains the term; suspended and deleted ones never appear (D47). */
export function searchPeople(term: string, page: KeysetPage): Promise<Page<PersonResult>> {
  return pageByMatch<PersonResult>(
    `SELECT u.usr_id AS "id", u.usr_display_name AS "displayName", u.usr_role AS "role", u.usr_programme AS "programme",
            u.usr_avatar_url AS "avatarUrl", ${approvedLecturer('u')} AS "isVerifiedLecturer",
            ${matchClass('u.usr_display_name', '$1', '$2')} AS "match"
     FROM "USER_T" u
     WHERE u.usr_status IN ('active', 'restricted') AND u.usr_display_name ILIKE '%' || $2 || '%'`,
    termParams(term), page,
  );
}

export interface HashtagResult {
  id: number;
  name: string;
  noteCount: number;
}

/** Hashtags containing the term that are on at least one published note the viewer can see, with that note count. */
export function searchHashtags(viewerId: number, term: string, page: KeysetPage): Promise<Page<HashtagResult>> {
  return pageByMatch<HashtagResult>(
    `SELECT h.hsh_id AS "id", h.hsh_name AS "name", COUNT(*)::INT AS "noteCount", ${matchClass('h.hsh_name')} AS "match"
     FROM "HASHTAG_T" h
     JOIN "POST_HASHTAG_T" ph ON ph.phs_hsh_id = h.hsh_id
     JOIN "POST_T" p ON p.pst_id = ph.phs_pst_id
     WHERE h.hsh_name ILIKE '%' || $3 || '%' AND p.pst_status = 'published' AND ${VISIBLE}
     GROUP BY h.hsh_id`,
    [viewerId, ...termParams(term)], page,
  );
}

export interface ModuleResult {
  id: number;
  code: string;
  name: string;
  programme: string;
  noteCount: number;
}

/** Modules whose code, name or programme contains the term; a code match ranks first. noteCount = published notes the viewer can see. */
export function searchModules(viewerId: number, term: string, page: KeysetPage): Promise<Page<ModuleResult>> {
  return pageByMatch<ModuleResult>(
    `SELECT m.mod_id AS "id", m.mod_code AS "code", m.mod_name AS "name", m.mod_programme AS "programme",
            (SELECT COUNT(*)::INT FROM "POST_T" p WHERE p.pst_mod_id = m.mod_id AND p.pst_status = 'published' AND ${VISIBLE}) AS "noteCount",
            ${matchClass('m.mod_code')} AS "match"
     FROM "MODULE_T" m
     WHERE m.mod_code ILIKE '%' || $3 || '%' OR m.mod_name ILIKE '%' || $3 || '%' OR m.mod_programme ILIKE '%' || $3 || '%'`,
    [viewerId, ...termParams(term)], page,
  );
}
