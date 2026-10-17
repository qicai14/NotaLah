// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile as ProfileData, User } from '../../types';
import { BlockedAccounts } from './BlockedAccounts';
import Profile from './Profile';

const askToLogIn = vi.fn();
let signedIn: User | null;

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: signedIn }) }));
vi.mock('../auth/GuestPrompt', () => ({ useGuestPrompt: () => askToLogIn }));

const me: User = {
  id: 1,
  email: 'me@apu.edu.my',
  displayName: 'Sam Student',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};

const profile = (over: Partial<ProfileData> = {}): ProfileData => ({
  id: 2,
  displayName: 'Dr Lee',
  role: 'lecturer',
  programme: 'Software Engineering',
  bio: 'Teaches databases.',
  avatarUrl: null,
  isVerifiedLecturer: true,
  followerCount: 12,
  followingCount: 3,
  followedByMe: false,
  followsMe: false,
  isFriend: false,
  likeCount: 40,
  blockedByMe: false,
  notes: [],
  notesNextCursor: null,
  ...over,
});

type Reply = { status: number; body?: unknown };
type Call = { method: string; path: string };
let calls: Call[];
let handlers: Record<string, () => Reply>;

beforeEach(() => {
  calls = [];
  handlers = {};
  signedIn = me;
  askToLogIn.mockReset();
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = url.replace('/api', '');
      const method = init?.method ?? 'GET';
      calls.push({ method, path });
      const { status, body } = (
        handlers[`${method} ${path}`] ?? (() => ({ status: 404, body: { error: 'User not found' } }))
      )();
      return { status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body ?? {}) };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const mount = (path = '/users/2') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/users/:id" element={<Profile />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );

describe('profile page', () => {
  it('CLI-TC29: own profile shows counts, Edit profile and drafts, with no Follow or Message', async () => {
    handlers['GET /users/1'] = () => ({
      status: 200,
      body: {
        user: profile({ id: 1, displayName: 'Sam Student', role: 'student', isVerifiedLecturer: false, draftCount: 2 }),
      },
    });
    mount('/profile');
    expect(await screen.findByRole('heading', { name: /Sam Student/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Edit profile/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: '2 drafts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '12 Followers' })).toBeTruthy();
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Message/ })).toBeNull();
  });

  it('CLI-TC30: Follow posts and becomes Following; a mutual follow reads Friends', async () => {
    handlers['GET /users/2'] = () => ({ status: 200, body: { user: profile() } });
    handlers['POST /users/2/follow'] = () => ({
      status: 201,
      body: { followerCount: 13, followingCount: 3, followedByMe: true, followsMe: true, isFriend: true },
    });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    expect(await screen.findByRole('button', { name: 'Friends' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '13 Followers' })).toBeTruthy();
    expect(calls).toContainEqual({ method: 'POST', path: '/users/2/follow' });
  });

  it('CLI-TC31: Block asks first, then shows the blocked profile with Unblock', async () => {
    handlers['GET /users/2'] = () => ({ status: 200, body: { user: profile() } });
    handlers['POST /users/2/block'] = () => ({ status: 201, body: { blockedByMe: true } });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'More options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Block Dr Lee/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Block Dr Lee?' });
    expect(within(dialog).getByText(/stop following each other/)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Block' }));
    expect(await screen.findByRole('button', { name: 'Unblock' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dr Lee' })).toBeTruthy();
    expect(screen.queryByText('Teaches databases.')).toBeNull();
  });

  it('CLI-TC32: Unblock deletes the block and reloads the full profile', async () => {
    let blocked = true;
    handlers['GET /users/2'] = () => ({
      status: 200,
      body: { user: blocked ? { id: 2, displayName: 'Dr Lee', blockedByMe: true } : profile() },
    });
    handlers['DELETE /users/2/block'] = () => {
      blocked = false;
      return { status: 200, body: { blockedByMe: false } };
    };
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Unblock' }));
    expect(await screen.findByText('Teaches databases.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeTruthy();
  });

  it('CLI-TC33: a 404 shows the plain not-available state with no profile details', async () => {
    mount('/users/9');
    expect(await screen.findByRole('heading', { name: 'This profile is not available' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
  });

  it('CLI-TC34: when the server refuses the block (403) it shows the reason and keeps the dialog open', async () => {
    handlers['GET /users/2'] = () => ({ status: 200, body: { user: profile() } });
    handlers['POST /users/2/block'] = () => ({ status: 403, body: { error: 'Administrators cannot be blocked' } });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'More options' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Block/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Block' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Administrators cannot be blocked');
    expect(screen.queryByRole('button', { name: 'Unblock' })).toBeNull();
  });

  it('CLI-TC35: a guest sees the profile, and Follow opens the guest sheet instead of writing', async () => {
    signedIn = null;
    handlers['GET /users/2'] = () => ({ status: 200, body: { user: profile() } });
    mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Follow' }));
    expect(askToLogIn).toHaveBeenCalledWith({ action: 'follow', returnTo: '/users/2' });
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('CLI-TC36: the Message button is hidden until the inbox exists', async () => {
    handlers['GET /users/2'] = () => ({ status: 200, body: { user: profile() } });
    mount();
    await screen.findByRole('button', { name: 'Follow' });
    expect(screen.queryByText('Message')).toBeNull();
  });

  it('CLI-TC39: an administrator profile has no More menu, so it cannot be blocked from the UI', async () => {
    handlers['GET /users/2'] = () => ({
      status: 200,
      body: { user: profile({ role: 'admin', isVerifiedLecturer: false }) },
    });
    mount();
    await screen.findByRole('button', { name: 'Follow' });
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull();
  });

  it('CLI-TC40: Unblock takes focus on the blocked view, and the name heading after unblocking', async () => {
    let blocked = true;
    handlers['GET /users/2'] = () => ({
      status: 200,
      body: { user: blocked ? { id: 2, displayName: 'Dr Lee', blockedByMe: true } : profile() },
    });
    handlers['DELETE /users/2/block'] = () => {
      blocked = false;
      return { status: 200, body: { blockedByMe: false } };
    };
    mount();
    const unblock = await screen.findByRole('button', { name: 'Unblock' });
    expect(document.activeElement).toBe(unblock);
    await userEvent.click(unblock);
    const h1 = await screen.findByRole('heading', { name: /Dr Lee/ });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('CLI-TC41: a profile note tile hides its slide from the link and from assistive technology', async () => {
    handlers['GET /users/2'] = () => ({
      status: 200,
      body: {
        user: profile({
          notes: [
            {
              id: 7,
              title: 'Joins',
              moduleCode: null,
              publishedAt: null,
              hashtags: [],
              verifiedBy: null,
              aspect: '4:5',
              likes: 0,
              cover: { background: { kind: 'color', color: '#ffffff' }, elements: [] },
              assets: {},
            },
          ],
        }),
      },
    });
    mount();
    const tile = await screen.findByRole('link', { name: /Joins/ });
    expect(tile.querySelector('[inert][aria-hidden="true"]')).not.toBeNull();
  });
});

describe('blocked accounts list', () => {
  it('CLI-TC37: lists blocked people and removes a row after Unblock', async () => {
    handlers['GET /users/me/blocks'] = () => ({
      status: 200,
      body: {
        users: [
          { id: 5, displayName: 'Ann', blockedAt: '2026-10-01T00:00:00Z' },
          { id: 6, displayName: 'Bob', blockedAt: '2026-09-01T00:00:00Z' },
        ],
        nextCursor: null,
      },
    });
    handlers['DELETE /users/5/block'] = () => ({ status: 200, body: { blockedByMe: false } });
    render(
      <MemoryRouter>
        <BlockedAccounts />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Ann')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Unblock Ann' }));
    await waitFor(() => expect(screen.queryByText('Ann')).toBeNull());
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('CLI-TC38: shows an empty message when nobody is blocked', async () => {
    handlers['GET /users/me/blocks'] = () => ({ status: 200, body: { users: [], nextCursor: null } });
    render(
      <MemoryRouter>
        <BlockedAccounts />
      </MemoryRouter>,
    );
    expect(await screen.findByText('You have not blocked anyone.')).toBeTruthy();
  });
});
