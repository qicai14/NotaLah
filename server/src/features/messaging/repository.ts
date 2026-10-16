import type { PoolClient } from 'pg';
import { fromMicros, type KeysetPage, micros, toPage } from '../../lib/keyset';
import { inTransaction, isUniqueViolation, pool } from '../../lib/pool';
import { VISIBLE } from '../notes/repository';
import { blockedWith, friends, userRef } from '../users/repository';
import { MESSAGING } from './config';

/** Reasons a messaging write is refused; routes map each to a status and message. */
export type Refusal =
  | 'not_found'
  | 'user_not_found'
  | 'pending'
  | 'cannot_send'
  | 'reply'
  | 'not_owner'
  | 'not_friends'
  | 'blocked'
  | 'full'
  | 'member'
  | 'not_member';

export interface MessageInput {
  body: string;
  noteId: number | null;
  replyToId: number | null;
}

/** SQL: user u can take part in a chat with $1: an active or restricted account in no block with $1 (D49). */
const REACHABLE = (u: string) =>
  `(${u}.usr_status IN ('active', 'restricted') AND NOT ${blockedWith('$1', `${u}.usr_id`)})`;

/** SQL (alias c = CONVERSATION_T, $1 = viewer): $1 is a member and, in a direct chat, in no block with the other member. */
const OPEN = `(EXISTS (SELECT 1 FROM "CONV_MEMBER_T" mm WHERE mm.cmb_cnv_id = c.cnv_id AND mm.cmb_usr_id = $1)
    AND (c.cnv_type = 'group' OR NOT EXISTS (SELECT 1 FROM "CONV_MEMBER_T" om WHERE om.cmb_cnv_id = c.cnv_id
                                              AND om.cmb_usr_id <> $1 AND ${blockedWith('$1', 'om.cmb_usr_id')})))`;

/** SQL: OPEN, and a direct chat's other member is still an active or restricted account, so $1 may post in c. */
const SENDABLE = `(${OPEN} AND (c.cnv_type = 'group' OR EXISTS (
    SELECT 1 FROM "CONV_MEMBER_T" om JOIN "USER_T" ou ON ou.usr_id = om.cmb_usr_id
    WHERE om.cmb_cnv_id = c.cnv_id AND om.cmb_usr_id <> $1 AND ou.usr_status IN ('active', 'restricted'))))`;

/** SQL (alias p = POST_T, $1 = viewer): the note card, re-checked against VISIBLE for each reader (FR7). */
const NOTE_CARD = `CASE WHEN ${VISIBLE} THEN json_build_object('id', p.pst_id, 'title', p.pst_title) END AS "note",
         (p.pst_id IS NOT NULL AND NOT ${VISIBLE}) AS "noteUnavailable"`;

// shortcut: message ids are read as INT (and keyset cursors cap ids at the INT maximum); move both to BIGINT past 2^31 messages.
const MESSAGE_COLS = `m.msg_id::INT AS "id", m.msg_cnv_id AS "conversationId", ${userRef('su')} AS "sender",
         CASE WHEN m.msg_deleted_at IS NULL THEN m.msg_body END AS "body", m.msg_deleted_at IS NOT NULL AS "deleted",
         ${NOTE_CARD},
         CASE WHEN r.msg_id IS NOT NULL THEN json_build_object('id', r.msg_id::INT, 'senderId', r.msg_sender_id,
              'body', CASE WHEN r.msg_deleted_at IS NULL THEN LEFT(r.msg_body, 200) END) END AS "replyTo",
         m.msg_created_at AS "createdAt"`;
const MESSAGE_FROM = `FROM "MESSAGE_T" m JOIN "USER_T" su ON su.usr_id = m.msg_sender_id
  LEFT JOIN "POST_T" p ON p.pst_id = m.msg_pst_id
  LEFT JOIN "MESSAGE_T" r ON r.msg_id = m.msg_reply_to_id`;

export interface Message {
  id: number;
  conversationId: number;
  sender: { id: number; displayName: string };
  body: string | null;
  deleted: boolean;
  note: { id: number; title: string } | null;
  noteUnavailable: boolean;
  replyTo: { id: number; senderId: number; body: string | null } | null;
  createdAt: Date;
}

/** A message's note card as each member of its conversation sees it, in one query (VISIBLE's viewer is the member). */
export async function noteCardsFor(
  messageId: number,
): Promise<{ viewerId: number; note: Message['note']; noteUnavailable: boolean }[]> {
  const { rows } = await pool.query<{ viewerId: number; note: Message['note']; noteUnavailable: boolean }>(
    `SELECT mem.cmb_usr_id AS "viewerId", ${NOTE_CARD.replaceAll('$1', 'mem.cmb_usr_id')}
     FROM "MESSAGE_T" m JOIN "CONV_MEMBER_T" mem ON mem.cmb_cnv_id = m.msg_cnv_id
     LEFT JOIN "POST_T" p ON p.pst_id = m.msg_pst_id
     WHERE m.msg_id = $1`,
    [messageId],
  );
  return rows;
}

/** One message as `viewerId` sees it (note card checked for them); undefined when unknown. */
export async function getMessage(id: number, viewerId: number): Promise<Message | undefined> {
  const { rows } = await pool.query<Message>(`SELECT ${MESSAGE_COLS} ${MESSAGE_FROM} WHERE m.msg_id = $2`, [
    viewerId,
    id,
  ]);
  return rows[0];
}

/** One history page of an OPEN conversation, newest first; keyset on msg_id (D40). Undefined when not OPEN to the viewer. */
export async function listMessages(
  conversationId: number,
  viewerId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: Message[]; nextCursor: string | null } | undefined> {
  if (!(await isOpen(conversationId, viewerId))) return undefined;
  const { rows } = await pool.query<Message & { cursor: string }>(
    `SELECT ${MESSAGE_COLS}, m.msg_id::TEXT AS "cursor" ${MESSAGE_FROM}
     WHERE m.msg_cnv_id = $2 AND ($3::BIGINT IS NULL OR m.msg_id < $3)
     ORDER BY m.msg_id DESC
     LIMIT $4`,
    [viewerId, conversationId, cursor?.[0] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

async function isOpen(conversationId: number, viewerId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM "CONVERSATION_T" c WHERE c.cnv_id = $2 AND ${OPEN}`, [
    viewerId,
    conversationId,
  ]);
  return rowCount === 1;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  ownerId: number | null;
  members: { id: number; displayName: string; lastReadMessageId: number | null }[];
  lastMessage: { id: number; senderId: number; body: string | null; deleted: boolean; createdAt: string } | null;
  unreadCount: number;
  lastActivityAt: Date;
}

/** Conversations of member $1 that are OPEN to them, with members (and their read receipts), last message and unread count. */
const CONVERSATION_SELECT = `SELECT c.cnv_id AS "id", c.cnv_type AS "type", c.cnv_name AS "name", c.cnv_owner_id AS "ownerId",
         (SELECT json_agg(json_build_object('id', u.usr_id, 'displayName', u.usr_display_name,
                 'lastReadMessageId', cm.cmb_last_read_msg_id::INT) ORDER BY cm.cmb_joined_at, u.usr_id)
          FROM "CONV_MEMBER_T" cm JOIN "USER_T" u ON u.usr_id = cm.cmb_usr_id WHERE cm.cmb_cnv_id = c.cnv_id) AS "members",
         CASE WHEN lm.msg_id IS NOT NULL THEN json_build_object('id', lm.msg_id::INT, 'senderId', lm.msg_sender_id,
              'body', CASE WHEN lm.msg_deleted_at IS NULL THEN lm.msg_body END, 'deleted', lm.msg_deleted_at IS NOT NULL,
              'createdAt', lm.msg_created_at) END AS "lastMessage",
         (SELECT COUNT(*)::INT FROM "MESSAGE_T" um WHERE um.msg_cnv_id = c.cnv_id AND um.msg_id > COALESCE(me.cmb_last_read_msg_id, 0)
            AND um.msg_sender_id <> $1 AND um.msg_deleted_at IS NULL) AS "unreadCount",
         COALESCE(lm.msg_created_at, c.cnv_created_at) AS "lastActivityAt"
  FROM "CONV_MEMBER_T" me JOIN "CONVERSATION_T" c ON c.cnv_id = me.cmb_cnv_id
  LEFT JOIN LATERAL (SELECT x.* FROM "MESSAGE_T" x WHERE x.msg_cnv_id = c.cnv_id ORDER BY x.msg_id DESC LIMIT 1) lm ON TRUE
  WHERE me.cmb_usr_id = $1 AND ${OPEN}`;

/** The user's conversation list, most recent activity first; keyset on (last activity, id), D40. */
// shortcut: every conversation of the user is built (members, last message, unread count) before the keyset filter and
// LIMIT; keep a last-activity column on CONVERSATION_T, indexed per member, if users reach hundreds of chats.
export async function listConversations(
  userId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: Conversation[]; nextCursor: string | null }> {
  const { rows } = await pool.query<Conversation & { cursor: string }>(
    `SELECT x.*, ${micros('x."lastActivityAt"')} || '_' || x.id AS "cursor" FROM (${CONVERSATION_SELECT}) x
     WHERE ($2::BIGINT IS NULL OR (x."lastActivityAt", x.id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY x."lastActivityAt" DESC, x.id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

export async function getConversation(id: number, userId: number): Promise<Conversation | undefined> {
  const { rows } = await pool.query<Conversation>(`${CONVERSATION_SELECT} AND c.cnv_id = $2`, [userId, id]);
  return rows[0];
}

/** Every conversation the user belongs to (their socket rooms). */
export async function conversationIds(userId: number): Promise<number[]> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT cmb_cnv_id AS "id" FROM "CONV_MEMBER_T" WHERE cmb_usr_id = $1`,
    [userId],
  );
  return rows.map((r) => r.id);
}

/** The other member of a direct conversation the user belongs to; null for a group or a conversation they are not in. */
export async function directPeer(conversationId: number, userId: number): Promise<number | null> {
  const { rows } = await pool.query<{ id: number }>(
    `SELECT o.cmb_usr_id AS "id" FROM "CONVERSATION_T" c
     JOIN "CONV_MEMBER_T" mm ON mm.cmb_cnv_id = c.cnv_id AND mm.cmb_usr_id = $2
     JOIN "CONV_MEMBER_T" o ON o.cmb_cnv_id = c.cnv_id AND o.cmb_usr_id <> $2
     WHERE c.cnv_id = $1 AND c.cnv_type = 'direct'`,
    [conversationId, userId],
  );
  return rows[0]?.id ?? null;
}

/** True when the note exists and the user may see it, so only such a note can be attached to a message (FR7). */
export async function noteVisibleTo(noteId: number, userId: number): Promise<boolean> {
  const { rowCount } = await pool.query(`SELECT 1 FROM "POST_T" p WHERE p.pst_id = $2 AND ${VISIBLE}`, [
    userId,
    noteId,
  ]);
  return rowCount === 1;
}

/**
 * Inserts the message only while SENDABLE holds, checked inside the INSERT ... SELECT so a committed block always stops it
 * (D49); undefined when refused or the reply target is not a live message of this conversation. `createdAt` keeps a held
 * request's original time.
 */
async function insertMessage(
  q: PoolClient,
  conversationId: number,
  senderId: number,
  m: MessageInput,
  createdAt: Date | null = null,
): Promise<number | undefined> {
  const { rows } = await q.query<{ id: number }>(
    `INSERT INTO "MESSAGE_T" (msg_cnv_id, msg_sender_id, msg_body, msg_pst_id, msg_reply_to_id, msg_created_at)
     SELECT c.cnv_id, $1, $3, $4, $5, COALESCE($6::TIMESTAMPTZ, NOW()) FROM "CONVERSATION_T" c
     WHERE c.cnv_id = $2 AND ${SENDABLE}
       AND ($5::BIGINT IS NULL OR EXISTS (SELECT 1 FROM "MESSAGE_T" r WHERE r.msg_id = $5 AND r.msg_cnv_id = c.cnv_id
                                                                    AND r.msg_deleted_at IS NULL))
     RETURNING msg_id::INT AS "id"`,
    [senderId, conversationId, m.body, m.noteId, m.replyToId, createdAt],
  );
  return rows[0]?.id;
}

/** Thrown inside a transaction to roll it back when a guarded insert is refused; callers turn it into a refusal. */
class Rollback extends Error {}

/**
 * The direct conversation of a pair, created with both members when missing; the unique cnv_pair stops a duplicate. A
 * pending request between the pair is accepted here, its held message inserted first at its original time, so history
 * stays in order whichever path opens the chat. Throws Rollback when the held message is refused.
 */
async function openDirect(
  q: PoolClient,
  a: number,
  b: number,
): Promise<{ id: number; created: boolean; heldMessageId: number | null }> {
  const pair = `${Math.min(a, b)}_${Math.max(a, b)}`;
  const ins = await q.query<{ id: number }>(
    `INSERT INTO "CONVERSATION_T" (cnv_type, cnv_pair) VALUES ('direct', $1) ON CONFLICT (cnv_pair) DO NOTHING RETURNING cnv_id AS "id"`,
    [pair],
  );
  const id =
    ins.rows[0]?.id ??
    (await q.query<{ id: number }>(`SELECT cnv_id AS "id" FROM "CONVERSATION_T" WHERE cnv_pair = $1`, [pair])).rows[0]
      .id;
  await q.query(
    `INSERT INTO "CONV_MEMBER_T" (cmb_cnv_id, cmb_usr_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`,
    [id, a, b],
  );
  const {
    rows: [held],
  } = await q.query<{ senderId: number; body: string; noteId: number | null; createdAt: Date }>(
    `UPDATE "MESSAGE_REQUEST_T" SET mrq_status = 'accepted', mrq_responded_at = NOW()
     WHERE mrq_status = 'pending' AND LEAST(mrq_sender_id, mrq_recipient_id) = $1 AND GREATEST(mrq_sender_id, mrq_recipient_id) = $2
     RETURNING mrq_sender_id AS "senderId", mrq_body AS "body", mrq_pst_id AS "noteId", mrq_created_at AS "createdAt"`,
    [Math.min(a, b), Math.max(a, b)],
  );
  if (!held) return { id, created: ins.rowCount === 1, heldMessageId: null };
  const heldMessageId = await insertMessage(
    q,
    id,
    held.senderId,
    { body: held.body, noteId: held.noteId, replyToId: null },
    held.createdAt,
  );
  if (heldMessageId === undefined) throw new Rollback();
  return { id, created: ins.rowCount === 1, heldMessageId };
}

export type DirectResult =
  | { kind: 'message'; conversationId: number; messageId: number; created: boolean }
  | { kind: 'request'; requestId: number };

/**
 * A first or later message to a user (FR6, D38): into the pair's conversation when it exists or they are friends,
 * otherwise a pending request holding the text and note card. 'user_not_found' for an unknown, suspended or deleted user
 * or a block either way; 'pending' when a request between them already waits.
 */
export async function sendToUser(
  senderId: number,
  toUserId: number,
  m: Omit<MessageInput, 'replyToId'>,
): Promise<DirectResult | Refusal> {
  try {
    return await inTransaction(async (q) => {
      const {
        rows: [t],
      } = await q.query<{ friends: boolean; conversationId: number | null }>(
        `SELECT ${friends('$1', 'u.usr_id')} AS "friends",
                (SELECT cnv_id FROM "CONVERSATION_T" WHERE cnv_pair = $3) AS "conversationId"
         FROM "USER_T" u WHERE u.usr_id = $2 AND ${REACHABLE('u')}`,
        [senderId, toUserId, `${Math.min(senderId, toUserId)}_${Math.max(senderId, toUserId)}`],
      );
      if (!t) return 'user_not_found';
      if (t.conversationId !== null || t.friends) {
        const conv = await openDirect(q, senderId, toUserId);
        const messageId = await insertMessage(q, conv.id, senderId, { ...m, replyToId: null });
        if (messageId === undefined) return 'user_not_found';
        return { kind: 'message', conversationId: conv.id, messageId, created: conv.created };
      }
      const {
        rows: [r],
      } = await q.query<{ id: number }>(
        `INSERT INTO "MESSAGE_REQUEST_T" (mrq_sender_id, mrq_recipient_id, mrq_body, mrq_pst_id)
         SELECT $1, u.usr_id, $3, $4 FROM "USER_T" u WHERE u.usr_id = $2 AND ${REACHABLE('u')}
         RETURNING mrq_id AS "id"`,
        [senderId, toUserId, m.body, m.noteId],
      );
      return r ? { kind: 'request', requestId: r.id } : 'user_not_found';
    });
  } catch (err) {
    if (isUniqueViolation(err)) return 'pending';
    if (err instanceof Rollback) return 'user_not_found';
    throw err;
  }
}

/** A message in an existing conversation: 'not_found' unless OPEN, 'cannot_send' when the other side left NotaLah, 'reply' for a bad reply target. */
export async function sendToConversation(
  conversationId: number,
  senderId: number,
  m: MessageInput,
): Promise<number | Refusal> {
  return inTransaction(async (q) => {
    const {
      rows: [s],
    } = await q.query<{ open: boolean; sendable: boolean }>(
      `SELECT ${OPEN} AS "open", ${SENDABLE} AS "sendable" FROM "CONVERSATION_T" c WHERE c.cnv_id = $2`,
      [senderId, conversationId],
    );
    if (!s?.open) return 'not_found';
    if (!s.sendable) return 'cannot_send';
    return (await insertMessage(q, conversationId, senderId, m)) ?? 'reply';
  });
}

/** Soft-deletes the sender's own message, clearing its text and note (no body is kept); its conversation id, or undefined. */
export async function deleteMessage(id: number, senderId: number): Promise<number | undefined> {
  const { rows } = await pool.query<{ conversationId: number }>(
    `UPDATE "MESSAGE_T" m SET msg_deleted_at = NOW(), msg_body = '', msg_pst_id = NULL
     WHERE m.msg_id = $1 AND m.msg_sender_id = $2 AND m.msg_deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = m.msg_cnv_id AND cmb_usr_id = $2)
     RETURNING msg_cnv_id AS "conversationId"`,
    [id, senderId],
  );
  return rows[0]?.conversationId;
}

/** Moves the member's read receipt forward to `messageId` (or the latest message); the receipt, or undefined when not OPEN. */
export async function markRead(
  conversationId: number,
  userId: number,
  messageId: number | null,
): Promise<number | null | undefined> {
  const { rows } = await pool.query<{ lastRead: number | null }>(
    `UPDATE "CONV_MEMBER_T" me SET cmb_last_read_msg_id = GREATEST(me.cmb_last_read_msg_id, (
         SELECT MAX(msg_id) FROM "MESSAGE_T" WHERE msg_cnv_id = $2 AND ($3::BIGINT IS NULL OR msg_id <= $3)))
     FROM "CONVERSATION_T" c
     WHERE c.cnv_id = $2 AND me.cmb_cnv_id = c.cnv_id AND me.cmb_usr_id = $1 AND ${OPEN}
     RETURNING me.cmb_last_read_msg_id::INT AS "lastRead"`,
    [userId, conversationId, messageId],
  );
  return rows.length ? rows[0].lastRead : undefined;
}

export interface MessageRequest {
  id: number;
  sender: { id: number; displayName: string };
  body: string;
  note: { id: number; title: string } | null;
  noteUnavailable: boolean;
  createdAt: Date;
}

/** Pending requests to $1 from reachable senders, with the note card checked for the recipient (alias q). */
const REQUEST_COLS = `q.mrq_id AS "id", ${userRef('u')} AS "sender", q.mrq_body AS "body", ${NOTE_CARD},
         q.mrq_created_at AS "createdAt"`;
const REQUEST_FROM = `FROM "MESSAGE_REQUEST_T" q JOIN "USER_T" u ON u.usr_id = q.mrq_sender_id
  LEFT JOIN "POST_T" p ON p.pst_id = q.mrq_pst_id
  WHERE q.mrq_recipient_id = $1 AND q.mrq_status = 'pending' AND ${REACHABLE('u')}`;

/** The request inbox, newest first; keyset on (created at, id), D40. */
export async function listRequests(
  userId: number,
  { cursor, limit }: KeysetPage,
): Promise<{ items: MessageRequest[]; nextCursor: string | null }> {
  const { rows } = await pool.query<MessageRequest & { cursor: string }>(
    `SELECT ${REQUEST_COLS}, ${micros('q.mrq_created_at')} || '_' || q.mrq_id AS "cursor" ${REQUEST_FROM}
       AND ($2::BIGINT IS NULL OR (q.mrq_created_at, q.mrq_id) < (${fromMicros('$2')}, $3::INT))
     ORDER BY q.mrq_created_at DESC, q.mrq_id DESC
     LIMIT $4`,
    [userId, cursor?.[0] ?? null, cursor?.[1] ?? null, limit + 1],
  );
  return toPage(rows, limit);
}

export async function getRequest(id: number, recipientId: number): Promise<MessageRequest | undefined> {
  const { rows } = await pool.query<MessageRequest>(`SELECT ${REQUEST_COLS} ${REQUEST_FROM} AND q.mrq_id = $2`, [
    recipientId,
    id,
  ]);
  return rows[0];
}

/**
 * Accepts a pending request to `recipientId` from a reachable sender: opens the direct conversation, which inserts the
 * held message (its original time and note) through the block-checked insert, and marks it read for the recipient. Creates
 * no follow (D9 review, D38). Undefined when there is no such request or that insert is refused (rolled back).
 */
export async function acceptRequest(
  id: number,
  recipientId: number,
): Promise<{ senderId: number; conversationId: number; messageId: number } | undefined> {
  try {
    return await inTransaction(async (q) => {
      const {
        rows: [r],
      } = await q.query<{ senderId: number }>(
        `SELECT q.mrq_sender_id AS "senderId" FROM "MESSAGE_REQUEST_T" q JOIN "USER_T" u ON u.usr_id = q.mrq_sender_id
         WHERE q.mrq_id = $2 AND q.mrq_recipient_id = $1 AND q.mrq_status = 'pending' AND ${REACHABLE('u')}
         FOR UPDATE OF q`,
        [recipientId, id],
      );
      if (!r) return undefined;
      const conv = await openDirect(q, recipientId, r.senderId);
      if (conv.heldMessageId === null) throw new Rollback();
      await q.query(`UPDATE "CONV_MEMBER_T" SET cmb_last_read_msg_id = $3 WHERE cmb_cnv_id = $1 AND cmb_usr_id = $2`, [
        conv.id,
        recipientId,
        conv.heldMessageId,
      ]);
      return { senderId: r.senderId, conversationId: conv.id, messageId: conv.heldMessageId };
    });
  } catch (err) {
    if (err instanceof Rollback) return undefined;
    throw err;
  }
}

/** Declines a pending request to the recipient; creates nothing. False when there is no such request. */
export async function declineRequest(id: number, recipientId: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE "MESSAGE_REQUEST_T" SET mrq_status = 'declined', mrq_responded_at = NOW()
     WHERE mrq_id = $1 AND mrq_recipient_id = $2 AND mrq_status = 'pending'`,
    [id, recipientId],
  );
  return rowCount === 1;
}

/** SQL: no block between any two of the users in the INT[] placeholder `ids`. */
const NO_BLOCK_AMONG = (ids: string) =>
  `NOT EXISTS (SELECT 1 FROM "BLOCK_T" WHERE blk_blocker_id = ANY(${ids}) AND blk_blocked_id = ANY(${ids}))`;

/** SQL: how many of the INT[] placeholder `ids` are active or restricted friends of $1. */
const FRIEND_COUNT = (ids: string) =>
  `(SELECT COUNT(*)::INT FROM "USER_T" u WHERE u.usr_id = ANY(${ids}) AND u.usr_status IN ('active', 'restricted') AND ${friends('$1', 'u.usr_id')})`;

/**
 * Creates a group owned by `ownerId` with the given friends (FR13). 'not_friends' unless every member is an active or
 * restricted friend of the owner; 'blocked' when any two members are in a block.
 */
export function createGroup(ownerId: number, name: string, members: number[]): Promise<number | Refusal> {
  const all = [ownerId, ...members];
  return inTransaction(async (q) => {
    const {
      rows: [chk],
    } = await q.query<{ friends: number; free: boolean }>(
      `SELECT ${FRIEND_COUNT('$2::INT[]')} AS "friends", ${NO_BLOCK_AMONG('$3::INT[]')} AS "free"`,
      [ownerId, members, all],
    );
    if (chk.friends !== members.length) return 'not_friends';
    if (!chk.free) return 'blocked';
    const {
      rows: [c],
    } = await q.query<{ id: number }>(
      `INSERT INTO "CONVERSATION_T" (cnv_type, cnv_name, cnv_owner_id) VALUES ('group', $1, $2) RETURNING cnv_id AS "id"`,
      [name, ownerId],
    );
    await q.query(`INSERT INTO "CONV_MEMBER_T" (cmb_cnv_id, cmb_usr_id) SELECT $1, UNNEST($2::INT[])`, [c.id, all]);
    return c.id;
  });
}

/**
 * Locks a group row for a membership change; undefined when it is not a group the user belongs to. Size and membership
 * are read in a second statement once the lock is held, so a change committed while this waited is counted.
 */
async function lockGroup(
  q: PoolClient,
  conversationId: number,
  userId: number,
): Promise<{ ownerId: number; size: number } | undefined> {
  const {
    rows: [g],
  } = await q.query<{ ownerId: number }>(
    `SELECT cnv_owner_id AS "ownerId" FROM "CONVERSATION_T" WHERE cnv_id = $1 AND cnv_type = 'group' FOR UPDATE`,
    [conversationId],
  );
  if (!g) return undefined;
  const {
    rows: [m],
  } = await q.query<{ size: number; member: boolean }>(
    `SELECT COUNT(*)::INT AS "size", COALESCE(BOOL_OR(cmb_usr_id = $2), FALSE) AS "member" FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = $1`,
    [conversationId, userId],
  );
  return m.member ? { ownerId: g.ownerId, size: m.size } : undefined;
}

/** A member adds one of their own friends (FR13); the new member starts with everything so far marked read. */
export function addMember(conversationId: number, adderId: number, userId: number): Promise<Refusal | null> {
  return inTransaction(async (q) => {
    const group = await lockGroup(q, conversationId, adderId);
    if (!group) return 'not_found';
    const {
      rows: [chk],
    } = await q.query<{ member: boolean; friends: number; free: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = $2 AND cmb_usr_id = $3) AS "member",
              ${FRIEND_COUNT('ARRAY[$3::INT]')} AS "friends",
              NOT EXISTS (SELECT 1 FROM "CONV_MEMBER_T" m WHERE m.cmb_cnv_id = $2 AND ${blockedWith('$3::INT', 'm.cmb_usr_id')}) AS "free"`,
      [adderId, conversationId, userId],
    );
    if (chk.member) return 'member';
    if (chk.friends !== 1) return 'not_friends';
    if (!chk.free) return 'blocked';
    if (group.size >= MESSAGING.groupMax) return 'full';
    await q.query(
      `INSERT INTO "CONV_MEMBER_T" (cmb_cnv_id, cmb_usr_id, cmb_last_read_msg_id)
       VALUES ($1, $2, (SELECT MAX(msg_id) FROM "MESSAGE_T" WHERE msg_cnv_id = $1))`,
      [conversationId, userId],
    );
    return null;
  });
}

/**
 * Removes a member: anyone may remove themself (leave), only the owner may remove others. When the owner leaves, the
 * earliest-joined remaining member becomes owner (D50); when nobody is left the group is deleted. The owner after the
 * change, or null when the group was deleted.
 */
export function removeMember(
  conversationId: number,
  actorId: number,
  userId: number,
): Promise<{ ownerId: number | null } | Refusal> {
  return inTransaction(async (q) => {
    const group = await lockGroup(q, conversationId, actorId);
    if (!group) return 'not_found';
    if (userId !== actorId && group.ownerId !== actorId) return 'not_owner';
    const { rowCount } = await q.query(`DELETE FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = $1 AND cmb_usr_id = $2`, [
      conversationId,
      userId,
    ]);
    if (rowCount === 0) return 'not_member';
    const {
      rows: [next],
    } = await q.query<{ id: number }>(
      `SELECT cmb_usr_id AS "id" FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = $1 ORDER BY cmb_joined_at, cmb_usr_id LIMIT 1`,
      [conversationId],
    );
    if (!next) {
      await q.query(`DELETE FROM "CONVERSATION_T" WHERE cnv_id = $1`, [conversationId]);
      return { ownerId: null };
    }
    if (userId !== group.ownerId) return { ownerId: group.ownerId };
    await q.query(`UPDATE "CONVERSATION_T" SET cnv_owner_id = $2 WHERE cnv_id = $1`, [conversationId, next.id]);
    return { ownerId: next.id };
  });
}

/** The owner renames the group. */
export function renameGroup(conversationId: number, actorId: number, name: string): Promise<Refusal | null> {
  return inTransaction(async (q) => {
    const group = await lockGroup(q, conversationId, actorId);
    if (!group) return 'not_found';
    if (group.ownerId !== actorId) return 'not_owner';
    await q.query(`UPDATE "CONVERSATION_T" SET cnv_name = $2 WHERE cnv_id = $1`, [conversationId, name]);
    return null;
  });
}
