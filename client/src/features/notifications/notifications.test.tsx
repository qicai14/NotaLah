// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { describe as say, isRead, liveItems, section } from './helpers';
import { NotificationsProvider, useNotificationUnread, useNotifications } from './NotificationsContext';
import type { Notification } from './types';

type Handler = (payload?: unknown) => void;
const handlers: Record<string, Handler> = {};
const socket = { connected: true };
vi.mock('../messaging/MessagingContext', () => ({
  useMessaging: () => ({ socket, connections: 1 }),
  useSocketEvent: (event: string, fn: Handler) => {
    useEffect(() => void (handlers[event] = fn));
  },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
const api = vi.fn();
vi.mock('@/lib/api', () => ({ api: (...a: unknown[]) => api(...a) }));

const item = (id: number, over: Partial<Notification> = {}): Notification => ({
  id,
  type: 'follow',
  read: false,
  createdAt: '2026-10-20T10:00:00.000Z',
  actor: { id: 7, displayName: 'Aina' },
  note: null,
  commentId: null,
  requestId: null,
  requestStatus: null,
  ...over,
});

function Probe() {
  const unread = useNotificationUnread();
  const { fresh, markRead } = useNotifications();
  return (
    <div>
      <p data-testid="badge">{unread}</p>
      <p data-testid="fresh">{fresh.map((n) => n.id).join(',')}</p>
      <button onClick={() => void markRead([1])}>one</button>
    </div>
  );
}

beforeEach(() => {
  api.mockReset();
  api.mockResolvedValue({ unreadCount: { total: 2, byType: {} } });
});
afterEach(cleanup);

describe('R8 UI badge', () => {
  it('NTF-TC19 badge loads the count and follows live events', async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    );
    await screen.findByText('2');
    expect(api).toHaveBeenCalledWith('/notifications/unread-count');
    act(() => handlers['notification:new']({ notification: item(9), unreadCount: { total: 3, byType: {} } }));
    expect(screen.getByTestId('badge').textContent).toBe('3');
    expect(screen.getByTestId('fresh').textContent).toBe('9');
    act(() => handlers['notification:count']({ unreadCount: { total: 0, byType: {} } }));
    expect(screen.getByTestId('badge').textContent).toBe('0');
  });

  it('NTF-TC20 marking read posts the ids; the count comes from the socket while connected, else the reply', async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    );
    await screen.findByText('2');
    api.mockResolvedValueOnce({ unreadCount: { total: 1, byType: {} } });
    await act(async () => screen.getByText('one').click());
    expect(api).toHaveBeenLastCalledWith('/notifications/read', { method: 'POST', body: { ids: [1] } });
    expect(screen.getByTestId('badge').textContent).toBe('2');
    act(() => handlers['notification:count']({ unreadCount: { total: 1, byType: {} } }));
    expect(screen.getByTestId('badge').textContent).toBe('1');
    socket.connected = false;
    api.mockResolvedValueOnce({ unreadCount: { total: 0, byType: {} } });
    await act(async () => screen.getByText('one').click());
    expect(screen.getByTestId('badge').textContent).toBe('0');
    socket.connected = true;
  });
});

describe('R8 UI inbox logic', () => {
  it('NTF-TC21 read state combines the server flag, picked ids and mark-all', () => {
    expect(isRead(item(5), new Set(), 0)).toBe(false);
    expect(isRead(item(5, { read: true }), new Set(), 0)).toBe(true);
    expect(isRead(item(5), new Set([5]), 0)).toBe(true);
    expect(isRead(item(5), new Set(), 5)).toBe(true);
    expect(isRead(item(6), new Set(), 5)).toBe(false);
  });

  it('NTF-TC22 live rows skip loaded ones and respect the filter; rows say where they lead', () => {
    const fresh = [item(3), item(2, { type: 'mention' }), item(1)];
    expect(liveItems(fresh, [item(1)], null).map((n) => n.id)).toEqual([3, 2]);
    expect(liveItems(fresh, [], ['mention']).map((n) => n.id)).toEqual([2]);
    expect(say(item(1)).to).toBe('/users/7');
    expect(say(item(1, { type: 'message_request' })).to).toBe('/messages?tab=requests');
    const note = { id: 4, title: 'Joins' };
    expect(say(item(1, { type: 'collab_declined', note })).to).toBe('/notes/4');
    expect(say(item(1, { type: 'collab_request', note })).to).toBe('/notes/4');
    expect(say(item(1, { type: 'super_like', note: { id: 4, title: 'Joins' } }))).toEqual({
      text: 'Super Liked your note “Joins”',
      to: '/notes/4',
    });
    expect(section('2026-10-20T01:00:00.000Z', new Date('2026-10-20T12:00:00Z'))).toBe('Today');
    expect(section('2026-10-01T01:00:00.000Z', new Date('2026-10-20T12:00:00Z'))).toBe('Earlier');
  });
});
