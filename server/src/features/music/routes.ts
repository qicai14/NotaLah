import { Router } from 'express';
import { z } from 'zod';
import { issueMap } from '../../lib/validation';
import { requireAuth } from '../auth/middleware';
import { musicDailyLimiter, musicLimiter } from './rateLimit';
import { MusicUnavailable, searchTracks } from './service';

export const musicRouter = Router();

const searchQuery = z.object({
  q: z
    .string({ error: 'Search text is required' })
    .trim()
    .min(1, 'Search text is required')
    .max(100, 'Search text is too long'),
  instrumental: z.enum(['0', '1'], { error: 'Invalid instrumental flag' }).default('1'),
  page: z.coerce
    .number({ error: 'Invalid page' })
    .int('Invalid page')
    .min(1, 'Invalid page')
    .max(50, 'Invalid page')
    .default(1),
});

musicRouter.get('/search', requireAuth, musicLimiter, musicDailyLimiter, async (req, res) => {
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { q, instrumental, page } = parsed.data;
  try {
    res.json(await searchTracks(q, instrumental === '1', page));
  } catch (err) {
    if (err instanceof MusicUnavailable) return void res.status(err.status).json({ error: err.message });
    throw err;
  }
});
