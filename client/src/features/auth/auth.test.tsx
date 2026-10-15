// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSignedIn } from '../../lib/api';
import type { Role, User } from '../../types';
import { AuthProvider, useAuth } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

const student: User = {
  id: 1,
  email: 's@apu.edu.my',
  displayName: 'Sam Student',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};

type Reply = { status: number; body?: unknown };
let routes: Record<string, () => Reply | Promise<Reply>>;

beforeEach(() => {
  setSignedIn(false);
  vi.stubEnv('VITE_API_URL', '');
  routes = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const { status, body } = await (routes[url.replace('/api', '')] ?? (() => ({ status: 404 })))();
      return { status, ok: status < 400, json: () => Promise.resolve(body ?? {}) };
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

let logoutError: unknown;

function Probe() {
  const { user, logout } = useAuth();
  return (
    <>
      <p>{user ? `user:${user.displayName}` : 'anonymous'}</p>
      <button onClick={() => logout().catch((e) => (logoutError = e))}>logout</button>
    </>
  );
}

const mount = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

describe('AuthProvider', () => {
  it('CLI-TC6: shows the loading text until /auth/me settles', async () => {
    let release!: () => void;
    routes['/auth/me'] = () => new Promise((r) => (release = () => r({ status: 200, body: { user: student } })));
    mount();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByText('anonymous')).toBeNull();
    release();
    await screen.findByText('user:Sam Student');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('CLI-TC7: /auth/me gives the signed-in user', async () => {
    routes['/auth/me'] = () => ({ status: 200, body: { user: student } });
    mount();
    expect(await screen.findByText('user:Sam Student')).toBeTruthy();
  });

  it('CLI-TC8: a 401 from /auth/me leaves the user logged out', async () => {
    routes['/auth/me'] = () => ({ status: 401, body: { error: 'Unauthorized' } });
    mount();
    expect(await screen.findByText('anonymous')).toBeTruthy();
  });

  it('CLI-TC9: a successful logout clears the user', async () => {
    routes['/auth/me'] = () => ({ status: 200, body: { user: student } });
    routes['/auth/logout'] = () => ({ status: 204 });
    mount();
    await screen.findByText('user:Sam Student');
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(await screen.findByText('anonymous')).toBeTruthy();
  });

  it('CLI-TC10: a failed logout keeps the user and the error is thrown to the caller', async () => {
    logoutError = undefined;
    routes['/auth/me'] = () => ({ status: 200, body: { user: student } });
    routes['/auth/logout'] = () => ({ status: 500, body: { error: 'Logout failed' } });
    mount();
    await screen.findByText('user:Sam Student');
    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(logoutError).toMatchObject({ message: 'Logout failed' }));
    expect(screen.getByText('user:Sam Student')).toBeTruthy();
  });
});

describe('ProtectedRoute', () => {
  const renderAt = (roles?: Role[]) =>
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/secret']}>
          <Routes>
            <Route path="/login" element={<p>login page</p>} />
            <Route
              path="/secret"
              element={
                <ProtectedRoute roles={roles}>
                  <p>secret content</p>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );

  it('CLI-TC11: a signed-out user is sent to /login', async () => {
    routes['/auth/me'] = () => ({ status: 401 });
    renderAt();
    expect(await screen.findByText('login page')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
  });

  it('CLI-TC12: a student cannot open an admin route, an admin can', async () => {
    routes['/auth/me'] = () => ({ status: 200, body: { user: student } });
    renderAt(['admin']);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('secret content')).toBeNull();
    cleanup();
    routes['/auth/me'] = () => ({ status: 200, body: { user: { ...student, role: 'admin' } } });
    renderAt(['admin']);
    expect(await screen.findByText('secret content')).toBeTruthy();
  });
});
