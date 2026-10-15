import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { listModules, listProgrammes, listTerms } from './repository';

export const modulesRouter = Router();
export const programmesRouter = Router();
export const termsRouter = Router();

modulesRouter.use(requireAuth);
modulesRouter.get('/', async (_req, res) => {
  res.json({ modules: await listModules() });
});

// No auth: the register form needs the list before an account exists (D37).
programmesRouter.get('/', async (_req, res) => {
  res.json({ items: await listProgrammes() });
});

// No auth: guests may search (D44), and the term filter is built from this list (FR15).
termsRouter.get('/', async (_req, res) => {
  res.json({ terms: await listTerms() });
});
