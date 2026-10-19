import { type Response, Router } from 'express';
import { z } from 'zod';
import { parseKeyset } from '../../lib/keyset';
import { bodyOrEmpty, idParam, issueMap } from '../../lib/validation';
import { me, requireActive, requireAuth } from '../auth/middleware';
import { notify } from '../notifications/service';
import { MESSAGING } from './config';
import * as repo from './repository';
import { convRoom, emit, joinConversation, leaveConversation, userRoom } from './socket';

/** Mounted at /api (FR6, FR7, FR13, D50). Every route needs a login; writes that add content also need an active account. */
export const messagingRouter = Router();

messagingRouter.param('id', idParam('Conversation not found'));
messagingRouter.param('messageId', idParam('Message not found'));
messagingRouter.param('requestId', idParam('Request not found'));
messagingRouter.param('userId', idParam('User not found'));

const REFUSALS: Record<repo.Refusal, [number, string]> = {
  not_found: [404, 'Conversation not found'],
  user_not_found: [404, 'User not found'],
  pending: [409, 'A message request between you is already pending'],
  cannot_send: [403, 'You cannot message this user'],
  reply: [400, 'You can only reply to a message in this conversation'],
  not_owner: [403, 'Only the group owner can do this'],
  not_friends: [400, 'You can only add your friends'],
  blocked: [400, 'These users cannot be in the same group'],
  full: [409, `A group has at most ${MESSAGING.groupMax} members`],
  member: [409, 'Already a member'],
  not_member: [404, 'Member not found'],
};
const refuse = (res: Response, r: repo.Refusal) => void res.status(REFUSALS[r][0]).json({ error: REFUSALS[r][1] });

const id = (message: string) => z.number({ error: message }).int(message).positive(message).max(2147483647, message);
// Plain text (React escapes it on render): control characters other than tab and newline are dropped, then trimmed.
const text = z
  .string({ error: 'Message is required' })
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point of this regex
  .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
  .pipe(
    z
      .string()
      .min(1, 'Message is required')
      .max(MESSAGING.bodyMax, `Message must be at most ${MESSAGING.bodyMax} characters`),
  );
const messageSchema = z.object({
  body: text,
  noteId: id('Invalid note')
    .nullish()
    .transform((v) => v ?? null),
  replyToId: id('Invalid reply')
    .nullish()
    .transform((v) => v ?? null),
});
const groupName = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(MESSAGING.groupNameMax, `Name must be at most ${MESSAGING.groupNameMax} characters`);

/** Parses a body with `schema`; sends 400 with the field map and returns undefined when it fails. */
function parse<T extends z.ZodType>(schema: T, body: unknown, res: Response): z.infer<T> | undefined {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return void res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  return parsed.data;
}

/** Live delivery of a new message (as its sender sees it): one payload for the room, or with a note card one per member, each card checked for that reader. */
async function deliver(message: repo.Message): Promise<void> {
  const { conversationId } = message;
  if (message.note === null && !message.noteUnavailable)
    return emit(convRoom(conversationId), 'message:new', { conversationId, message });
  for (const { viewerId, note, noteUnavailable } of await repo.noteCardsFor(message.id)) {
    emit(userRoom(viewerId), 'message:new', { conversationId, message: { ...message, note, noteUnavailable } });
  }
}

/** The sent message as its sender sees it; it was inserted in this request, so it exists. */
async function sent(messageId: number, senderId: number): Promise<repo.Message> {
  const message = await repo.getMessage(messageId, senderId);
  if (!message) throw new Error(`message ${messageId} vanished after insert`);
  return message;
}

messagingRouter.get('/conversations', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2, MESSAGING.listPage);
  if (!page) return;
  const { items, nextCursor } = await repo.listConversations(me(req).id, page);
  res.json({ conversations: items, nextCursor });
});

messagingRouter.get('/conversations/:id', requireAuth, async (req, res) => {
  const conversation = await repo.getConversation(Number(req.params.id), me(req).id);
  if (!conversation) return refuse(res, 'not_found');
  res.json({ conversation });
});

messagingRouter.get('/conversations/:id/messages', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 1, MESSAGING.historyPage);
  if (!page) return;
  const out = await repo.listMessages(Number(req.params.id), me(req).id, page);
  if (!out) return refuse(res, 'not_found');
  res.json({ messages: out.items, nextCursor: out.nextCursor });
});

/** Sends to a user: into their conversation (201) or, from a non-friend with none yet, as a message request (202). */
messagingRouter.post('/messages', requireAuth, requireActive, async (req, res) => {
  const input = parse(
    messageSchema.omit({ replyToId: true }).extend({ toUserId: id('User not found') }),
    bodyOrEmpty(req),
    res,
  );
  if (!input) return;
  const sender = me(req).id;
  if (input.toUserId === sender) return res.status(400).json({ error: 'You cannot message yourself' });
  if (input.noteId !== null && !(await repo.noteVisibleTo(input.noteId, sender)))
    return res.status(400).json({ error: 'Note not found' });
  const out = await repo.sendToUser(sender, input.toUserId, input);
  if (typeof out === 'string') return refuse(res, out);
  if (out.kind === 'request') {
    emit(userRoom(input.toUserId), 'request:new', { request: await repo.getRequest(out.requestId, input.toUserId) });
    await notify({ type: 'message_request', actorId: sender, messageRequestId: out.requestId }, [input.toUserId]);
    return res.status(202).json({ request: { id: out.requestId, status: 'pending' } });
  }
  if (out.created) joinConversation([sender, input.toUserId], out.conversationId);
  const message = await sent(out.messageId, sender);
  await deliver(message);
  res.status(201).json({ conversationId: out.conversationId, message });
});

messagingRouter.post('/conversations/:id/messages', requireAuth, requireActive, async (req, res) => {
  const input = parse(messageSchema, bodyOrEmpty(req), res);
  if (!input) return;
  const conversationId = Number(req.params.id);
  const sender = me(req).id;
  if (input.noteId !== null && !(await repo.noteVisibleTo(input.noteId, sender)))
    return res.status(400).json({ error: 'Note not found' });
  const out = await repo.sendToConversation(conversationId, sender, input);
  if (typeof out === 'string') return refuse(res, out);
  const message = await sent(out, sender);
  await deliver(message);
  res.status(201).json({ message });
});

// Deleting your own message removes content, so a restricted account may do it.
messagingRouter.delete('/messages/:messageId', requireAuth, async (req, res) => {
  const messageId = Number(req.params.messageId);
  const conversationId = await repo.deleteMessage(messageId, me(req).id);
  if (conversationId === undefined) return res.status(404).json({ error: 'Message not found' });
  emit(convRoom(conversationId), 'message:deleted', { conversationId, messageId });
  res.status(204).end();
});

messagingRouter.post('/conversations/:id/read', requireAuth, async (req, res) => {
  const input = parse(
    z.object({
      messageId: id('Message not found')
        .nullish()
        .transform((v) => v ?? null),
    }),
    bodyOrEmpty(req),
    res,
  );
  if (!input) return;
  const conversationId = Number(req.params.id);
  const userId = me(req).id;
  const messageId = await repo.markRead(conversationId, userId, input.messageId);
  if (messageId === undefined) return refuse(res, 'not_found');
  emit(convRoom(conversationId), 'conversation:read', { conversationId, userId, messageId });
  res.json({ lastReadMessageId: messageId });
});

messagingRouter.get('/message-requests', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2, MESSAGING.listPage);
  if (!page) return;
  const { items, nextCursor } = await repo.listRequests(me(req).id, page);
  res.json({ requests: items, nextCursor });
});

// Answering a request adds no content of the recipient's own, so a restricted account may accept or decline.
messagingRouter.post('/message-requests/:requestId/accept', requireAuth, async (req, res) => {
  const recipient = me(req).id;
  const out = await repo.acceptRequest(Number(req.params.requestId), recipient);
  if (!out) return res.status(404).json({ error: 'Request not found' });
  joinConversation([recipient, out.senderId], out.conversationId);
  emit(userRoom(out.senderId), 'request:accepted', {
    requestId: Number(req.params.requestId),
    conversationId: out.conversationId,
  });
  res.json({ conversationId: out.conversationId });
});

messagingRouter.post('/message-requests/:requestId/decline', requireAuth, async (req, res) => {
  if (!(await repo.declineRequest(Number(req.params.requestId), me(req).id)))
    return res.status(404).json({ error: 'Request not found' });
  res.status(204).end();
});

const groupSchema = z.object({
  name: groupName,
  memberIds: z
    .array(id('Invalid member'), { error: 'Members must be a list' })
    .min(MESSAGING.groupMinOthers, `Add at least ${MESSAGING.groupMinOthers} friends`)
    .max(MESSAGING.groupMax - 1, `A group has at most ${MESSAGING.groupMax} members`)
    .refine((ids) => new Set(ids).size === ids.length, 'Each member can be added once'),
});

messagingRouter.post('/conversations', requireAuth, requireActive, async (req, res) => {
  const input = parse(groupSchema, bodyOrEmpty(req), res);
  if (!input) return;
  const owner = me(req).id;
  if (input.memberIds.includes(owner))
    return res.status(400).json({ error: 'Validation failed', errors: { memberIds: 'You are already in the group' } });
  const out = await repo.createGroup(owner, input.name, input.memberIds);
  if (typeof out === 'string') return refuse(res, out);
  joinConversation([owner, ...input.memberIds], out);
  emit(convRoom(out), 'conversation:updated', { conversationId: out });
  res.status(201).json({ conversation: await repo.getConversation(out, owner) });
});

messagingRouter.patch('/conversations/:id', requireAuth, requireActive, async (req, res) => {
  const input = parse(z.object({ name: groupName }), bodyOrEmpty(req), res);
  if (!input) return;
  const conversationId = Number(req.params.id);
  const out = await repo.renameGroup(conversationId, me(req).id, input.name);
  if (out) return refuse(res, out);
  emit(convRoom(conversationId), 'conversation:updated', { conversationId });
  res.json({ conversation: await repo.getConversation(conversationId, me(req).id) });
});

messagingRouter.post('/conversations/:id/members', requireAuth, requireActive, async (req, res) => {
  const input = parse(z.object({ userId: id('User not found') }), bodyOrEmpty(req), res);
  if (!input) return;
  const conversationId = Number(req.params.id);
  const out = await repo.addMember(conversationId, me(req).id, input.userId);
  if (out) return refuse(res, out);
  joinConversation([input.userId], conversationId);
  emit(convRoom(conversationId), 'conversation:updated', { conversationId });
  res.status(201).json({ conversation: await repo.getConversation(conversationId, me(req).id) });
});

// Leaving (removing yourself) is always allowed; removing others is the owner's (FR13).
messagingRouter.delete('/conversations/:id/members/:userId', requireAuth, async (req, res) => {
  const conversationId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const out = await repo.removeMember(conversationId, me(req).id, userId);
  if (typeof out === 'string') return refuse(res, out);
  leaveConversation(userId, conversationId);
  emit(userRoom(userId), 'conversation:removed', { conversationId });
  if (out.ownerId !== null) emit(convRoom(conversationId), 'conversation:updated', { conversationId });
  res.json({ ownerId: out.ownerId });
});
