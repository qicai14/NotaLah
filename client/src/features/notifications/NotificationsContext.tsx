import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '../auth/AuthContext';
import { useMessaging } from '../messaging/MessagingContext';
import type { Notification, UnreadCount } from './types';

interface NotificationsValue {
  unread: number;
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
  const [fresh, setFresh] = useState<Notification[]>([]);

  useEffect(() => {
    setUnread(0);
    setFresh([]);
  }, [me]);

  useEffect(() => {
    if (me === null || connections === 0) return;
    let live = true;
    api<{ unreadCount: UnreadCount }>('/notifications/unread-count')
      .then((r) => live && setUnread(r.unreadCount.total))
      .catch(() => {}); // the badge stays as it was; the next event or visit corrects it
    return () => {
      live = false;
    };
  }, [me, connections]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (p: { notification: Notification; unreadCount: UnreadCount }) => {
      setFresh((f) => [p.notification, ...f.filter((n) => n.id !== p.notification.id)].slice(0, 50));
      setUnread(p.unreadCount.total);
    };
    const onCount = (p: { unreadCount: UnreadCount }) => setUnread(p.unreadCount.total);
    socket.on('notification:new', onNew);
    socket.on('notification:count', onCount);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:count', onCount);
    };
  }, [socket]);

  const markRead = useCallback(async (ids?: number[]) => {
    try {
      const r = await api<{ unreadCount: UnreadCount }>('/notifications/read', {
        method: 'POST',
        body: ids ? { ids } : {},
      });
      setUnread(r.unreadCount.total);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(() => ({ unread, fresh, markRead }), [unread, fresh, markRead]);
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
