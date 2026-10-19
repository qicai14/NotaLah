import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { api, ApiError, setSignedIn } from './api';

const respond = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  Promise.resolve({
    status,
    ok: status < 400,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  } as Response);

let fetchMock: ReturnType<typeof vi.fn>;
let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(() => respond(200, { ok: true }));
  assign = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('window', { location: { assign } });
  setSignedIn(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('api wrapper', () => {
  it('CLI-TC1: every method sends the cookie and the CSRF header', async () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      await api('/x', { method, body: method === 'GET' ? undefined : { a: 1 } });
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.credentials).toBe('include');
      expect(init.headers['X-Requested-With']).toBe('notalah');
      if (init.method === 'GET') {
        expect(init.headers['Content-Type']).toBeUndefined();
        expect(init.body).toBeUndefined();
      } else {
        expect(init.headers['Content-Type']).toBe('application/json');
        expect(init.body).toBe('{"a":1}');
      }
    }
  });

  it('CLI-TC2: calls are prefixed with VITE_API_URL and /api', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test');
    await api('/notes');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.test/api/notes');
    vi.stubEnv('VITE_API_URL', '');
    await api('/notes');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/notes');
  });

  it('CLI-TC3: a 401 while signed in redirects to the expired login once', async () => {
    fetchMock.mockImplementation(() => respond(401, { error: 'Unauthorized' }));
    setSignedIn(true);
    await expect(api('/notes')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledWith('/login?expired=1');
    await expect(api('/notes')).rejects.toBeInstanceOf(ApiError);
    expect(assign).toHaveBeenCalledTimes(1);
  });

  it('CLI-TC4: a 401 while signed out does not redirect', async () => {
    fetchMock.mockImplementation(() => respond(401, { error: 'Unauthorized' }));
    await expect(api('/auth/me')).rejects.toMatchObject({ status: 401 });
    expect(assign).not.toHaveBeenCalled();
  });

  it('CLI-TC19: a guest answer while signed in redirects to the expired login; signed out it does not', async () => {
    fetchMock.mockImplementation(() => respond(200, { items: [] }, { 'X-Viewer': 'guest' }));
    await expect(api('/feed')).resolves.toEqual({ items: [] });
    expect(assign).not.toHaveBeenCalled();
    setSignedIn(true);
    await api('/feed');
    expect(assign).toHaveBeenCalledWith('/login?expired=1');
  });

  it('CLI-TC5: the error JSON becomes the thrown message and field errors', async () => {
    fetchMock.mockImplementation(() => respond(400, { error: 'Invalid input', errors: { email: 'Email taken' } }));
    await expect(api('/auth/register', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 400,
      message: 'Invalid input',
      errors: { email: 'Email taken' },
    });
  });
});
