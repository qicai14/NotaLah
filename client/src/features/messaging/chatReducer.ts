import { mergeById } from './inboxReducer';
import type { Message } from './types';

/** One open chat's messages, oldest first, with the cursor for older history. */
interface ChatState {
  messages: Message[];
  older: string | null;
  loaded: boolean;
}

export const emptyChat: ChatState = { messages: [], older: null, loaded: false };

type ChatAction =
  | { type: 'first'; items: Message[]; next: string | null }
  | { type: 'older'; items: Message[]; next: string | null }
  | { type: 'new'; message: Message }
  | { type: 'deleted'; messageId: number }
  | { type: 'reset' };

const oldestFirst = (a: Message, b: Message) => a.id - b.id;

/** History arrives newest first (keyset on id, D50); the view keeps it oldest first and never repeats a message. */
export function chatReducer(s: ChatState, a: ChatAction): ChatState {
  switch (a.type) {
    case 'first':
      return { messages: mergeById(s.messages, a.items).sort(oldestFirst), older: a.next, loaded: true };
    case 'older':
      return { ...s, messages: mergeById(s.messages, a.items).sort(oldestFirst), older: a.next };
    case 'new':
      if (!s.loaded) return s;
      return { ...s, messages: mergeById(s.messages, [a.message]).sort(oldestFirst) };
    case 'deleted':
      return {
        ...s,
        messages: s.messages.map((m) =>
          m.id === a.messageId ? { ...m, body: null, deleted: true, note: null, noteUnavailable: false } : m,
        ),
      };
    case 'reset':
      return emptyChat;
  }
}

/** Ids of the messages whose "Seen" line shows: for each reader, the latest of my messages they have read. */
export function seenBy(
  messages: Message[],
  members: { id: number; displayName: string; lastReadMessageId: number | null }[],
  me: number,
): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const m of members) {
    if (m.id === me || m.lastReadMessageId === null) continue;
    const last = [...messages].reverse().find((x) => x.sender.id === me && !x.deleted && x.id <= m.lastReadMessageId!);
    if (!last) continue;
    out.set(last.id, [...(out.get(last.id) ?? []), m.displayName]);
  }
  return out;
}

/** Calls `send` at most once per window; the server drops anything faster (D50), so the client never sends it. */
export function typingThrottle(send: () => void, windowMs: number, now: () => number = Date.now) {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < windowMs) return;
    last = t;
    send();
  };
}
