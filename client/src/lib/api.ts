import type { User } from '../types';

export interface Session {
  token: string;
  user: User;
}

const SESSION_KEY = 'parp.session';

// sessionStorage can throw (privacy modes); the in-memory copy in AuthContext still works then.
export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string> = {},
  ) {
    super(message);
  }
}

/** Calls the server under /api with the bearer token. A 401 on an authenticated call ends the session (UC03 1a). */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = loadSession()?.token;
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token && path !== '/auth/login') {
    saveSession(null);
    window.location.assign('/login?expired=1'); // full reload also drops in-memory auth state
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Please try again.', data.errors);
  return data as T;
}

/** Message to show for any thrown error: the first field error of an ApiError, else its message, else a friendly fallback. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return Object.values(e.errors ?? {})[0] || e.message;
  return 'Could not reach the server. Please try again.';
}
