import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { getFeedPage } from './service';

export const feedRouter = Router();

feedRouter.get('/', requireAuth, async (req, res) => {
  const raw = req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1_000_000) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  const rawAsOf = req.query.asOf;
  const asOf = rawAsOf === undefined ? null : new Date(String(rawAsOf));
  if (asOf !== null && (typeof rawAsOf !== 'string' || Number.isNaN(asOf.getTime()))) {
    return res.status(400).json({ error: 'Invalid asOf' });
  }
  res.json(await getFeedPage(req.user!.id, Number(raw), asOf));
});
