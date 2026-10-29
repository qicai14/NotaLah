// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { User } from '../../types';
import { MessagingProvider, useMessaging, useUnread } from './MessagingContext';

type Handler = (payload?: unknown) => void;
const sockets: FakeSocket[] = [];
class FakeSocket {
  handlers: Record<string, Handler> = {};
  closed = false;
  connects = 0;
  connect() {
    this.connects += 1;
  }
  on(event: string, fn: Handler) {
    this.handlers[event] = fn;
  }
  off() {}
  emit() {}
  close() {
    this.closed = true;
  }
  fire(event: string, payload?: unknown) {
    this.handlers[event]?.(payload);
  }
}
vi.mock('socket.io-client', () => ({
  io: () => {
    const s = new FakeSocket();
    sockets.push(s);
    return s;
  },
}));

let signedIn: User | null;
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: signedIn }) }));

const sam: User = {
  id: 1,
  email: 'sam@apu.edu.my',
  displayName: 'Sam',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};
const conversation = {
  id: 5,
  type: 'direct',
  name: null,
  ownerId: null,
  members: [
    { id: 1, displayName: 'Sam', lastReadMessageId: null },
    { id: 2, displayName: 'Dr Lee', lastReadMessageId: null },
  ],
  lastMessage: null,
  unreadCount: 1,
  lastActivityAt: '2026-10-10T10:00:00.000Z',
};

function Probe() {
  const { inbox, error } = useMessaging();
  const unread = useUnread();
  return (
    <>
      <p>
        chats {inbox.conversations.items.length} unread {unread}
      </p>
      {error && <p>{error}</p>}
    </>
  );
}

beforeEach(() => {
  sockets.length = 0;
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.includes('/message-requests')
        ? { requests: [], nextCursor: null }
        : { conversations: [conversation], nextCursor: null };
      return { status: 200, ok: true, headers: new Headers(), json: () => Promise.resolve(body) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/** socket.io-client loads with a dynamic import on sign-in (D81), so the socket appears a tick after render. */
const opened = (count = 1) => act(() => vi.waitFor(() => expect(sockets).toHaveLength(count)));

const tree = () => (
  <MessagingProvider>
    <Probe />
  </MessagingProvider>
);

describe('messaging provider', () => {
  it('CLI-TC65: a guest opens no socket; a signed-in session opens one, loads the inbox and closes it on logout', async () => {
    signedIn = null;
    const view = render(tree());
    await act(async () => {}); // a guest never loads the client at all
    expect(sockets).toHaveLength(0);

    signedIn = sam;
    view.rerender(tree());
    await opened();
    await act(async () => sockets[0]!.fire('connect'));
    expect(await screen.findByText('chats 1 unread 1')).toBeTruthy();

    signedIn = null;
    view.rerender(tree());
    expect(sockets[0]!.closed).toBe(true);
    expect(sockets).toHaveLength(1);
    expect(screen.getByText('chats 0 unread 0')).toBeTruthy();
  });

  it('CLI-TC79: logging out before socket.io-client has loaded opens no socket', async () => {
    signedIn = sam;
    const view = render(tree());
    signedIn = null;
    view.rerender(tree());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(sockets).toHaveLength(0);
  });

  it('CLI-TC66: message:new from the other person adds to the unread badge', async () => {
    signedIn = sam;
    render(tree());
    await opened();
    await act(async () => sockets[0]!.fire('connect'));
    await screen.findByText('chats 1 unread 1');
    await act(async () =>
      sockets[0]!.fire('message:new', {
        conversationId: 5,
        message: {
          id: 9,
          conversationId: 5,
          sender: { id: 2, displayName: 'Dr Lee' },
          body: 'hello',
          deleted: false,
          note: null,
          noteUnavailable: false,
          replyTo: null,
          createdAt: '2026-10-10T10:05:00.000Z',
        },
      }),
    );
    expect(screen.getByText('chats 1 unread 2')).toBeTruthy();
  });

  it('DEP-TC9: a socket the server cut (token expiry) renews the cookie through /auth/me, then reconnects after 1-3 s; a dropped transport is left to socket.io; a failed renewal shows offline; logout cancels', async () => {
    signedIn = sam;
    const view = render(tree());
    await opened();
    await act(async () => sockets[0]!.fire('connect'));
    const fetched = vi.mocked(fetch);
    const renewals = () => fetched.mock.calls.filter(([url]) => url === '/api/auth/me').length;
    vi.useFakeTimers();
    try {
      sockets[0]!.fire('disconnect', 'transport close');
      await vi.advanceTimersByTimeAsync(5000);
      expect([renewals(), sockets[0]!.connects]).toEqual([0, 0]);
      sockets[0]!.fire('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(999);
      expect([renewals(), sockets[0]!.connects]).toEqual([0, 0]);
      await vi.advanceTimersByTimeAsync(2001);
      expect([renewals(), sockets[0]!.connects]).toEqual([1, 1]);

      fetched.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      await act(async () => {
        sockets[0]!.fire('disconnect', 'io server disconnect');
        await vi.advanceTimersByTimeAsync(3000);
      });
      expect([renewals(), sockets[0]!.connects]).toEqual([2, 1]);
      expect(screen.getByText(/Live updates are offline/)).toBeTruthy();

      sockets[0]!.fire('disconnect', 'io server disconnect');
      signedIn = null;
      view.rerender(tree());
      await vi.advanceTimersByTimeAsync(5000);
      expect([renewals(), sockets[0]!.connects]).toEqual([2, 1]);
    } finally {
      vi.useRealTimers();
    }
  });

  /** Signs in, connects and switches to fake timers (Date included), returning the renewal and reconnect counts. */
  const cutReady = async () => {
    signedIn = sam;
    render(tree());
    await opened();
    await act(async () => sockets[0]!.fire('connect'));
    vi.useFakeTimers();
    const counts = () => [
      vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/auth/me').length,
      sockets[0]!.connects,
    ];
    return counts;
  };
  const minutes = (n: number) => vi.advanceTimersByTimeAsync(n * 60_000);

  it('CLI-TC93: a tab with no pointer or key activity for over 50 minutes leaves a server cut standing: no /auth/me, no reconnect, no offline banner', async () => {
    const counts = await cutReady();
    try {
      await minutes(51);
      sockets[0]!.fire('disconnect', 'io server disconnect');
      await minutes(120);
      expect(counts()).toEqual([0, 0]);
      expect(screen.queryByText(/Live updates are offline/)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('CLI-TC94: activity within the last 50 minutes keeps the jittered renew-then-reconnect on a server cut', async () => {
    const counts = await cutReady();
    try {
      await minutes(40);
      window.dispatchEvent(new Event('pointermove'));
      await minutes(11);
      sockets[0]!.fire('disconnect', 'io server disconnect');
      await vi.advanceTimersByTimeAsync(3000);
      expect(counts()).toEqual([1, 1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('CLI-TC95: after an idle cut, the next key or pointer activity renews and reconnects once; more activity does not repeat it', async () => {
    const counts = await cutReady();
    try {
      await minutes(51);
      sockets[0]!.fire('disconnect', 'io server disconnect');
      await minutes(5);
      window.dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(999);
      expect(counts()).toEqual([0, 0]);
      await vi.advanceTimersByTimeAsync(2001);
      expect(counts()).toEqual([1, 1]);
      window.dispatchEvent(new Event('pointerdown'));
      await vi.advanceTimersByTimeAsync(3000);
      expect(counts()).toEqual([1, 1]);
    } finally {
      vi.useRealTimers();
    }
  });
});
