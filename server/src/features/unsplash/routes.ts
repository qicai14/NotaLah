import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../lib/env';
import { issueMap } from '../../lib/validation';
import { requireActive, requireAuth } from '../auth/middleware';
import { createLimiter, userKey } from '../auth/rateLimit';
import { ASSETS } from '../assets/config';
import { searchPhotos, trackDownload, UnsplashNotFound, UnsplashUnavailable } from './service';

export const unsplashRouter = Router();

/** Unsplash searches per signed-in user per hour (R22); the demo tier allows 50 an hour for the whole app. */
const unsplashLimiter = createLimiter({
  name: 'unsplash',
  windowMs: 60 * 60_000,
  limit: ASSETS.unsplashSearchesPerHour,
  keyGenerator: userKey,
  message: 'Too many searches. Try again later.',
});

const NOT_CONFIGURED = { error: 'Unsplash is not configured' };
const searchQuery = z.object({
  q: z
    .string({ error: 'Search text is required' })
    .trim()
    .min(1, 'Search text is required')
    .max(100, 'Search text is too long'),
  page: z.coerce
    .number({ error: 'Invalid page' })
    .int('Invalid page')
    .min(1, 'Invalid page')
    .max(50, 'Invalid page')
    .default(1),
});

unsplashRouter.use(requireAuth, (_req, res, next) =>
  env.UNSPLASH_ACCESS_KEY ? next() : void res.status(503).json(NOT_CONFIGURED),
);

const unavailable = (err: unknown, res: import('express').Response) => {
  if (err instanceof UnsplashNotFound) return void res.status(404).json({ error: err.message });
  if (err instanceof UnsplashUnavailable) return void res.status(503).json({ error: err.message });
  throw err;
};

unsplashRouter.get('/search', unsplashLimiter, async (req, res) => {
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  try {
    res.json(await searchPhotos(parsed.data.q, parsed.data.page));
  } catch (err) {
    unavailable(err, res);
  }
});

unsplashRouter.post('/:photoId/download', requireActive, unsplashLimiter, async (req, res) => {
  const photoId = String(req.params.photoId);
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(photoId)) return res.status(404).json({ error: 'Photo not found' });
  try {
    await trackDownload(photoId);
    res.status(204).end();
  } catch (err) {
    unavailable(err, res);
  }
});
