import { Router } from 'express';
import { listProgrammes } from './repository';

export const programmesRouter = Router();

// No auth: the register form needs the list before an account exists (D37).
programmesRouter.get('/', async (_req, res) => {
  res.json({ items: await listProgrammes() });
});
