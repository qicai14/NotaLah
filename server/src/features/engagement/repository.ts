import { pool } from '../../lib/pool';
import { approvedLecturer } from '../users/repository';
import { VISIBLE, SUMMARY_COLS, type NoteSummary } from '../notes/repository';

/** A repeat view by the same user of the same note within this window is not logged again (D22). */
const VIEW_WINDOW_MINUTES = 30;

// ---- Engagement targets ----------------------------------------------------------------------

export interface Target {
  authorId: number;
  slideCount: number;
}

/** Engagement needs a published note the viewer may see; undefined otherwise (callers answer 404). */
export async function getTarget(noteId: number, viewerId: number): Promise<Target | undefined> {
  const { rows } = await pool.query<Target>(
    `SELECT p.pst_usr_id AS "authorId",
            (SELECT COUNT(*)::INT FROM "SLIDE_T" WHERE sld_pst_id = p.pst_id) AS "slideCount"
     FROM "POST_T" p WHERE p.pst_id = $2 AND p.pst_status = 'published' AND ${VISIBLE}`,
    [viewerId, noteId],
  );
  return rows[0];
}

/** Records a view unless this user already viewed the note within the window. */
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

// ---- Likes -----------------------------------------------------------------------------------

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

// ---- Comments --------------------------------------------------------------------------------

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

/** Top-level comments with replies: approved-lecturer comments first, then most liked, then oldest (ENG-TC7). */
export async function listComments(noteId: number, viewerId: number): Promise<Comment[]> {
  const { rows } = await pool.query<CommentRow>(
    `SELECT c.cmt_id AS "id", c.cmt_parent_id AS "parentId", c.cmt_slide_no AS "slideNo",
            CASE WHEN c.cmt_is_deleted THEN '[deleted]' ELSE c.cmt_body END AS "body",
            c.cmt_is_deleted AS "deleted", c.cmt_created_at AS "createdAt",
            CASE WHEN c.cmt_is_deleted THEN NULL
                 ELSE json_build_object('id', u.usr_id, 'displayName', u.usr_display_name,
                        'isVerifiedLecturer', ${approvedLecturer('u')}) END AS "author",
            (SELECT COUNT(*)::INT FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = c.cmt_id) AS "likes",
            EXISTS (SELECT 1 FROM "COMMENT_LIKE_T" WHERE clk_cmt_id = c.cmt_id AND clk_usr_id = $1) AS "likedByMe"
     FROM "COMMENT_T" c JOIN "USER_T" u ON u.usr_id = c.cmt_usr_id
     WHERE c.cmt_pst_id = $2
     ORDER BY c.cmt_created_at, c.cmt_id`,
    [viewerId, noteId],
  );
  const replies = new Map<number, Reply[]>();
  for (const { parentId, deleted, ...r } of rows) {
    if (parentId === null || deleted) continue; // deleted replies are omitted; a reply has no replies of its own
    replies.set(parentId, [...(replies.get(parentId) ?? []), r]);
  }
  const top: Comment[] = [];
  for (const { parentId, deleted, ...r } of rows) {
    if (parentId !== null) continue;
    const kids = replies.get(r.id) ?? [];
    if (deleted && kids.length === 0) continue;
    top.push({ ...r, pinned: r.author?.isVerifiedLecturer ?? false, replies: kids });
  }
  return top.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.likes - a.likes); // stable: ties stay oldest first
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

// ---- Reports and bookmarks -------------------------------------------------------------------

/** Returns false when the user already has an open report on the note (partial unique index, SQLSTATE 23505). */
export async function addReport(noteId: number, reporterId: number, reason: string, details: string | null): Promise<boolean> {
  try {
    await pool.query(
      `INSERT INTO "REPORT_T" (rpt_pst_id, rpt_reporter_id, rpt_reason, rpt_details) VALUES ($1, $2, $3, $4)`,
      [noteId, reporterId, reason, details],
    );
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === '23505') return false;
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

/** Saved notes the viewer can still see, newest saved first. */
export async function listBookmarks(userId: number): Promise<SavedNote[]> {
  const { rows } = await pool.query<SavedNote>(
    `SELECT ${SUMMARY_COLS}, b.bmk_created_at AS "savedAt"
     FROM "BOOKMARK_T" b JOIN "POST_T" p ON p.pst_id = b.bmk_pst_id
          LEFT JOIN "MODULE_T" m ON m.mod_id = p.pst_mod_id
     WHERE b.bmk_usr_id = $1 AND p.pst_status = 'published' AND ${VISIBLE}
     ORDER BY b.bmk_created_at DESC, p.pst_id DESC`,
    [userId],
  );
  return rows;
}
