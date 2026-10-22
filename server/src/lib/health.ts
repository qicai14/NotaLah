import { Router } from 'express';
import { env } from './env';
import { logger } from './logger';
import { pool } from './pool';

export const healthRouter = Router();

// Liveness only (D81): Render, Docker and UptimeRobot poll this, so it never touches Postgres and Neon can scale to zero.
healthRouter.get('/', (req, res) => {
  // Hit /api/health from a browser after the first deploy: ip must be that browser's address, not a proxy's (D65).
  if (env.DEBUG_PROXY) logger.info({ ip: req.ip, forwardedFor: req.get('X-Forwarded-For') ?? null }, 'proxy check');
  res.json({ status: 'ok', version: env.RENDER_GIT_COMMIT });
});

/** Readiness: one `SELECT 1`, for manual checks; behind the proxy secret, unlike the liveness route (D81). */
healthRouter.get('/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up', version: env.RENDER_GIT_COMMIT });
  } catch (err) {
    logger.warn({ err }, 'health check: database unreachable');
    res.status(503).json({ status: 'degraded', db: 'down', version: env.RENDER_GIT_COMMIT });
  }
});
