import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { api, loadSession, saveSession, type Session, type User } from '../lib/api';

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
  logout(): void;
  register(input: RegisterInput): Promise<User>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const update = (next: Session | null) => {
    saveSession(next);
    setSession(next);
  };

  // Refresh the stored user once on load, so an approval or rename shows without logging in again.
  useEffect(() => {
    const current = loadSession();
    if (!current) return;
    api<{ user: User }>('/auth/me')
      .then(({ user }) => {
        if (loadSession()) update({ token: current.token, user }); // ignore if logged out meanwhile
      })
      .catch(() => {});
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    async login(email, password) {
      const next = await api<Session>('/auth/login', { method: 'POST', body: { email, password } });
      update(next);
      return next.user;
    },
    logout() {
      update(null);
    },
    async register(input) {
      const { user } = await api<{ user: User }>('/auth/register', { method: 'POST', body: input });
      return user;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
