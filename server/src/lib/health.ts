import { Router } from 'express';
import { logger } from './logger';
import { pool } from './pool';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'up' });
  } catch (err) {
    logger.warn({ err }, 'health check: database unreachable');
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});
