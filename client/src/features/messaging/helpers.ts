import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { usePaged } from '@/lib/usePaged';
import type { PersonRow } from '@/types';
import type { Conversation, Member } from './types';

export const GROUP_MAX = 30;
export const GROUP_MIN_OTHERS = 2;
export const BODY_MAX = 2000;
/** The server relays one typing event per conversation per 2 s (D50); asking more often only wastes sends. */
export const TYPING_MS = 2000;

export const otherMember = (c: Conversation, me: number): Member | undefined => c.members.find((m) => m.id !== me);

export const conversationTitle = (c: Conversation, me: number): string =>
  c.type === 'group' ? (c.name ?? 'Group chat') : (otherMember(c, me)?.displayName ?? 'Deleted user');

export function previewText(c: Conversation, me: number): string {
  const last = c.lastMessage;
  if (!last) return c.type === 'group' ? 'Group created' : 'No messages yet';
  const who =
    last.senderId === me
      ? 'You: '
      : c.type === 'group'
        ? `${c.members.find((m) => m.id === last.senderId)?.displayName.split(' ')[0] ?? 'Someone'}: `
        : '';
  return `${who}${last.deleted ? 'Message deleted' : (last.body ?? '')}`;
}

/** Time for a list row or bubble: clock time today, otherwise the date. */
export function shortTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** The signed-in user's friends (a mutual follow, D38), read from their following list 20 at a time. */
export function useFriends() {
  const { user } = useAuth();
  const list = usePaged<PersonRow>(`/users/${user?.id}/following`, 'items');
  const friends = list.items.filter((p) => p.isFriend);
  // A page can hold no friends at all; keep going so the picker is never empty while more pages exist.
  const { hasMore, loading, loadingMore, loadMore, error } = list;
  useEffect(() => {
    if (friends.length < 20 && hasMore && !loading && !loadingMore && !error) void loadMore();
  }, [friends.length, hasMore, loading, loadingMore, loadMore, error]);
  return { ...list, friends };
}
