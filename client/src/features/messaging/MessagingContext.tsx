import {
  createContext,
  type Dispatch,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, apiOrigin, errorText } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { emptyInbox, type InboxAction, type InboxState, inboxReducer, unreadTotal } from './inboxReducer';
import type { Conversation, Message, MessageRequest } from './types';

interface MessagingValue {
  /** The one socket of this session; null for guests and until the first connection attempt. */
  socket: Socket | null;
  /** Counts every (re)connection, so views refetch what they may have missed while offline. */
  connections: number;
  inbox: InboxState;
  dispatch: Dispatch<InboxAction>;
  unread: number;
  error: string | null;
  loadMoreConversations: () => Promise<void>;
  loadMoreRequests: () => Promise<void>;
  /** Fetches one conversation and adds it to the list; undefined when it is not available to this user. */
  fetchConversation: (id: number) => Promise<Conversation | undefined>;
  /** The chat on screen, so its new messages are not counted unread. */
  setOpen: (id: number | null) => void;
}

const MessagingContext = createContext<MessagingValue | null>(null);

/**
 * One Socket.io connection per signed-in session (cookie auth, automatic reconnect), closed on logout and never opened
 * for guests. Keeps the conversation list and requests current from the socket's events (D50).
 */
export function MessagingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const [inbox, dispatch] = useReducer(inboxReducer, emptyInbox);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connections, setConnections] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const open = useRef<number | null>(null);
  const next = useRef({ conversations: inbox.conversations.next, requests: inbox.requests.next });
  next.current = { conversations: inbox.conversations.next, requests: inbox.requests.next };
  const held = useRef(inbox);
  held.current = inbox;

  const fetchConversation = useCallback(async (id: number) => {
    try {
      const { conversation } = await api<{ conversation: Conversation }>(`/conversations/${id}`);
      dispatch({ type: 'upsert', conversation });
      return conversation;
    } catch {
      return undefined;
    }
  }, []);

  const loadFirst = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        api<{ conversations: Conversation[]; nextCursor: string | null }>('/conversations'),
        api<{ requests: MessageRequest[]; nextCursor: string | null }>('/message-requests'),
      ]);
      dispatch({ type: 'conversations', items: c.conversations, next: c.nextCursor });
      dispatch({ type: 'requests', items: r.requests, next: r.nextCursor });
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useEffect(() => {
    dispatch({ type: 'reset' });
    if (me === null) {
      setSocket(null);
      return;
    }
    // WebSocket only: a same-origin polling request carries no Origin header, which the server refuses (D50, D35).
    const s = io(apiOrigin() || undefined, { withCredentials: true, transports: ['websocket'] });
    setSocket(s);
    s.on('connect_error', () => setError('Live updates are offline. Refresh to try again.'));
    // The server cuts a socket when its token expires; reconnecting picks up the cookie the sliding session renewed (D65).
    s.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') s.connect();
    });
    s.on('connect', () => {
      setError(null);
      setConnections((n) => n + 1);
      void loadFirst(); // on a reconnect this also catches up on events missed while offline
    });
    s.on('message:new', ({ message }: { message: Message }) => {
      dispatch({ type: 'message', message, me, open: open.current === message.conversationId });
      // A message for a chat the list does not hold yet (a new direct chat, or one beyond the loaded pages).
      if (!held.current.conversations.items.some((c) => c.id === message.conversationId))
        void fetchConversation(message.conversationId);
    });
    s.on('message:deleted', (p: { conversationId: number; messageId: number }) => dispatch({ type: 'deleted', ...p }));
    s.on('request:new', ({ request }: { request: MessageRequest }) => dispatch({ type: 'request', request }));
    s.on(
      'request:accepted',
      ({ conversationId }: { conversationId: number }) => void fetchConversation(conversationId),
    );
    s.on('conversation:read', (p: { conversationId: number; userId: number; messageId: number | null }) =>
      dispatch({ type: 'read', me, ...p }),
    );
    s.on(
      'conversation:updated',
      ({ conversationId }: { conversationId: number }) => void fetchConversation(conversationId),
    );
    s.on('conversation:removed', ({ conversationId }: { conversationId: number }) =>
      dispatch({ type: 'removed', conversationId }),
    );
    return () => {
      s.close();
      setSocket(null);
    };
  }, [me, loadFirst, fetchConversation]);

  const loadMoreConversations = useCallback(async () => {
    const cursor = next.current.conversations;
    if (!cursor) return;
    const r = await api<{ conversations: Conversation[]; nextCursor: string | null }>(
      `/conversations?cursor=${cursor}`,
    );
    dispatch({ type: 'conversations', items: r.conversations, next: r.nextCursor, append: true });
  }, []);

  const loadMoreRequests = useCallback(async () => {
    const cursor = next.current.requests;
    if (!cursor) return;
    const r = await api<{ requests: MessageRequest[]; nextCursor: string | null }>(
      `/message-requests?cursor=${cursor}`,
    );
    dispatch({ type: 'requests', items: r.requests, next: r.nextCursor, append: true });
  }, []);

  const setOpen = useCallback((id: number | null) => void (open.current = id), []);

  const value = useMemo<MessagingValue>(
    () => ({
      socket,
      connections,
      inbox,
      dispatch,
      unread: unreadTotal(inbox),
      error,
      loadMoreConversations,
      loadMoreRequests,
      fetchConversation,
      setOpen,
    }),
    [socket, connections, inbox, error, loadMoreConversations, loadMoreRequests, fetchConversation, setOpen],
  );
  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

/** Unread messages for the nav badge; 0 for guests and outside the provider. */
export function useUnread(): number {
  return useContext(MessagingContext)?.unread ?? 0;
}

export function useMessaging(): MessagingValue {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error('useMessaging must be used inside MessagingProvider');
  return ctx;
}

/** Subscribes to a socket event while mounted (and again after a new socket). */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const { socket } = useMessaging();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!socket) return;
    const fn = (payload: T) => latest.current(payload);
    socket.on(event, fn);
    return () => void socket.off(event, fn);
  }, [socket, event]);
}
