import type { PoolClient } from 'pg';
import { inTransaction, pool } from '../../lib/pool';
import { approvedLecturer, countingLecturer, friends } from '../users/repository';
import type { NoteInput } from './service';

interface ModuleRow {
  id: number;
  code: string;
  name: string;
  programme: string;
}

export async function listModules(): Promise<ModuleRow[]> {
  const { rows } = await pool.query<ModuleRow>(
    `SELECT mod_id AS "id", mod_code AS "code", mod_name AS "name", mod_programme AS "programme"
     FROM "MODULE_T" ORDER BY mod_code`,
  );
  return rows;
}

export async function moduleExists(id: number): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM "MODULE_T" WHERE mod_id = $1`, [id]);
  return rowCount === 1;
}

/** Exported SQL fragment (contract: alias p = POST_T, $1 = viewer id). Who may see a post ($1 = viewer id): the author, or a published post by an active or restricted account (a suspension withdraws the content until reinstated, D26) that is public or, when contacts-only, by a friend of the viewer (mutual follow, D36). */
export const VISIBLE = `(p.pst_status <> 'deleted' AND (p.pst_usr_id = $1 OR (p.pst_status = 'published'
    AND EXISTS (SELECT 1 FROM "USER_T" pa WHERE pa.usr_id = p.pst_usr_id AND pa.usr_status IN ('active', 'restricted')) AND
    (p.pst_visibility = 'public' OR ${friends('$1', 'p.pst_usr_id')}))))`;

/** The note's hashtag names, alphabetical (alias p = POST_T). */
export const HASHTAGS_COL = `COALESCE((SELECT json_agg(h.hsh_name ORDER BY h.hsh_name)
                   FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                   WHERE ph.phs_pst_id = p.pst_id), '[]'::JSON) AS "hashtags"`;

export interface Note {
  id: number;
  title: string;
  template: string;
  status: string;
  visibility: string | null;
  module: { id: number; code: string; name: string } | null;
  hashtags: string[];
  slides: { position: number; content: string }[];
  author: { id: number; displayName: string; role: string; isVerifiedLecturer: boolean };
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

/** Note columns (contract: alias p = POST_T; use with NOTE_FROM). */
export const NOTE_COLS = `p.pst_id AS "id", p.pst_title AS "title", p.pst_template AS "template", p.pst_status AS "status",
         p.pst_visibility AS "visibility",
         CASE WHEN m.mod_id IS NULL THEN NULL
              ELSE json_build_object('id', m.mod_id, 'code', m.mod_code, 'name', m.mod_name) END AS "module",
         ${HASHTAGS_COL},
         COALESCE((SELECT json_agg(json_build_object('position', s.sld_position, 'content', s.sld_content)
                                   ORDER BY s.sld_position)
                   FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id), '[]'::JSON) AS "slides",
         json_build_object('id', u.usr_id, 'displayName', u.usr_display_name, 'role', u.usr_role,
                           'isVerifiedLecturer', ${approvedLecturer('u')}) AS "author",
         p.pst_created_at AS "createdAt", p.pst_updated_at AS "updatedAt", p.pst_published_at AS "publishedAt"`;

/** FROM clause defining the aliases p, u and m that NOTE_COLS uses. */
export const NOTE_FROM = `
  FROM "POST_T" p
  JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
  LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id`;

/** Super Likes that count (alias v): by an approved lecturer whose account is active or restricted (D24). Ends in a WHERE clause, so callers append AND conditions. */
export const VALID_VERIFICATIONS = `FROM "VERIFICATION_T" v JOIN "USER_T" vu ON vu.usr_id = v.ver_usr_id WHERE ${countingLecturer('vu')}`;

export const VERIFIED = `EXISTS (SELECT 1 ${VALID_VERIFICATIONS} AND v.ver_pst_id = p.pst_id)`;

/** Display name of the earliest valid verifier of note p, or NULL (FR2 "Verified by"). */
export const VERIFIED_BY = `(SELECT vu.usr_display_name ${VALID_VERIFICATIONS} AND v.ver_pst_id = p.pst_id ORDER BY v.ver_created_at, v.ver_id LIMIT 1)`;

/** Like and comment counts of note p (the author's own comments are not counted, D22); with `asOf` (an SQL expression), only rows created by then, for the ranking snapshot (D24). */
export const countsCol = (asOf?: string) => `json_build_object(
              'likes', (SELECT COUNT(*)::INT FROM "LIKE_T" WHERE lik_pst_id = p.pst_id${asOf ? ` AND lik_created_at <= ${asOf}` : ''}),
              'comments', (SELECT COUNT(*)::INT FROM "COMMENT_T" WHERE cmt_pst_id = p.pst_id AND NOT cmt_is_deleted
                           AND cmt_usr_id <> p.pst_usr_id${asOf ? ` AND cmt_created_at <= ${asOf}` : ''})) AS "counts"`;

/** Engagement columns (alias p; $1 = viewer id; the author's own comments are not counted, D22; `verified`/`verifiedBy` per VERIFIED, `verifiedByMe` = the viewer's own Super Like) shared by the feed and the note detail so the counts exist once. */
export const ENGAGEMENT_COLS = `${countsCol()},
            EXISTS (SELECT 1 FROM "LIKE_T" WHERE lik_pst_id = p.pst_id AND lik_usr_id = $1) AS "liked",
            EXISTS (SELECT 1 FROM "BOOKMARK_T" WHERE bmk_pst_id = p.pst_id AND bmk_usr_id = $1) AS "bookmarked",
            ${VERIFIED} AS "verified", ${VERIFIED_BY} AS "verifiedBy",
            EXISTS (SELECT 1 FROM "VERIFICATION_T" WHERE ver_pst_id = p.pst_id AND ver_usr_id = $1) AS "verifiedByMe"`;

export interface NoteWithEngagement extends Note {
  counts: { likes: number; comments: number };
  liked: boolean;
  bookmarked: boolean;
  verified: boolean;
  verifiedBy: string | null;
  verifiedByMe: boolean;
}

/** The note as the API returns it, or undefined when it does not exist or the viewer may not see it. */
export async function getVisibleNote(id: number, viewerId: number): Promise<NoteWithEngagement | undefined> {
  const { rows } = await pool.query<NoteWithEngagement>(
    `SELECT ${NOTE_COLS}, ${ENGAGEMENT_COLS} ${NOTE_FROM} WHERE p.pst_id = $2 AND ${VISIBLE}`,
    [viewerId, id],
  );
  return rows[0];
}

export interface DraftSummary {
  id: number;
  title: string;
  module: { id: number; code: string; name: string } | null;
  hashtags: string[];
  updatedAt: Date;
}

export async function listDrafts(authorId: number): Promise<DraftSummary[]> {
  const { rows } = await pool.query<DraftSummary>(
    `SELECT p.pst_id AS "id", p.pst_title AS "title",
            CASE WHEN m.mod_id IS NULL THEN NULL
                 ELSE json_build_object('id', m.mod_id, 'code', m.mod_code, 'name', m.mod_name) END AS "module",
            ${HASHTAGS_COL},
            p.pst_updated_at AS "updatedAt"
     FROM "POST_T" p LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE p.pst_usr_id = $1 AND p.pst_status = 'draft'
     ORDER BY p.pst_updated_at DESC, p.pst_id DESC`,
    [authorId],
  );
  return rows;
}

export interface NoteMeta {
  authorId: number;
  status: string;
  visible: boolean;
}

/** Ownership/status of a note plus whether the viewer may see it; undefined if it does not exist or is deleted. */
export async function getNoteMeta(id: number, viewerId: number): Promise<NoteMeta | undefined> {
  const { rows } = await pool.query<NoteMeta>(
    `SELECT p.pst_usr_id AS "authorId", p.pst_status AS "status", ${VISIBLE} AS "visible"
     FROM "POST_T" p WHERE p.pst_id = $2 AND p.pst_status <> 'deleted'`,
    [viewerId, id],
  );
  return rows[0];
}

async function writeChildren(client: PoolClient, postId: number, n: NoteInput): Promise<void> {
  const tags = [...n.hashtags].sort(); // fixed order avoids deadlocks between concurrent upserts
  await client.query(`DELETE FROM "SLIDE_T" WHERE sld_pst_id = $1`, [postId]);
  await client.query(`DELETE FROM "POST_HASHTAG_T" WHERE phs_pst_id = $1`, [postId]);
  if (n.slides.length > 0) {
    await client.query(
      `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_content)
       SELECT $1, t.ord, t.content FROM unnest($2::TEXT[]) WITH ORDINALITY AS t(content, ord)`,
      [postId, n.slides],
    );
  }
  if (tags.length > 0) {
    await client.query(
      `INSERT INTO "HASHTAG_T" (hsh_name) SELECT unnest($1::TEXT[]) ON CONFLICT (hsh_name) DO NOTHING`,
      [tags],
    );
    await client.query(
      `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
       SELECT $1, hsh_id FROM "HASHTAG_T" WHERE hsh_name = ANY($2::TEXT[])`,
      [postId, tags],
    );
  }
  // Search document is rebuilt in SQL from title, slide text without tags, and hashtags (D20).
  await client.query(
    `UPDATE "POST_T" p
     SET pst_search_doc = to_tsvector('english',
           p.pst_title || ' '
           || COALESCE((SELECT string_agg(regexp_replace(s.sld_content, '<[^>]*>', ' ', 'g'), ' ' ORDER BY s.sld_position)
                        FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id), '') || ' '
           || COALESCE((SELECT string_agg(h.hsh_name, ' ')
                        FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                        WHERE ph.phs_pst_id = p.pst_id), '')),
         pst_updated_at = NOW()
     WHERE p.pst_id = $1`,
    [postId],
  );
}

export function createNote(authorId: number, n: NoteInput): Promise<number> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{ pst_id: number }>(
      `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_template, pst_status, pst_visibility, pst_published_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5::VARCHAR = 'published' THEN NOW() END)
       RETURNING pst_id`,
      [authorId, n.moduleId, n.title, n.template, n.status, n.visibility],
    );
    await writeChildren(c, rows[0].pst_id, n);
    return rows[0].pst_id;
  });
}

export function replaceNote(id: number, n: NoteInput): Promise<boolean> {
  return inTransaction(async (c) => {
    const { rowCount } = await c.query(
      `UPDATE "POST_T"
       SET pst_mod_id = $2, pst_title = $3, pst_template = $4, pst_status = $5, pst_visibility = $6,
           pst_published_at = CASE WHEN $5::VARCHAR = 'published' THEN COALESCE(pst_published_at, NOW()) ELSE pst_published_at END
       WHERE pst_id = $1 AND pst_status IN ('draft', 'published')`,
      [id, n.moduleId, n.title, n.template, n.status, n.visibility],
    );
    if (rowCount === 0) return false; // deleted or hidden since the permission check
    await writeChildren(c, id, n);
    return true;
  });
}

export async function softDeleteNote(id: number): Promise<void> {
  await pool.query(`UPDATE "POST_T" SET pst_status = 'deleted', pst_updated_at = NOW() WHERE pst_id = $1 AND pst_status <> 'deleted'`, [id]);
}

export interface NoteSummary {
  id: number;
  title: string;
  moduleCode: string | null;
  publishedAt: Date | null;
  hashtags: string[];
  verifiedBy: string | null;
}

/** Columns of a note summary (needs the POST_T alias p and MODULE_T alias m); verifiedBy is null when unverified. */
export const SUMMARY_COLS = `p.pst_id AS "id", p.pst_title AS "title", m.mod_code AS "moduleCode", p.pst_published_at AS "publishedAt",
            ${HASHTAGS_COL}, ${VERIFIED_BY} AS "verifiedBy"`;

/** An author's published notes that the viewer may see, newest first. */
export async function listNotesByAuthor(authorId: number, viewerId: number): Promise<NoteSummary[]> {
  const { rows } = await pool.query<NoteSummary>(
    `SELECT ${SUMMARY_COLS}
     FROM "POST_T" p LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE p.pst_usr_id = $2 AND p.pst_status = 'published' AND ${VISIBLE}
     ORDER BY p.pst_published_at DESC, p.pst_id DESC`,
    [viewerId, authorId],
  );
  return rows;
}

export async function countDrafts(authorId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM "POST_T" WHERE pst_usr_id = $1 AND pst_status = 'draft'`,
    [authorId],
  );
  return Number(rows[0].n);
}
