import type { Notification, NotificationType } from './types';

/** The inbox filter chips (wireframe 43) and the server types each one asks for. */
export const FILTERS: { label: string; types: NotificationType[] | null }[] = [
  { label: 'All', types: null },
  { label: 'Mentions', types: ['mention'] },
  { label: 'Follows', types: ['follow'] },
  { label: 'Super Likes', types: ['super_like'] },
  { label: 'Requests', types: ['message_request', 'collab_request', 'collab_approved', 'collab_declined'] },
  {
    label: 'System',
    types: ['lecturer_approved', 'lecturer_rejected', 'note_hidden', 'annotation_hidden', 'edited_since_verification'],
  },
];

/** What a row says (an actor's name is rendered bold before `text`) and where it leads. */
export function describe(n: Notification): { text: string; to: string | null } {
  const title = n.note ? `“${n.note.title}”` : 'a note';
  const note = n.note ? `/notes/${n.note.id}` : null;
  switch (n.type) {
    case 'mention':
      return { text: `mentioned you in a comment on ${title}`, to: note };
    case 'super_like':
      return { text: `Super Liked your note ${title}`, to: note };
    case 'follow':
      return { text: 'started following you', to: n.actor ? `/users/${n.actor.id}` : null };
    case 'lecturer_approved':
      return { text: 'Your lecturer account was approved.', to: '/profile' };
    case 'lecturer_rejected':
      return { text: 'Your lecturer application was not approved.', to: '/profile' };
    case 'note_hidden':
      return { text: `Your ${n.note ? `note ${title}` : 'note'} was hidden by an administrator.`, to: note };
    case 'message_request':
      return { text: 'wants to message you', to: '/messages?tab=requests' };
    case 'collab_request':
      return { text: `asked to collaborate on ${title}`, to: note };
    case 'collab_approved':
      return { text: `approved your request to collaborate on ${title}`, to: note };
    case 'collab_declined':
      return { text: `declined your request to collaborate on ${title}`, to: note };
    case 'annotation':
      return { text: `annotated your note ${title}`, to: note };
    case 'annotation_hidden':
      return { text: `Your annotation on ${title} was removed by an administrator.`, to: note };
    case 'edited_since_verification':
      return { text: `${title} was edited since you verified it.`, to: note };
  }
}

/** Read now: the server said so, or the person marked it here (one id, or everything up to `readUpTo`). */
export const isRead = (n: Notification, readIds: ReadonlySet<number>, readUpTo: number) =>
  n.read || readIds.has(n.id) || n.id <= readUpTo;

/** Live items not yet in the loaded pages, newest first, limited to the active filter. */
export function liveItems(fresh: Notification[], loaded: Notification[], types: NotificationType[] | null) {
  const have = new Set(loaded.map((n) => n.id));
  return fresh.filter((n) => !have.has(n.id) && (!types || types.includes(n.type)));
}

/** Section heading for a row: Today, This week or Earlier. */
export function section(iso: string, now = new Date()): 'Today' | 'This week' | 'Earlier' {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString()) return 'Today';
  return now.getTime() - d.getTime() < 7 * 86400_000 ? 'This week' : 'Earlier';
}
