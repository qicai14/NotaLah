import type { Conversation, Message, MessageRequest, Page } from './types';

/** The signed-in user's conversations and message requests, kept current by REST loads and socket events. */
export interface InboxState {
  conversations: Page<Conversation>;
  requests: Page<MessageRequest>;
  conversationsLoaded: boolean;
  requestsLoaded: boolean;
}

export const emptyInbox: InboxState = {
  conversations: { items: [], next: null },
  requests: { items: [], next: null },
  conversationsLoaded: false,
  requestsLoaded: false,
};

export type InboxAction =
  | { type: 'conversations'; items: Conversation[]; next: string | null; append?: boolean }
  | { type: 'requests'; items: MessageRequest[]; next: string | null; append?: boolean }
  | { type: 'upsert'; conversation: Conversation }
  | { type: 'message'; message: Message; me: number; open: boolean }
  | { type: 'deleted'; conversationId: number; messageId: number }
  | { type: 'read'; conversationId: number; userId: number; messageId: number | null; me: number }
  | { type: 'removed'; conversationId: number }
  | { type: 'request'; request: MessageRequest }
  | { type: 'requestGone'; id: number }
  | { type: 'reset' };

const byActivity = (a: Conversation, b: Conversation) =>
  b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id - a.id;

/** Merges rows by id (a later copy wins), so a page that overlaps one already held never repeats a row. */
export function mergeById<T extends { id: number }>(held: T[], incoming: T[]): T[] {
  const ids = new Map(incoming.map((r) => [r.id, r]));
  const kept = held.map((r) => ids.get(r.id) ?? r);
  const known = new Set(held.map((r) => r.id));
  return [...kept, ...incoming.filter((r) => !known.has(r.id))];
}

const withConversation = (s: InboxState, items: Conversation[]): InboxState => ({
  ...s,
  conversations: { ...s.conversations, items: [...items].sort(byActivity) },
});

const patch = (s: InboxState, id: number, fn: (c: Conversation) => Conversation) =>
  withConversation(
    s,
    s.conversations.items.map((c) => (c.id === id ? fn(c) : c)),
  );

export function inboxReducer(s: InboxState, a: InboxAction): InboxState {
  switch (a.type) {
    case 'conversations':
      return {
        ...s,
        conversations: {
          items: [...(a.append ? mergeById(s.conversations.items, a.items) : a.items)].sort(byActivity),
          next: a.next,
        },
        conversationsLoaded: true,
      };
    case 'requests':
      return {
        ...s,
        requests: { items: a.append ? mergeById(s.requests.items, a.items) : a.items, next: a.next },
        requestsLoaded: true,
      };
    case 'upsert':
      return withConversation(s, mergeById(s.conversations.items, [a.conversation]));
    case 'message': {
      const m = a.message;
      const known = s.conversations.items.some((c) => c.id === m.conversationId);
      if (!known) return s; // the provider fetches the conversation and upserts it
      return patch(s, m.conversationId, (c) => {
        if (c.lastMessage && c.lastMessage.id >= m.id) return c; // an echo of what is already shown
        const mine = m.sender.id === a.me;
        return {
          ...c,
          lastMessage: {
            id: m.id,
            senderId: m.sender.id,
            body: m.body,
            deleted: m.deleted,
            createdAt: m.createdAt,
          },
          lastActivityAt: m.createdAt,
          unreadCount: mine || a.open ? c.unreadCount : c.unreadCount + 1,
        };
      });
    }
    case 'deleted':
      return patch(s, a.conversationId, (c) => {
        const last = c.lastMessage;
        if (!last || last.id !== a.messageId) return c;
        return { ...c, lastMessage: { ...last, body: null, deleted: true } };
      });
    case 'read':
      return patch(s, a.conversationId, (c) => ({
        ...c,
        unreadCount: a.userId === a.me ? 0 : c.unreadCount,
        members: c.members.map((m) =>
          m.id === a.userId && a.messageId !== null && a.messageId > (m.lastReadMessageId ?? 0)
            ? { ...m, lastReadMessageId: a.messageId }
            : m,
        ),
      }));
    case 'removed':
      return withConversation(
        s,
        s.conversations.items.filter((c) => c.id !== a.conversationId),
      );
    case 'request':
      return { ...s, requests: { ...s.requests, items: mergeById(s.requests.items, [a.request]).sort(newestFirst) } };
    case 'requestGone':
      return { ...s, requests: { ...s.requests, items: s.requests.items.filter((r) => r.id !== a.id) } };
    case 'reset':
      return emptyInbox;
  }
}

const newestFirst = (a: MessageRequest, b: MessageRequest) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id;

/** Unread messages across the conversations held, shown on the Messages nav item. */
export const unreadTotal = (s: InboxState): number => s.conversations.items.reduce((n, c) => n + c.unreadCount, 0);
