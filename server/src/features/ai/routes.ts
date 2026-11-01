import { LIMITS } from '@notalah/shared';
import { Router } from 'express';
import { z } from 'zod';
import { bodyOrEmpty, issueMap } from '../../lib/validation';
import { requireActive, requireAuth } from '../auth/middleware';
import { AI, aiEnabled } from './config';
import { AiError } from './provider';
import { aiDailyLimiter, aiMinuteLimiter } from './rateLimit';
import { draftOutline } from './service';

export const aiRouter = Router();

// No provider or the kill switch on: the routes do not exist (R28).
aiRouter.use((_req, res, next) => (aiEnabled() ? next() : void res.status(404).json({ error: 'Not found' })));

const outlineBody = z.object({
  text: z
    .string({ error: 'Text is required' })
    .trim()
    .min(1, 'Text is required')
    .max(AI.outlineChars, `Text must be at most ${AI.outlineChars.toLocaleString('en')} characters`),
  currentSlides: z
    .number({ error: 'Invalid slide count' })
    .int('Invalid slide count')
    .min(0, 'Invalid slide count')
    .max(LIMITS.slides - 1, `A Note holds at most ${LIMITS.slides} slides`)
    .default(0),
});

// Validated before the limiters, so a refused body does not spend a call.
aiRouter.post(
  '/outline',
  requireAuth,
  requireActive,
  (req, res, next) => {
    const parsed = outlineBody.safeParse(bodyOrEmpty(req));
    if (!parsed.success)
      return void res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
    res.locals.body = parsed.data;
    next();
  },
  aiMinuteLimiter,
  aiDailyLimiter,
  async (_req, res) => {
    const { text, currentSlides } = res.locals.body as z.infer<typeof outlineBody>;
    try {
      res.json({ outline: await draftOutline(text, currentSlides) });
    } catch (err) {
      if (err instanceof AiError) return void res.status(err.status).json({ error: err.message });
      throw err;
    }
  },
);
