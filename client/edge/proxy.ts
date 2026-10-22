/**
 * Cloudflare Pages Function body (R11, D74): forwards /api/* and /socket.io/* (WebSocket upgrades included) to the
 * Render API, so the browser talks to one origin and the login cookie stays first-party. `public/_routes.json` limits
 * the Function to those two paths.
 */
export async function proxy(
  request: Request,
  apiOrigin: string | undefined,
  send: (req: Request) => Promise<Response> = fetch,
): Promise<Response> {
  if (!apiOrigin) return Response.json({ error: 'API origin is not configured' }, { status: 502 });

  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.delete('Host');
  // Overwrite, never append: a client-sent X-Forwarded-For must not reach the API's per-IP limits (TRUST_PROXY=2).
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For', ip);
  else headers.delete('X-Forwarded-For');

  const body = request.method === 'GET' || request.method === 'HEAD' ? null : request.body;
  return send(
    new Request(new URL(url.pathname + url.search, apiOrigin), {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      // Needed by Node's Request for a streamed body; the Workers runtime ignores it.
      ...(body ? { duplex: 'half' } : {}),
    } as RequestInit),
  );
}
