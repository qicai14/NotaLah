import { describe, expect, it, vi } from 'vite-plus/test';
import { proxy } from './proxy';

const API = 'https://notalah-api.onrender.com';
const capture = () => {
  const send = vi.fn(async (_req: Request) => new Response('ok', { headers: { 'Set-Cookie': 'notalah_token=t' } }));
  return { send, sent: () => send.mock.calls[0][0] };
};

describe('Pages Function proxy (R11, D74)', () => {
  it('DEP-TC13: overwrites X-Forwarded-For with CF-Connecting-IP and passes cookie, method and body', async () => {
    const { send, sent } = capture();
    const res = await proxy(
      new Request('https://notalah.pages.dev/api/notes?page=2', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '203.0.113.5',
          'X-Forwarded-For': '6.6.6.6',
          Cookie: 'notalah_token=abc',
          'X-Requested-With': 'notalah',
        },
        body: '{"title":"x"}',
      }),
      API,
      send,
    );
    const req = sent();
    expect(req.url).toBe(`${API}/api/notes?page=2`);
    expect(req.method).toBe('POST');
    expect(req.headers.get('X-Forwarded-For')).toBe('203.0.113.5');
    expect(req.headers.get('Cookie')).toBe('notalah_token=abc');
    expect(req.headers.get('X-Requested-With')).toBe('notalah');
    expect(await req.text()).toBe('{"title":"x"}');
    expect(res.headers.get('Set-Cookie')).toBe('notalah_token=t');
  });

  it('DEP-TC14: drops a client X-Forwarded-For without CF-Connecting-IP and keeps WebSocket upgrade headers', async () => {
    const { send, sent } = capture();
    await proxy(
      new Request('https://notalah.pages.dev/socket.io/?EIO=4&transport=websocket', {
        headers: { 'X-Forwarded-For': '6.6.6.6', Upgrade: 'websocket', Origin: 'https://notalah.pages.dev' },
      }),
      API,
      send,
    );
    const req = sent();
    expect(req.url).toBe(`${API}/socket.io/?EIO=4&transport=websocket`);
    expect(req.headers.get('X-Forwarded-For')).toBeNull();
    expect(req.headers.get('Upgrade')).toBe('websocket');
    expect(req.headers.get('Origin')).toBe('https://notalah.pages.dev');
  });

  it('DEP-TC15: fails closed with 502 JSON when API_ORIGIN is unset', async () => {
    const { send } = capture();
    const res = await proxy(new Request('https://notalah.pages.dev/api/health'), undefined, send);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'API origin is not configured' });
    expect(send).not.toHaveBeenCalled();
  });
});
