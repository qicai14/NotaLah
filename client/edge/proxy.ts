/**
 * Cloudflare Pages Function body (R11, D74, D77): forwards /api/* and /socket.io/* (WebSocket upgrades included) to the
 * Render API, so the browser talks to one origin and the login cookie stays first-party. `public/_routes.json` limits
 * the Function to those two paths.
 */
export interface ProxyEnv {
  API_ORIGIN?: string;
  /** Proves to the API that the request came through this proxy; Render refuses requests without it. */
  PROXY_SECRET?: string;
}

export async function proxy(
  request: Request,
  { API_ORIGIN, PROXY_SECRET }: ProxyEnv,
  send: (req: Request) => Promise<Response> = fetch,
): Promise<Response> {
  if (!API_ORIGIN || !PROXY_SECRET) return Response.json({ error: 'API proxy is not configured' }, { status: 502 });

  const url = new URL(request.url);
  // Only path and query are copied, so no request path (e.g. one normalising to //evil.com) can change the host.
  const target = new URL(API_ORIGIN);
  target.pathname = url.pathname;
  target.search = url.search;

  const headers = new Headers(request.headers);
  headers.delete('Host');
  headers.set('X-Proxy-Secret', PROXY_SECRET);
  // Overwrite, never append: a client-sent X-Forwarded-For must not reach the API's per-IP limits (TRUST_PROXY=2).
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);
  else headers.delete('X-Forwarded-For');

  const body = request.method === 'GET' || request.method === 'HEAD' ? null : request.body;
  try {
    return await send(
      new Request(target, {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        // Needed by Node's Request for a streamed body; the Workers runtime ignores it.
        ...(body ? { duplex: 'half' } : {}),
      } as RequestInit),
    );
  } catch {
    return Response.json({ error: 'API unreachable' }, { status: 502 });
  }
}
