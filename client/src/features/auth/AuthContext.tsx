import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { api, setSignedIn } from '../../lib/api';
import type { User } from '../../types';
import { clearAllBackups } from '../editor/backup';

export interface RegisterInput {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  programme: string;
  role: 'student' | 'lecturer';
  staffId?: string;
}

interface AuthValue {
  user: User | null;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  /** Replaces the signed-in user (after a profile edit); the auth cookie is unchanged. */
  setUser(user: User): void;
  register(input: RegisterInput): Promise<User>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  const update = (next: User | null) => {
    setSignedIn(next !== null);
    if (next) clearAllBackups(next.id); // a different user signed in on this browser: drop the previous one's backups
    setUserState(next);
  };

  // The token is in an httpOnly cookie the page cannot read, so ask the server who is signed in (D35).
  // A 401 here just means logged out; api() only redirects once a user is known.
  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then(({ user }) => update(user))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const value: AuthValue = {
    user,
    async login(email, password) {
      const next = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      update(next.user);
      return next.user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' }); // on failure the cookie may still be live, so stay signed in
      clearAllBackups();
      update(null);
    },
    setUser(next) {
      if (user) update(next);
    },
    async register(input) {
      const { user } = await api<{ user: User }>('/auth/register', { method: 'POST', body: input });
      return user;
    },
  };

  // Wait for /me to settle, so protected routes do not bounce a signed-in user to /login.
  if (!loaded) return <p role="status">Loading…</p>;
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
