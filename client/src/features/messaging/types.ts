/** Shapes the messaging API and Socket.io events deliver (D50). */
export interface Member {
  id: number;
  displayName: string;
  lastReadMessageId: number | null;
}

interface LastMessage {
  id: number;
  senderId: number;
  body: string | null;
  deleted: boolean;
  createdAt: string;
}

export interface Conversation {
  id: number;
  type: 'direct' | 'group';
  name: string | null;
  ownerId: number | null;
  members: Member[];
  lastMessage: LastMessage | null;
  unreadCount: number;
  lastActivityAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  sender: { id: number; displayName: string };
  body: string | null;
  deleted: boolean;
  note: { id: number; title: string } | null;
  noteUnavailable: boolean;
  replyTo: { id: number; senderId: number; body: string | null } | null;
  createdAt: string;
}

export interface MessageRequest {
  id: number;
  sender: { id: number; displayName: string };
  body: string;
  note: { id: number; title: string } | null;
  noteUnavailable: boolean;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  next: string | null;
}
