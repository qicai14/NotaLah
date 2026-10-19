// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { emptyInbox, inboxReducer } from './inboxReducer';
import { StartChat } from './StartChat';

const inbox = inboxReducer(emptyInbox, { type: 'conversations', items: [], next: null });

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 1 } }) }));
vi.mock('./MessagingContext', () => ({
  useMessaging: () => ({ inbox, loadMoreConversations: vi.fn() }),
  useSocketEvent: () => {},
}));

type Reply = { status: number; body: unknown };
let replies: Record<string, Reply>;
let posted: unknown[];

beforeEach(() => {
  posted = [];
  replies = {};
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${url.replace('/api', '')}`;
      if (init?.body) posted.push(JSON.parse(String(init.body)));
      const { status, body } = replies[key] ?? { status: 404, body: { error: 'Not found' } };
      return { status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const profile = (isFriend: boolean) => ({ user: { id: 2, displayName: 'Dr Lee', isFriend, blockedByMe: false } });

function Where() {
  const { pathname } = useLocation();
  return <p>at {pathname}</p>;
}

const mount = () =>
  render(
    <MemoryRouter initialEntries={['/messages?to=2']}>
      <Routes>
        <Route
          path="/messages"
          element={<StartChat toId={2} note={{ id: 7, title: 'Normal forms' }} onBack={() => {}} />}
        />
        <Route path="/messages/:id" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

describe('starting a chat', () => {
  it('CLI-TC67: a non-friend is told the first message is a request; after sending it shows Request sent with the note', async () => {
    replies['GET /users/2'] = { status: 200, body: profile(false) };
    replies['POST /messages'] = { status: 202, body: { request: { id: 3, status: 'pending' } } };
    mount();
    expect(await screen.findByText(/goes to Dr Lee as a request/)).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Message'), 'Could you share your notes?');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('Request sent')).toBeTruthy();
    expect(screen.getByText('Could you share your notes?')).toBeTruthy();
    expect(screen.getByText(/Normal forms/)).toBeTruthy();
    expect(posted).toEqual([{ toUserId: 2, body: 'Could you share your notes?', noteId: 7 }]);
    expect(screen.queryByLabelText('Message')).toBeNull();
  });

  it('CLI-TC68: a friend sends straight into a conversation and the view moves to it; a pending request shows its error', async () => {
    replies['GET /users/2'] = { status: 200, body: profile(true) };
    replies['POST /messages'] = { status: 201, body: { conversationId: 9, message: { id: 1 } } };
    mount();
    expect(await screen.findByText('You are friends. Say hello.')).toBeTruthy();
    await userEvent.type(screen.getByLabelText('Message'), 'Hi{Enter}');
    expect(await screen.findByText('at /messages/9')).toBeTruthy();

    cleanup();
    replies['GET /users/2'] = { status: 200, body: profile(false) };
    replies['POST /messages'] = { status: 409, body: { error: 'A message request between you is already pending' } };
    mount();
    await userEvent.type(await screen.findByLabelText('Message'), 'Again{Enter}');
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'You already have a request waiting with this person.',
    );
  });

  it('CLI-TC69: someone who blocked you or does not exist shows the unavailable state, and one you blocked offers their profile', async () => {
    mount();
    expect(await screen.findByText('This conversation is not available')).toBeTruthy();
    cleanup();
    replies['GET /users/2'] = { status: 200, body: { user: { id: 2, displayName: 'Dr Lee', blockedByMe: true } } };
    mount();
    expect(await screen.findByText('You blocked Dr Lee')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});
