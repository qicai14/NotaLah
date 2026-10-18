import { describe, expect, it } from 'vitest';
import { chatReducer, emptyChat, seenBy, typingThrottle } from './chatReducer';
import { emptyInbox, inboxReducer, mergeById, unreadTotal, type InboxState } from './inboxReducer';
import type { Conversation, Message } from './types';

const conv = (id: number, over: Partial<Conversation> = {}): Conversation => ({
  id,
  type: 'direct',
  name: null,
  ownerId: null,
  members: [
    { id: 1, displayName: 'Sam', lastReadMessageId: null },
    { id: 2, displayName: 'Dr Lee', lastReadMessageId: null },
  ],
  lastMessage: null,
  unreadCount: 0,
  lastActivityAt: `2026-10-0${id}T10:00:00.000Z`,
  ...over,
});

const msg = (id: number, sender = 2, over: Partial<Message> = {}): Message => ({
  id,
  conversationId: 5,
  sender: { id: sender, displayName: sender === 1 ? 'Sam' : 'Dr Lee' },
  body: `m${id}`,
  deleted: false,
  note: null,
  noteUnavailable: false,
  replyTo: null,
  createdAt: `2026-10-10T10:${String(id).padStart(2, '0')}:00.000Z`,
  ...over,
});

const loaded = (items: Conversation[]): InboxState =>
  inboxReducer(emptyInbox, { type: 'conversations', items, next: null });

describe('socket event reducer', () => {
  it('CLI-TC58: message:new moves the chat to the top, counts unread for others only, and ignores an echo', () => {
    let s = loaded([
      conv(5, { lastActivityAt: '2026-10-09T10:00:00.000Z' }),
      conv(6, { lastActivityAt: '2026-10-09T11:00:00.000Z' }),
    ]);
    expect(s.conversations.items.map((c) => c.id)).toEqual([6, 5]);

    s = inboxReducer(s, { type: 'message', message: msg(10), me: 1, open: false });
    expect(s.conversations.items.map((c) => c.id)).toEqual([5, 6]);
    expect(s.conversations.items[0]!.unreadCount).toBe(1);
    expect(s.conversations.items[0]!.lastMessage).toMatchObject({ id: 10, body: 'm10', senderId: 2 });

    s = inboxReducer(s, { type: 'message', message: msg(10), me: 1, open: false });
    expect(unreadTotal(s)).toBe(1);

    s = inboxReducer(s, { type: 'message', message: msg(11, 1), me: 1, open: false });
    expect(unreadTotal(s)).toBe(1);
    s = inboxReducer(s, { type: 'message', message: msg(12), me: 1, open: true });
    expect(unreadTotal(s)).toBe(1);
  });

  it('CLI-TC59: conversation:read clears my unread and moves a receipt forward only; deleted and removed update the list', () => {
    let s = loaded([
      conv(5, {
        unreadCount: 3,
        lastMessage: { id: 9, senderId: 2, body: 'hi', deleted: false, createdAt: '2026-10-10T10:00:00.000Z' },
      }),
    ]);
    s = inboxReducer(s, { type: 'read', conversationId: 5, userId: 2, messageId: 8, me: 1 });
    expect(s.conversations.items[0]!.unreadCount).toBe(3);
    expect(s.conversations.items[0]!.members[1]!.lastReadMessageId).toBe(8);
    s = inboxReducer(s, { type: 'read', conversationId: 5, userId: 2, messageId: 4, me: 1 });
    expect(s.conversations.items[0]!.members[1]!.lastReadMessageId).toBe(8);
    s = inboxReducer(s, { type: 'read', conversationId: 5, userId: 1, messageId: 9, me: 1 });
    expect(s.conversations.items[0]!.unreadCount).toBe(0);

    s = inboxReducer(s, { type: 'deleted', conversationId: 5, messageId: 9 });
    expect(s.conversations.items[0]!.lastMessage).toMatchObject({ body: null, deleted: true });
    s = inboxReducer(s, { type: 'removed', conversationId: 5 });
    expect(s.conversations.items).toEqual([]);
  });

  it('CLI-TC60: request:new adds one request (newest first) and answering it removes it', () => {
    const r = (id: number, at: string) => ({
      id,
      sender: { id: 3, displayName: 'Ann' },
      body: 'hi',
      note: null,
      noteUnavailable: false,
      createdAt: at,
    });
    let s = inboxReducer(emptyInbox, { type: 'request', request: r(1, '2026-10-10T10:00:00.000Z') });
    s = inboxReducer(s, { type: 'request', request: r(2, '2026-10-10T11:00:00.000Z') });
    s = inboxReducer(s, { type: 'request', request: r(2, '2026-10-10T11:00:00.000Z') });
    expect(s.requests.items.map((x) => x.id)).toEqual([2, 1]);
    s = inboxReducer(s, { type: 'requestGone', id: 2 });
    expect(s.requests.items.map((x) => x.id)).toEqual([1]);
  });
});

describe('paging merge', () => {
  it('CLI-TC61: a later conversation page that overlaps the first adds no repeat and keeps newest-first order', () => {
    let s = inboxReducer(emptyInbox, { type: 'conversations', items: [conv(4), conv(3)], next: 'c1' });
    s = inboxReducer(s, { type: 'conversations', items: [conv(3), conv(2), conv(1)], next: null, append: true });
    expect(s.conversations.items.map((c) => c.id)).toEqual([4, 3, 2, 1]);
    expect(s.conversations.next).toBeNull();
    expect(
      mergeById(
        [{ id: 1, v: 'old' }],
        [
          { id: 1, v: 'new' },
          { id: 2, v: 'x' },
        ],
      ),
    ).toEqual([
      { id: 1, v: 'new' },
      { id: 2, v: 'x' },
    ]);
  });

  it('CLI-TC62: history pages arrive newest first and the chat keeps them oldest first without a repeat', () => {
    let s = chatReducer(emptyChat, { type: 'first', items: [msg(50), msg(49), msg(48)], next: '48' });
    expect(s.messages.map((m) => m.id)).toEqual([48, 49, 50]);
    s = chatReducer(s, { type: 'older', items: [msg(48), msg(47), msg(46)], next: null });
    expect(s.messages.map((m) => m.id)).toEqual([46, 47, 48, 49, 50]);
    expect(s.older).toBeNull();

    s = chatReducer(s, { type: 'new', message: msg(51) });
    s = chatReducer(s, { type: 'new', message: msg(51) });
    expect(s.messages.map((m) => m.id).slice(-2)).toEqual([50, 51]);
    s = chatReducer(s, { type: 'deleted', messageId: 51 });
    expect(s.messages.at(-1)).toMatchObject({ deleted: true, body: null });
    expect(chatReducer(emptyChat, { type: 'new', message: msg(1) })).toBe(emptyChat);
  });

  it('CLI-TC63: Seen sits under my latest message each reader has read', () => {
    const messages = [msg(1, 1), msg(2, 2), msg(3, 1), msg(4, 1)];
    const members = [
      { id: 1, displayName: 'Sam', lastReadMessageId: 4 },
      { id: 2, displayName: 'Dr Lee', lastReadMessageId: 3 },
      { id: 3, displayName: 'Ann', lastReadMessageId: null },
    ];
    expect([...seenBy(messages, members, 1)]).toEqual([[3, ['Dr Lee']]]);
  });
});

describe('typing throttle', () => {
  it('CLI-TC64: sends at most one typing event per window, then again once the window has passed', () => {
    let now = 1000;
    let sent = 0;
    const type = typingThrottle(
      () => sent++,
      2000,
      () => now,
    );
    type();
    now += 500;
    type();
    now += 1400;
    type();
    expect(sent).toBe(1);
    now += 200;
    type();
    expect(sent).toBe(2);
  });
});
