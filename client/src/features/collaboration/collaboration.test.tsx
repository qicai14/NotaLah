// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { Coauthors } from '../../components/Coauthors';
import { NoteActions } from '../../components/NoteActions';
import type { Note, NoteAccess, User } from '../../types';
import { RequestDialog } from './RequestDialog';
import { ShareDialog } from './ShareDialog';
import SharedNote from './SharedNote';

const askToLogIn = vi.fn();
let signedIn: User | null;

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: signedIn }) }));
vi.mock('../auth/GuestPrompt', () => ({ useGuestPrompt: () => askToLogIn }));
vi.mock('@/features/auth/GuestPrompt', () => ({ useGuestPrompt: () => askToLogIn }));
vi.mock('@/components/board/SlideCarousel', () => ({ SlideCarousel: () => <div data-testid="slides" /> }));

const me: User = {
  id: 1,
  email: 'me@apu.edu.my',
  displayName: 'Lim Qi Cai',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};

const note = (over: Partial<Note> = {}): Note => ({
  id: 9,
  title: 'Normalisation in one page',
  theme: 'light',
  aspect: '4:5',
  music: null,
  assets: {},
  videoStatus: {},
  status: 'published',
  visibility: 'public',
  module: null,
  hashtags: ['sql'],
  slides: [],
  slideCount: 0,
  author: { id: 1, displayName: 'Lim Qi Cai', role: 'student', isVerifiedLecturer: false },
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-02T00:00:00Z',
  publishedAt: '2026-10-02T00:00:00Z',
  counts: { likes: 3, comments: 1, annotations: 0 },
  liked: false,
  bookmarked: false,
  verified: false,
  verifiedBy: null,
  verifiedByMe: false,
  ...over,
});

const access = (over: Partial<NoteAccess> = {}): NoteAccess => ({
  collaborators: [{ user: { id: 2, displayName: 'Aina Rahman' }, role: 'edit', addedAt: '2026-10-02T00:00:00Z' }],
  links: [],
  requests: [],
  ...over,
});

type Reply = { status: number; body?: unknown };
type Call = { method: string; path: string; body?: unknown };
let calls: Call[];
let handlers: Record<string, (body?: unknown) => Reply>;

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
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ method, path, body });
      const key = `${method} ${path}`;
      const handler = handlers[key] ?? handlers[key.split('?')[0]];
      const { status, body: out } = (handler ?? (() => ({ status: 404, body: { error: 'Not found' } })))(body);
      return { status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(out ?? {}) };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const inRouter = (ui: ReactElement, path = '/') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
}

const shareDialog = () => (
  <ShareDialog noteId={9} title="Normalisation in one page" ownerId={1} ownerName="Lim Qi Cai" onClose={() => {}} />
);

describe('collaboration UI', () => {
  it('CLI-TC47: co-author credit joins names with commas and "and", and is absent without co-authors', () => {
    const { container, rerender } = inRouter(
      <Coauthors
        people={[
          { id: 2, displayName: 'Aina' },
          { id: 3, displayName: 'Ben' },
          { id: 4, displayName: 'Chloe' },
        ]}
      />,
    );
    expect(container.textContent).toBe('with Aina, Ben and Chloe');
    expect(screen.getByRole('link', { name: 'Ben' }).getAttribute('href')).toBe('/users/3');
    rerender(
      <MemoryRouter>
        <Coauthors people={[]} />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });

  it('CLI-TC48: More menu offers Share to the owner and Request to collaborate to others, never to an editor', async () => {
    const open = async (n: Note) => {
      inRouter(<NoteActions note={n} onChange={() => {}} />);
      await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    };
    await open(note());
    expect(await screen.findByRole('menuitem', { name: 'Share' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Request to collaborate' })).toBeNull();
    cleanup();

    signedIn = { ...me, id: 5, displayName: 'Viewer' };
    await open(note({ myRole: 'view' }));
    expect(await screen.findByRole('menuitem', { name: 'Request to collaborate' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Share' })).toBeNull();
    cleanup();

    await open(note({ myRole: 'edit' }));
    expect(await screen.findByRole('menuitem', { name: 'Report' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Request to collaborate' })).toBeNull();
    cleanup();

    // A feed card carries no role, so the server decides; the menu does not offer a request that may be refused.
    await open(note());
    expect(await screen.findByRole('menuitem', { name: 'Report' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Request to collaborate' })).toBeNull();
  });

  it('CLI-TC49: a guest who chooses Request to collaborate is asked to log in', async () => {
    signedIn = null;
    inRouter(<NoteActions note={note({ author: { ...note().author, id: 7 }, myRole: null })} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Request to collaborate' }));
    expect(askToLogIn).toHaveBeenCalledWith({ action: 'collaborate', returnTo: '/notes/9' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CLI-TC50: the share dialog lists the owner, collaborators, requests and which links are active', async () => {
    handlers['GET /notes/9/access'] = () => ({
      status: 200,
      body: access({
        links: [{ role: 'view', createdAt: '2026-10-03T00:00:00Z' }],
        requests: [
          {
            id: 4,
            user: { id: 8, displayName: 'Chloe Wong' },
            message: 'I can add examples',
            createdAt: new Date().toISOString(),
          },
        ],
      }),
    });
    inRouter(shareDialog());
    const dialog = await screen.findByRole('dialog', { name: /Share “Normalisation in one page”/ });
    expect(await within(dialog).findByText('Lim Qi Cai (you)')).toBeTruthy();
    expect(within(dialog).getByText('Aina Rahman')).toBeTruthy();
    expect(within(dialog).getByRole('combobox', { name: 'Role for Aina Rahman' })).toHaveProperty('value', 'edit');
    expect(within(dialog).getByText('“I can add examples”')).toBeTruthy();
    expect(within(dialog).getByText(/Active since/)).toBeTruthy();
    expect(within(dialog).getAllByRole('button', { name: 'Create link' })).toHaveLength(1);
  });

  it('CLI-TC51: creating the edit link shows its address once with Copy; revoking is asked first', async () => {
    let links: NoteAccess['links'] = [];
    handlers['GET /notes/9/access'] = () => ({ status: 200, body: access({ links }) });
    handlers['POST /notes/9/links'] = () => {
      links = [{ role: 'edit', createdAt: '2026-10-04T00:00:00Z' }];
      return { status: 201, body: { role: 'edit', token: 't', url: 'http://localhost:5173/share/abc' } };
    };
    handlers['DELETE /notes/9/links/edit'] = () => {
      links = [];
      return { status: 204 };
    };
    inRouter(shareDialog());
    const dialog = await screen.findByRole('dialog');
    const create = await within(dialog).findAllByRole('button', { name: 'Create link' });
    await userEvent.click(create[1]);
    expect(calls).toContainEqual({ method: 'POST', path: '/notes/9/links', body: { role: 'edit' } });
    const address = await within(dialog).findByRole('textbox', { name: 'Edit link address' });
    expect(address).toHaveProperty('value', 'http://localhost:5173/share/abc');
    expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeTruthy();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, revoke' }));
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'DELETE', path: '/notes/9/links/edit', body: undefined }),
    );
    await waitFor(() => expect(within(dialog).queryByRole('textbox', { name: 'Edit link address' })).toBeNull());
  });

  it('CLI-TC52: approving a request posts the chosen role; declining posts decline', async () => {
    let requests = [
      { id: 4, user: { id: 8, displayName: 'Chloe Wong' }, message: null, createdAt: new Date().toISOString() },
      { id: 5, user: { id: 9, displayName: 'Arjun Kumar' }, message: null, createdAt: new Date().toISOString() },
    ];
    handlers['GET /notes/9/access'] = () => ({ status: 200, body: access({ collaborators: [], requests }) });
    handlers['POST /notes/9/requests/4'] = () => {
      requests = requests.filter((r) => r.id !== 4);
      return { status: 200, body: { status: 'approved', role: 'view' } };
    };
    handlers['POST /notes/9/requests/5'] = () => ({ status: 200, body: { status: 'declined' } });
    inRouter(shareDialog());
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(await within(dialog).findByRole('combobox', { name: 'Role for Chloe Wong' }), 'view');
    await userEvent.click(within(dialog).getAllByRole('button', { name: 'Approve' })[0]);
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/notes/9/requests/4',
        body: { decision: 'approve', role: 'view' },
      }),
    );
    await waitFor(() => expect(within(dialog).queryByText('Chloe Wong')).toBeNull());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: 'POST',
        path: '/notes/9/requests/5',
        body: { decision: 'decline', role: 'edit' },
      }),
    );
  });

  it('CLI-TC53: inviting searches people, hides those with access, and puts the chosen role', async () => {
    handlers['GET /notes/9/access'] = () => ({ status: 200, body: access() });
    handlers['GET /search'] = () => ({
      status: 200,
      body: {
        items: [
          { id: 2, displayName: 'Aina Rahman' },
          { id: 3, displayName: 'Aiden Tan' },
        ],
        nextCursor: null,
      },
    });
    handlers['PUT /notes/9/collaborators/3'] = () => ({ status: 200, body: { userId: 3, role: 'view' } });
    inRouter(shareDialog());
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(
      await within(dialog).findByRole('combobox', { name: 'Role for the invited person' }),
      'view',
    );
    await userEvent.type(within(dialog).getByLabelText('Search people'), 'ai');
    const results = await within(dialog).findByRole('list', { name: 'Search results' });
    const invite = await within(results).findByRole('button', { name: 'Invite Aiden Tan' });
    expect(within(results).queryByRole('button', { name: 'Invite Aina Rahman' })).toBeNull();
    await userEvent.click(invite);
    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'PUT', path: '/notes/9/collaborators/3', body: { role: 'view' } }),
    );
  });

  const share = (path = '/share/tok') =>
    inRouter(
      <Routes>
        <Route path="/share/:token" element={<SharedNote />} />
        <Route path="*" element={<Where />} />
      </Routes>,
      path,
    );

  it('CLI-TC54: a guest opening an edit link is asked to log in and sees no note', async () => {
    signedIn = null;
    handlers['GET /share/tok'] = () => ({ status: 401, body: { error: 'Log in to edit this note' } });
    share();
    expect(await screen.findByText('Log in to edit this note')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeTruthy();
    expect(screen.queryByTestId('slides')).toBeNull();
  });

  it('CLI-TC55: a signed-in visitor joins an edit link with the button, then lands on the note', async () => {
    signedIn = { ...me, id: 5, displayName: 'Hafiz Ismail' };
    handlers['GET /share/tok'] = () => ({ status: 200, body: { role: 'edit', note: note() } });
    handlers['POST /share/tok'] = () => ({ status: 200, body: { noteId: 9, role: 'edit' } });
    share();
    expect(await screen.findByText(/invited you to edit/)).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Join as editor' }));
    expect(await screen.findByTestId('where')).toHaveProperty('textContent', '/notes/9');
    expect(calls).toContainEqual({ method: 'POST', path: '/share/tok', body: undefined });
  });

  it('CLI-TC56: a view link opens the note read-only for a guest, with no Join button; a bad link says so', async () => {
    signedIn = null;
    handlers['GET /share/tok'] = () => ({
      status: 200,
      body: { role: 'view', note: note({ coauthors: [{ id: 2, displayName: 'Aina Rahman' }] }) },
    });
    handlers['GET /share/gone'] = () => ({ status: 404, body: { error: 'This link is invalid or was revoked' } });
    share();
    expect(await screen.findByRole('heading', { name: 'Normalisation in one page' })).toBeTruthy();
    expect(screen.getByText(/view only/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Aina Rahman' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join as editor' })).toBeNull();
    cleanup();
    share('/share/gone');
    expect(await screen.findByText('This link does not work')).toBeTruthy();
    expect(screen.getByText('This link is invalid or was revoked')).toBeTruthy();
  });

  it("CLI-TC77: a view link lists the note's annotations read-only for a guest, and shows no button when there are none", async () => {
    signedIn = null;
    handlers['GET /share/tok'] = () => ({ status: 200, body: { role: 'view', note: note() } });
    handlers['GET /share/tok/annotations'] = () => ({
      status: 200,
      body: {
        annotations: [
          {
            id: 1,
            slideId: 1,
            elementId: 'gone-element',
            quote: 'second normal form',
            offset: 0,
            body: 'Check this against 3NF',
            createdAt: '2026-10-21T00:00:00Z',
            author: { id: 2, displayName: 'Aina Rahman', avatarUrl: null, isVerifiedLecturer: false },
            canDelete: false,
          },
        ],
      },
    });
    share();
    await userEvent.click(await screen.findByRole('button', { name: 'Annotations (1)' }));
    expect(await screen.findByText('Check this against 3NF')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Delete|Report/ })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    cleanup();
    handlers['GET /share/tok/annotations'] = () => ({ status: 200, body: { annotations: [] } });
    share();
    expect(await screen.findByRole('heading', { name: 'Normalisation in one page' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Annotations/ })).toBeNull();
  });

  it('CLI-TC57: Request to collaborate sends the trimmed message, blocks one over 300, and shows a duplicate', async () => {
    handlers['POST /notes/9/requests'] = (body) => {
      const sent = calls.filter((c) => c.method === 'POST').length;
      return sent > 1
        ? { status: 409, body: { error: 'You already asked to collaborate on this note' } }
        : { status: 201, body: { id: 1, status: 'pending', echoed: body } };
    };
    const open = () =>
      inRouter(<RequestDialog noteId={9} title="Normalisation" ownerName="Aina Rahman" onClose={() => {}} />);
    open();
    const box = screen.getByLabelText(/Message to the owner/);
    await userEvent.click(box);
    await userEvent.paste('x'.repeat(301));
    expect(screen.getByText('301 / 300')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/at most 300/);
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    await userEvent.clear(box);
    await userEvent.type(box, '  Happy to add examples  ');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText(/Request sent/)).toBeTruthy();
    expect(calls).toContainEqual({
      method: 'POST',
      path: '/notes/9/requests',
      body: { message: 'Happy to add examples' },
    });
    cleanup();
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/already asked/);
  });
});
