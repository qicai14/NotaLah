export type NotificationType =
  | 'mention'
  | 'super_like'
  | 'follow'
  | 'lecturer_approved'
  | 'lecturer_rejected'
  | 'note_hidden'
  | 'message_request'
  | 'collab_request'
  | 'collab_approved'
  | 'collab_declined'
  | 'edited_since_verification';

/** One inbox item as the API and the `notification:new` event return it (R8, D51). */
export interface Notification {
  id: number;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: { id: number; displayName: string } | null;
  note: { id: number; title: string } | null;
  commentId: number | null;
  requestId: number | null;
  requestStatus: string | null;
}

/** The server's unread payload; the badge only needs the total. */
export interface UnreadCount {
  total: number;
}
