import type { PoolClient } from 'pg';
import { pool } from '../../lib/pool';
import type { NoteInput } from './service';

export interface ModuleRow {
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

/** Who may see a post ($1 = viewer id): the author, or a published post that is public or from a contact. */
const VISIBLE = `(p.pst_status <> 'deleted' AND (p.pst_usr_id = $1 OR (p.pst_status = 'published' AND
    (p.pst_visibility = 'public' OR EXISTS (SELECT 1 FROM "CONTACT_T" c
       WHERE c.con_usr_id = p.pst_usr_id AND c.con_contact_id = $1)))))`;

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

const NOTE_SELECT = `
  SELECT p.pst_id AS "id", p.pst_title AS "title", p.pst_template AS "template", p.pst_status AS "status",
         p.pst_visibility AS "visibility",
         CASE WHEN m.mod_id IS NULL THEN NULL
              ELSE json_build_object('id', m.mod_id, 'code', m.mod_code, 'name', m.mod_name) END AS "module",
         COALESCE((SELECT json_agg(h.hsh_name ORDER BY h.hsh_name)
                   FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                   WHERE ph.phs_pst_id = p.pst_id), '[]'::json) AS "hashtags",
         COALESCE((SELECT json_agg(json_build_object('position', s.sld_position, 'content', s.sld_content)
                                   ORDER BY s.sld_position)
                   FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id), '[]'::json) AS "slides",
         json_build_object('id', u.usr_id, 'displayName', u.usr_display_name, 'role', u.usr_role,
                           'isVerifiedLecturer', (u.usr_role = 'lecturer' AND u.usr_lecturer_status = 'approved')) AS "author",
         p.pst_created_at AS "createdAt", p.pst_updated_at AS "updatedAt", p.pst_published_at AS "publishedAt"
  FROM "POST_T" p
  JOIN "USER_T" u ON u.usr_id = p.pst_usr_id
  LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id`;

/** The note as the API returns it, or undefined when it does not exist or the viewer may not see it. */
export async function getVisibleNote(id: number, viewerId: number): Promise<Note | undefined> {
  const { rows } = await pool.query<Note>(`${NOTE_SELECT} WHERE p.pst_id = $2 AND ${VISIBLE}`, [viewerId, id]);
  return rows[0];
}

export async function listDrafts(authorId: number): Promise<Note[]> {
  const { rows } = await pool.query<Note>(
    `${NOTE_SELECT} WHERE p.pst_usr_id = $1 AND p.pst_status = 'draft' ORDER BY p.pst_updated_at DESC, p.pst_id DESC`,
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
  await client.query(`DELETE FROM "SLIDE_T" WHERE sld_pst_id = $1`, [postId]);
  await client.query(`DELETE FROM "POST_HASHTAG_T" WHERE phs_pst_id = $1`, [postId]);
  if (n.slides.length > 0) {
    await client.query(
      `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_content)
       SELECT $1, t.ord, t.content FROM unnest($2::text[]) WITH ORDINALITY AS t(content, ord)`,
      [postId, n.slides],
    );
  }
  if (n.hashtags.length > 0) {
    await client.query(
      `INSERT INTO "HASHTAG_T" (hsh_name) SELECT unnest($1::text[]) ON CONFLICT (hsh_name) DO NOTHING`,
      [n.hashtags],
    );
    await client.query(
      `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
       SELECT $1, hsh_id FROM "HASHTAG_T" WHERE hsh_name = ANY($2::text[])`,
      [postId, n.hashtags],
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

async function inTransaction<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Inserts the post, its slides and hashtags in one transaction; returns the new id. */
export function createNote(authorId: number, n: NoteInput): Promise<number> {
  return inTransaction(async (c) => {
    const { rows } = await c.query<{ pst_id: number }>(
      `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_template, pst_status, pst_visibility, pst_published_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5::varchar = 'published' THEN NOW() END)
       RETURNING pst_id`,
      [authorId, n.moduleId, n.title, n.template, n.status, n.visibility],
    );
    await writeChildren(c, rows[0].pst_id, n);
    return rows[0].pst_id;
  });
}

/** Full replace of the post's fields, slides and hashtags in one transaction. */
export function replaceNote(id: number, n: NoteInput): Promise<void> {
  return inTransaction(async (c) => {
    await c.query(
      `UPDATE "POST_T"
       SET pst_mod_id = $2, pst_title = $3, pst_template = $4, pst_status = $5, pst_visibility = $6,
           pst_published_at = CASE WHEN $5::varchar = 'published' THEN COALESCE(pst_published_at, NOW()) ELSE pst_published_at END
       WHERE pst_id = $1`,
      [id, n.moduleId, n.title, n.template, n.status, n.visibility],
    );
    await writeChildren(c, id, n);
  });
}

export async function softDeleteNote(id: number): Promise<void> {
  await pool.query(`UPDATE "POST_T" SET pst_status = 'deleted', pst_updated_at = NOW() WHERE pst_id = $1`, [id]);
}

export interface NoteSummary {
  id: number;
  title: string;
  moduleCode: string | null;
  publishedAt: Date | null;
  hashtags: string[];
}

/** An author's published notes that the viewer may see, newest first. */
export async function listNotesByAuthor(authorId: number, viewerId: number): Promise<NoteSummary[]> {
  const { rows } = await pool.query<NoteSummary>(
    `SELECT p.pst_id AS "id", p.pst_title AS "title", m.mod_code AS "moduleCode", p.pst_published_at AS "publishedAt",
            COALESCE((SELECT json_agg(h.hsh_name ORDER BY h.hsh_name)
                      FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                      WHERE ph.phs_pst_id = p.pst_id), '[]'::json) AS "hashtags"
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
