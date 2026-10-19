import { Router } from 'express';
import { env } from './env';
import { logger } from './logger';
import { pool } from './pool';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  // Hit /api/health from a browser after the first deploy: ip must be that browser's address, not a proxy's (D65).
  if (env.DEBUG_PROXY) logger.info({ ip: req.ip, forwardedFor: req.get('X-Forwarded-For') ?? null }, 'proxy check');
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    logger.warn({ err }, 'health check: database unreachable');
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
