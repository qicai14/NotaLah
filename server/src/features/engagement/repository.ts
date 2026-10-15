import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { isUniqueViolation, pool } from '../../lib/pool';
import { approvedLecturer } from '../users/repository';
import { VISIBLE, SUMMARY_COLS, type NoteSummary } from '../notes/repository';

/** A repeat view by the same user of the same note within this window is not logged again (D22). */
const VIEW_WINDOW_MINUTES = 30;

export interface Target {
  authorId: number;
  slideCount: number;
  /** The viewer is an edit collaborator, so the note counts as their own for Super Likes (D46, D47). */
  isEditor: boolean;
}

/** Engagement needs a published note the viewer may see; undefined otherwise (callers answer 404). */
export async function getTarget(noteId: number, viewerId: number): Promise<Target | undefined> {
  const { rows } = await pool.query<Target>(
    `SELECT p.pst_usr_id AS "authorId",
            (SELECT COUNT(*)::INT FROM "SLIDE_T" WHERE sld_pst_id = p.pst_id) AS "slideCount",
            EXISTS (SELECT 1 FROM "COLLABORATOR_T" c WHERE c.clb_pst_id = p.pst_id AND c.clb_usr_id = $1 AND c.clb_role = 'edit') AS "isEditor"
     FROM "POST_T" p WHERE p.pst_id = $2 AND p.pst_status = 'published' AND ${VISIBLE}`,
    [viewerId, noteId],
  );
  return rows[0];
}

// shortcut: check-then-insert is not atomic, so two simultaneous views can both log; the client guards per mount (D22).
export async function logView(noteId: number, viewerId: number): Promise<void> {
  await pool.query(
    `INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type)
     SELECT $1, $2, 'view'
     WHERE NOT EXISTS (SELECT 1 FROM "INTERACTION_T"
                       WHERE int_usr_id = $1 AND int_pst_id = $2 AND int_type = 'view'
                         AND int_created_at > NOW() - make_interval(mins => $3))`,
    [viewerId, noteId, VIEW_WINDOW_MINUTES],
  );
}

const noteLikes = async (noteId: number): Promise<number> =>
  (await pool.query<{ n: number }>(`SELECT COUNT(*)::INT AS n FROM "LIKE_T" WHERE lik_pst_id = $1`, [noteId])).rows[0].n;

/** Idempotent: the interaction is logged only when the like row is new. */
export async function likeNote(noteId: number, userId: number): Promise<{ added: boolean; likes: number }> {
  const { rowCount } = await pool.query(
    `WITH ins AS (INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1)
     INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type) SELECT $1, $2, 'like' FROM ins`,
    [userId, noteId],
  );
  return { added: rowCount === 1, likes: await noteLikes(noteId) };
}

export async function unlikeNote(noteId: number, userId: number): Promise<number> {
  await pool.query(`DELETE FROM "LIKE_T" WHERE lik_usr_id = $1 AND lik_pst_id = $2`, [userId, noteId]);
  return noteLikes(noteId);
}

export interface CommentRow {
  id: number;
  parentId: number | null;
  slideNo: number | null;
  body: string;
  deleted: boolean;
  createdAt: Date;
  author: { id: number; displayName: string; isVerifiedLecturer: boolean } | null;
  likes: number;
  likedByMe: boolean;
}

type Reply = Omit<CommentRow, 'parentId' | 'deleted'>;

export interface Comment extends Reply {
  pinned: boolean;
  replies: Reply[];
}

/**
 * One page of top-level comments with their live replies: approved-lecturer comments first, then most liked, then oldest
 * (ENG-TC7). Keyset on (pinned, likes, created_at, id), D40; likes are live, so a comment liked between page requests can
 * cross the page boundary. A deleted comment shows as [deleted] only while it has live replies; deleted replies are omitted.
 */
// shortcut: replies are not paged; page them too if one thread ever grows to thousands of replies.
export async function listComments(
  noteId: number, viewerId: number, { cursor, limit }: KeysetPage,
): Promise<{ items: Comment[]; nextCursor: string | null }> {
  const { rows } = await pool.query<CommentRow & { cursor: string | null }>(
    `WITH top AS (
       SELECT c.cmt_id AS id, c.cmt_created_at AS at,
              CASE WHEN NOT c.cmt_is_deleted AND ${approvedLecturer('u')} THEN 0 ELSE 1 END AS unpinned,
              (SELECT COUNT(*)::INT FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = c.cmt_id) AS likes
       FROM "COMMENT_T" c JOIN "USER_T" u ON u.usr_id = c.cmt_usr_id
            -- LATERAL keeps the probe per deleted comment on comment_parent_idx; an OR-ed EXISTS is planned as a hash of every reply
            LEFT JOIN LATERAL (SELECT 1 AS live FROM "COMMENT_T" r
                               WHERE c.cmt_is_deleted AND r.cmt_parent_id = c.cmt_id AND NOT r.cmt_is_deleted LIMIT 1) lr ON TRUE
       WHERE c.cmt_pst_id = $2 AND c.cmt_parent_id IS NULL AND (NOT c.cmt_is_deleted OR lr.live IS NOT NULL)),
     pg AS (
       SELECT * FROM top
       WHERE $3::BIGINT IS NULL OR (unpinned, -likes, at, id) > ($3::BIGINT, -$4::BIGINT, ${fromMicros('$5')}, $6::INT)
       ORDER BY unpinned, likes DESC, at, id
       LIMIT $7)
     SELECT c.cmt_id AS "id", c.cmt_parent_id AS "parentId", c.cmt_slide_no AS "slideNo",
            CASE WHEN c.cmt_is_deleted THEN '[deleted]' ELSE c.cmt_body END AS "body",
            c.cmt_is_deleted AS "deleted", c.cmt_created_at AS "createdAt",
            CASE WHEN c.cmt_is_deleted THEN NULL
                 ELSE json_build_object('id', u.usr_id, 'displayName', u.usr_display_name,
                        'isVerifiedLecturer', ${approvedLecturer('u')}) END AS "author",
            (SELECT COUNT(*)::INT FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = c.cmt_id) AS "likes",
            EXISTS (SELECT 1 FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = c.cmt_id AND clk_usr_id = $1) AS "likedByMe",
            pg.unpinned || '_' || pg.likes || '_' || ${micros('pg.at')} || '_' || pg.id AS "cursor"
     FROM "COMMENT_T" c JOIN "USER_T" u ON u.usr_id = c.cmt_usr_id LEFT JOIN pg ON pg.id = c.cmt_id
     WHERE c.cmt_pst_id = $2 AND (pg.id IS NOT NULL OR (c.cmt_parent_id IN (SELECT id FROM pg) AND NOT c.cmt_is_deleted))
     ORDER BY pg.unpinned, pg.likes DESC, c.cmt_created_at, c.cmt_id`,
    [viewerId, noteId, ...(cursor ?? [null, null, null, null]), limit + 1],
  );
  const replies = new Map<number, Reply[]>();
  for (const { parentId, deleted: _deleted, cursor: _cursor, ...r } of rows) {
    if (parentId !== null) replies.set(parentId, [...(replies.get(parentId) ?? []), r]); // a reply has no replies of its own
  }
  const { items, nextCursor } = toPage(rows.filter((r) => r.parentId === null), limit);
  return {
    items: items.map(({ parentId: _parentId, deleted: _deleted, ...r }) => ({
      ...r, pinned: r.author?.isVerifiedLecturer ?? false, replies: replies.get(r.id) ?? [],
    })),
    nextCursor,
  };
}

export async function getParent(id: number): Promise<{ noteId: number; parentId: number | null } | undefined> {
  const { rows } = await pool.query<{ noteId: number; parentId: number | null }>(
    `SELECT cmt_pst_id AS "noteId", cmt_parent_id AS "parentId" FROM "COMMENT_T" WHERE cmt_id = $1 AND NOT cmt_is_deleted`,
    [id],
  );
  return rows[0];
}

export interface NewComment {
  body: string;
  slideNo: number | null;
  parentId: number | null;
}

export async function addComment(noteId: number, userId: number, c: NewComment): Promise<{ id: number; createdAt: Date }> {
  const { rows } = await pool.query<{ id: number; createdAt: Date }>(
    `WITH c AS (INSERT INTO "COMMENT_T" (cmt_pst_id, cmt_usr_id, cmt_parent_id, cmt_slide_no, cmt_body)
                VALUES ($1, $2, $3, $4, $5) RETURNING cmt_id, cmt_created_at),
          i AS (INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type) SELECT $2, $1, 'comment' FROM c
                WHERE $2 <> (SELECT pst_usr_id FROM "POST_T" WHERE pst_id = $1))
     SELECT cmt_id AS "id", cmt_created_at AS "createdAt" FROM c`,
    [noteId, userId, c.parentId, c.slideNo, c.body],
  );
  return rows[0];
}

export interface CommentMeta {
  authorId: number;
  noteId: number;
}

/** A live comment on a published note the viewer may see; undefined otherwise. */
export async function getVisibleComment(id: number, viewerId: number): Promise<CommentMeta | undefined> {
  const { rows } = await pool.query<CommentMeta>(
    `SELECT c.cmt_usr_id AS "authorId", c.cmt_pst_id AS "noteId"
     FROM "COMMENT_T" c JOIN "POST_T" p ON p.pst_id = c.cmt_pst_id
     WHERE c.cmt_id = $2 AND NOT c.cmt_is_deleted AND p.pst_status = 'published' AND ${VISIBLE}`,
    [viewerId, id],
  );
  return rows[0];
}

/** Owner-only soft delete; true when a live comment of this user was deleted (works even if the note is no longer visible). */
export async function softDeleteComment(id: number, userId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE "COMMENT_T" SET cmt_is_deleted = TRUE WHERE cmt_id = $1 AND cmt_usr_id = $2 AND NOT cmt_is_deleted`,
    [id, userId],
  );
  return rowCount === 1;
}

const commentLikes = async (id: number): Promise<number> =>
  (await pool.query<{ n: number }>(`SELECT COUNT(*)::INT AS n FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = $1`, [id])).rows[0].n;

export async function likeComment(id: number, userId: number): Promise<{ added: boolean; likes: number }> {
  const { rowCount } = await pool.query(
    `INSERT INTO "COMMENT_LIKE_T" (clk_usr_id, clk_cmt_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, id],
  );
  return { added: rowCount === 1, likes: await commentLikes(id) };
}

export async function unlikeComment(id: number, userId: number): Promise<number> {
  await pool.query(`DELETE FROM "COMMENT_LIKE_T" WHERE clk_usr_id = $1 AND clk_cmt_id = $2`, [userId, id]);
  return commentLikes(id);
}

/** Returns false when the user already has an open report on the note (partial unique index, SQLSTATE 23505). */
export async function addReport(noteId: number, reporterId: number, reason: string, details: string | null): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO "REPORT_T" (rpt_pst_id, rpt_reporter_id, rpt_reason, rpt_details) VALUES ($1, $2, $3, $4)`,
      [noteId, reporterId, reason, details],
    );
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

export async function addBookmark(noteId: number, userId: number): Promise<void> {
  await pool.query(`INSERT INTO "BOOKMARK_T" (bmk_usr_id, bmk_pst_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, noteId]);
}

export async function removeBookmark(noteId: number, userId: number): Promise<void> {
  await pool.query(`DELETE FROM "BOOKMARK_T" WHERE bmk_usr_id = $1 AND bmk_pst_id = $2`, [userId, noteId]);
}

export interface SavedNote extends NoteSummary {
  savedAt: Date;
}

/** One page of the user's saved notes, newest bookmark first; keyset on (saved at, note id), D40. */
export async function listBookmarks(userId: number, { cursor, limit }: KeysetPage): Promise<{ items: SavedNote[]; nextCursor: string | null }> {
  const { rows } = await pool.query<SavedNote & { cursor: string }>(
    `SELECT ${SUMMARY_COLS}, b.bmk_created_at AS "savedAt", ${micros('b.bmk_created_at')} || '_' || p.pst_id AS "cursor"
     FROM "BOOKMARK_T" b JOIN "POST_T" p ON p.pst_id = b.bmk_pst_id
          LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE b.bmk_usr_id = $1 AND p.pst_status = 'published' AND ${VISIBLE}
       AND ($2::BIGINT IS NULL OR (b.bmk_created_at, p.pst_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY b.bmk_created_at DESC, p.pst_id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}
