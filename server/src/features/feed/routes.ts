import { Router } from 'express';
import { requireAuth, me } from '../auth/middleware';
import { parseKeyset } from '../../lib/keyset';
import { getFeedPage, getFollowingPage } from './service';

export const feedRouter = Router();

feedRouter.get('/', requireAuth, async (req, res) => {
  const tab = req.query.tab;
  if (tab !== undefined && tab !== 'following') return res.status(400).json({ error: 'Invalid tab' });
  const keyset = tab === 'following' ? parseKeyset(req, res, 2, 10) : undefined;
  if (tab === 'following' && !keyset) return;
  const rawAsOf = req.query.asOf;
  const asOf = rawAsOf === undefined ? null : new Date(String(rawAsOf));
  if (asOf !== null && (typeof rawAsOf !== 'string' || Number.isNaN(asOf.getTime()))) {
    return res.status(400).json({ error: 'Invalid asOf' });
  }
  const raw = keyset ? '1' : req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1_000_000) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  res.json(keyset ? await getFollowingPage(me(req).id, keyset, asOf) : await getFeedPage(me(req).id, Number(raw), asOf));
});
