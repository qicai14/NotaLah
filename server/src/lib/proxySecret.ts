import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { RequestHandler } from 'express';
import { env } from './env';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * True when PROXY_SECRET is unset (local dev) or the request carries it in X-Proxy-Secret (D77). In production only
 * the Pages Function knows it, so a direct call to the public onrender.com URL cannot forge X-Forwarded-For.
 */
export function fromProxy(req: IncomingMessage): boolean {
  if (!env.PROXY_SECRET) return true;
  const sent = req.headers['x-proxy-secret'];
  // Hashing first gives equal lengths, so the compare leaks neither the secret nor its length.
  return typeof sent === 'string' && timingSafeEqual(digest(sent), digest(env.PROXY_SECRET));
}

/** Refuses direct calls; /api/health stays open for Render's health check, which does not pass through the proxy. */
export const requireProxy: RequestHandler = (req, res, next) => {
  if (req.path === '/api/health' || fromProxy(req)) return next();
  res.status(403).json({ error: 'Forbidden' });
};
