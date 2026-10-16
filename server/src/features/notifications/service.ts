import { logger } from '../../lib/logger';
import { getTarget } from '../engagement/repository';
import { emit, userRoom } from '../messaging/socket';
import * as repo from './repository';

/**
 * Stores a notification for each recipient the delivery rules allow and pushes it live as `notification:new` with the
 * new unread count (D51). Runs after the triggering write has committed and never throws: a failed notification is
 * logged, and the action that caused it still succeeds. `to` may be a lookup, so its errors are caught too.
 */
export async function notify(n: repo.NewNotification, to: number[] | (() => Promise<number[]>)): Promise<void> {
  try {
    const recipients = typeof to === 'function' ? await to() : to;
    if (recipients.length === 0) return;
    for (const { id, recipientId } of await repo.insertNotifications(n, recipients)) {
      const notification = await repo.getNotification(id, recipientId);
      if (notification) emit(userRoom(recipientId), 'notification:new', { notification, unreadCount: await repo.unreadCount(recipientId) });
    }
  } catch (err) {
    logger.error({ err, type: n.type }, 'notification failed');
  }
}

/** Pushes the user's unread count to their other tabs after they mark notifications read. */
export async function pushUnreadCount(userId: number) {
  const unreadCount = await repo.unreadCount(userId);
  emit(userRoom(userId), 'notification:count', { unreadCount });
  return unreadCount;
}

/** Of `ids`, the users who can see the published note now (`getTarget`: visibility, friends-only, blocks). */
async function canSee(noteId: number, ids: number[]): Promise<number[]> {
  const seen = await Promise.all(ids.map(async (id) => ((await getTarget(noteId, id)) ? id : null)));
  return seen.filter((id) => id !== null);
}

/** Lecturers to tell that an edit voided their Super Like: `voidedVerifiers` who can still see the note. */
export const notifyVoidedVerifiers = (noteId: number, editorId: number) =>
  notify({ type: 'edited_since_verification', actorId: editorId, noteId }, async () => canSee(noteId, await repo.voidedVerifiers(noteId)));

/**
 * Mentions in a new comment (PLAN R8): the ids the client's mention picker sent, kept only when the text names them and
 * they are in the allowed set (`mentionable`) and can see the note.
 */
export const notifyMentions = (
  c: { noteId: number; commentId: number; parentId: number | null; actorId: number; body: string; mentions: number[] },
) =>
  notify({ type: 'mention', actorId: c.actorId, noteId: c.noteId, commentId: c.commentId }, async () => {
    if (c.mentions.length === 0) return [];
    return canSee(c.noteId, await repo.mentionable({
      noteId: c.noteId, rootId: c.parentId ?? c.commentId, actorId: c.actorId, body: c.body, candidates: c.mentions,
    }));
  });
