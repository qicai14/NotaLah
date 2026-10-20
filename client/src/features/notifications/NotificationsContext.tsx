import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { useMessaging, useSocketEvent } from '../messaging/MessagingContext';
import type { Notification, UnreadCount } from './types';

interface NotificationsValue {
  unread: number;
  /** True once the count is known (the first fetch or push); until then 0 means "not loaded". */
  counted: boolean;
  /** Items pushed live this session, newest first. */
  fresh: Notification[];
  /** Marks `ids` (or everything when omitted) read; resolves false if the call failed. */
  markRead: (ids?: number[]) => Promise<boolean>;
}

const NotificationsContext = createContext<NotificationsValue | null>(null);

/**
 * The unread badge and live items (R8, D51), on the messaging provider's socket: `notification:new` brings the item and
 * the new count, `notification:count` follows a mark-read from another tab. The count is refetched on every
 * (re)connection so nothing missed while offline is lost. Must sit inside MessagingProvider.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket, connections } = useMessaging();
  const me = user?.id ?? null;
  const [unread, setUnread] = useState(0);
  const [counted, setCounted] = useState(false);
  const [fresh, setFresh] = useState<Notification[]>([]);

  useEffect(() => {
    setUnread(0);
    setCounted(false);
    setFresh([]);
  }, [me]);

  // Counts pushed by the socket; a fetch that started before one is stale and is dropped.
  const pushes = useRef(0);

  useEffect(() => {
    if (me === null || connections === 0) return;
    let live = true;
    const seen = pushes.current;
    api<{ unreadCount: UnreadCount }>('/notifications/unread-count')
      .then((r) => {
        if (!live || seen !== pushes.current) return;
        setUnread(r.unreadCount.total);
        setCounted(true);
      })
      .catch(() => {}); // the badge stays as it was; the next event or visit corrects it
    return () => {
      live = false;
    };
  }, [me, connections]);

  useSocketEvent<{ notification: Notification; unreadCount: UnreadCount }>('notification:new', (p) => {
    pushes.current += 1;
    setFresh((f) => [p.notification, ...f.filter((n) => n.id !== p.notification.id)].slice(0, 50));
    setUnread(p.unreadCount.total);
    setCounted(true);
  });
  useSocketEvent<{ unreadCount: UnreadCount }>('notification:count', (p) => {
    pushes.current += 1;
    setUnread(p.unreadCount.total);
    setCounted(true);
  });

  const markRead = useCallback(
    async (ids?: number[]) => {
      try {
        const r = await api<{ unreadCount: UnreadCount }>('/notifications/read', {
          method: 'POST',
          body: ids ? { ids } : {},
        });
        // While connected the server also pushes the count; the reply can arrive after a newer push, so it is not used.
        if (!socket?.connected) setUnread(r.unreadCount.total);
        return true;
      } catch {
        return false;
      }
    },
    [socket],
  );

  const value = useMemo(() => ({ unread, counted, fresh, markRead }), [unread, counted, fresh, markRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

/** Unread notifications for the nav badge; 0 for guests and outside the provider. */
export function useNotificationUnread(): number {
  return useContext(NotificationsContext)?.unread ?? 0;
}

export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
