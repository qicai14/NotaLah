import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { pool } from '../../lib/pool';
import { READABLE } from '../notes/repository';
import { blockedWith, friends, userRef } from '../users/repository';
import { NOTIFICATIONS } from './config';

export const NOTIFICATION_TYPES = [
  'mention',
  'super_like',
  'follow',
  'lecturer_approved',
  'lecturer_rejected',
  'note_hidden',
  'message_request',
  'collab_request',
  'collab_approved',
  'collab_declined',
  'edited_since_verification',
  'annotation',
  'annotation_hidden',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NewNotification {
  type: NotificationType;
  /** Who caused it; null for moderation outcomes, which do not name the admin. */
  actorId: number | null;
  noteId?: number;
  commentId?: number;
  collabRequestId?: number;
  messageRequestId?: number;
}

/**
 * Stores one notification per recipient and returns the stored rows (D51). A recipient is skipped when they are the
 * actor, not active or restricted (suspended and deleted accounts get nothing), in a block with the actor (D49), or
 * already got an identical notification within the type's `dedupeWindowMinutes`.
 */
export async function insertNotifications(
  n: NewNotification,
  recipientIds: number[],
): Promise<{ id: number; recipientId: number }[]> {
  const { rows } = await pool.query<{ id: number; recipientId: number }>(
    `INSERT INTO "NOTIFICATION_T" (ntf_usr_id, ntf_actor_id, ntf_type, ntf_pst_id, ntf_cmt_id, ntf_crq_id, ntf_mrq_id)
     SELECT u.usr_id, $2::INT, $3::VARCHAR, $4::INT, $5::INT, $6::INT, $7::INT
     FROM "USER_T" u
     WHERE u.usr_id = ANY($1::INT[]) AND u.usr_status IN ('active', 'restricted')
       AND u.usr_id IS DISTINCT FROM $2::INT AND NOT ${blockedWith('$2::INT', 'u.usr_id')}
       AND NOT EXISTS (SELECT 1 FROM "NOTIFICATION_T" d
                       WHERE d.ntf_usr_id = u.usr_id AND d.ntf_type = $3::VARCHAR AND d.ntf_actor_id IS NOT DISTINCT FROM $2::INT
                         AND d.ntf_pst_id IS NOT DISTINCT FROM $4::INT AND d.ntf_cmt_id IS NOT DISTINCT FROM $5::INT
                         AND d.ntf_crq_id IS NOT DISTINCT FROM $6::INT AND d.ntf_mrq_id IS NOT DISTINCT FROM $7::INT
                         AND d.ntf_created_at > NOW() - make_interval(mins => $8))
     RETURNING ntf_id AS "id", ntf_usr_id AS "recipientId"`,
    [
      [...new Set(recipientIds)],
      n.actorId,
      n.type,
      n.noteId ?? null,
      n.commentId ?? null,
      n.collabRequestId ?? null,
      n.messageRequestId ?? null,
      NOTIFICATIONS.dedupeWindowMinutes[n.type] ?? 0,
    ],
  );
  return rows;
}

/**
 * Of the `candidates` a comment names, those it may notify (PLAN R8): the comment's text must contain "@" plus their
 * display name followed by a non-word character, and they must be the note's author, have commented in the same thread (root comment or its replies) or
 * be a friend of the commenter (D38). Visibility of the note is checked by the caller.
 */
export async function mentionable({
  noteId,
  rootId,
  actorId,
  body,
  candidates,
}: {
  noteId: number;
  rootId: number;
  actorId: number;
  body: string;
  candidates: number[];
}): Promise<number[]> {
  const { rows } = await pool.query<{ id: number }>(
    // The name's punctuation is escaped for the regex; a letter, digit or _ right after it means a longer name.
    String.raw`SELECT u.usr_id AS "id" FROM "USER_T" u JOIN "POST_T" p ON p.pst_id = $1
     WHERE u.usr_id = ANY($4::INT[])
       AND ($5 || ' ') ~ ('@' || regexp_replace(u.usr_display_name, '([^[:alnum:][:space:]])', '\\\1', 'g') || '[^[:alnum:]_]')
       AND (u.usr_id = p.pst_usr_id
            OR EXISTS (SELECT 1 FROM "COMMENT_T" t
                       WHERE t.cmt_pst_id = $1 AND t.cmt_usr_id = u.usr_id AND NOT t.cmt_is_deleted
                         AND (t.cmt_id = $2 OR t.cmt_parent_id = $2))
            OR ${friends('$3::INT', 'u.usr_id')})`,
    [noteId, rootId, actorId, candidates, body],
  );
  return rows.map((r) => r.id);
}

/**
 * Lecturers whose Super Like on the note is voided by a content edit (D46) and who have not been told since they last
 * verified it. Calling it after every save is idempotent: a lecturer is told once per voiding until they re-confirm.
 * Whether they can still see the note is checked by the caller.
 */
export async function voidedVerifiers(noteId: number): Promise<number[]> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT v.ver_usr_id AS "id" FROM "VERIFICATION_T" v JOIN "POST_T" p ON p.pst_id = v.ver_pst_id
     WHERE v.ver_pst_id = $1 AND v.ver_created_at < p.pst_content_edited_at
       AND NOT EXISTS (SELECT 1 FROM "NOTIFICATION_T" n
                       WHERE n.ntf_usr_id = v.ver_usr_id AND n.ntf_pst_id = $1 AND n.ntf_type = 'edited_since_verification'
                         AND n.ntf_created_at > v.ver_created_at)`,
    [noteId],
  );
  return rows.map((r) => r.id);
}

export interface Notification {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
  actor: { id: number; displayName: string } | null;
  /** `{id, title}` while the recipient can still read the note; null otherwise. */
  note: { id: number; title: string } | null;
  commentId: number | null;
  /** The collaboration or message request id, with its current status, for the approve/decline buttons. */
  requestId: number | null;
  requestStatus: string | null;
}

/**
 * SQL (alias n, viewer $1): a notification the recipient still sees: theirs, and its actor (if any) is active or
 * restricted and in no block with them, so blocking or suspending someone hides what they caused (D47, D49).
 */
const SHOWN = `(n.ntf_usr_id = $1 AND (n.ntf_actor_id IS NULL OR EXISTS (
    SELECT 1 FROM "USER_T" a WHERE a.usr_id = n.ntf_actor_id AND a.usr_status IN ('active', 'restricted')
      AND NOT ${blockedWith('$1', 'a.usr_id')})))`;

const COLS = `n.ntf_id AS "id", n.ntf_type AS "type", n.ntf_read_at IS NOT NULL AS "read", n.ntf_created_at AS "createdAt",
            (SELECT ${userRef('a')} FROM "USER_T" a WHERE a.usr_id = n.ntf_actor_id) AS "actor",
            (SELECT json_build_object('id', p.pst_id, 'title', p.pst_title) FROM "POST_T" p
             WHERE p.pst_id = n.ntf_pst_id AND ${READABLE}) AS "note",
            n.ntf_cmt_id AS "commentId", COALESCE(n.ntf_crq_id, n.ntf_mrq_id) AS "requestId",
            COALESCE((SELECT crq_status FROM "COLLAB_REQUEST_T" WHERE crq_id = n.ntf_crq_id),
                     (SELECT mrq_status FROM "MESSAGE_REQUEST_T" WHERE mrq_id = n.ntf_mrq_id)) AS "requestStatus"`;

/** One page of the user's notifications, newest first, optionally only `types` (the drawer's groups); keyset on (created at, id), D40. */
export async function listNotifications(
  userId: number,
  types: NotificationType[] | null,
  { cursor, limit }: KeysetPage,
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const { rows } = await pool.query<Notification & { cursor: string }>(
    `SELECT ${COLS}, ${micros('n.ntf_created_at')} || '_' || n.ntf_id AS "cursor"
     FROM "NOTIFICATION_T" n
     WHERE ${SHOWN} AND ($2::VARCHAR[] IS NULL OR n.ntf_type = ANY($2))
       AND ($3::BIGINT IS NULL OR (n.ntf_created_at, n.ntf_id) < (${fromMicros('$3')}, $4::INT))
     ORDER BY n.ntf_created_at DESC, n.ntf_id DESC
     LIMIT $5`,
    [userId, types, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

/** One notification as its recipient sees it, for the live event; undefined if it is not shown to them. */
export async function getNotification(id: number, userId: number): Promise<Notification | undefined> {
  const { rows } = await pool.query<Notification>(
    `SELECT ${COLS} FROM "NOTIFICATION_T" n WHERE ${SHOWN} AND n.ntf_id = $2`,
    [userId, id],
  );
  return rows[0];
}

/** Unread notifications the user sees, in total and per type. */
export async function unreadCount(
  userId: number,
): Promise<{ total: number; byType: Partial<Record<NotificationType, number>> }> {
  const { rows } = await pool.query<{ type: NotificationType; n: number }>(
    `SELECT n.ntf_type AS "type", COUNT(*)::INT AS "n" FROM "NOTIFICATION_T" n
     WHERE ${SHOWN} AND n.ntf_read_at IS NULL GROUP BY n.ntf_type`,
    [userId],
  );
  return { total: rows.reduce((s, r) => s + r.n, 0), byType: Object.fromEntries(rows.map((r) => [r.type, r.n])) };
}

/** Marks the user's unread notifications read: all of them, or only `ids` (other users' ids are ignored). */
export async function markRead(userId: number, ids: number[] | null): Promise<void> {
  await pool.query(
    `UPDATE "NOTIFICATION_T" SET ntf_read_at = NOW()
     WHERE ntf_usr_id = $1 AND ntf_read_at IS NULL AND ($2::INT[] IS NULL OR ntf_id = ANY($2))`,
    [userId, ids],
  );
}

/** Deletes notifications older than `retentionDays` (D47, D51), read or not; run by the daily purge (D34). Idempotent. */
export async function purgeOldNotifications(): Promise<number> {
  const { rowCount } = await pool.query(
    `DELETE FROM "NOTIFICATION_T" WHERE ntf_created_at < NOW() - make_interval(days => $1)`,
    [NOTIFICATIONS.retentionDays],
  );
  return rowCount ?? 0;
}
