import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { listModules, listProgrammes } from './repository';

export const modulesRouter = Router();
export const programmesRouter = Router();

modulesRouter.use(requireAuth);
modulesRouter.get('/', async (_req, res) => {
  res.json({ modules: await listModules() });
});

// No auth: the register form needs the list before an account exists (D37).
programmesRouter.get('/', async (_req, res) => {
  res.json({ items: await listProgrammes() });
});
