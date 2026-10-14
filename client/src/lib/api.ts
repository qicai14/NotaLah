// True while the client believes a user is signed in; only then does a 401 mean the session expired.
let signedIn = false;
export function setSignedIn(value: boolean): void {
  signedIn = value;
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

/**
 * Calls the server under /api. The httpOnly auth cookie travels with every call; the custom header is the CSRF
 * guard the server requires on state-changing requests (D35). A 401 on an authenticated call ends the session (UC03 1a).
 */
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'parp' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && signedIn && path !== '/auth/login') {
    signedIn = false;
    window.location.assign('/login?expired=1'); // full reload also drops in-memory auth state
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Please try again.', data.errors);
  return data as T;
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return Object.values(e.errors ?? {})[0] || e.message;
  return 'Could not reach the server. Please try again.';
}
