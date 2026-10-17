import { Router } from 'express';
import { requireAuth, requireRole } from '../auth/middleware';
import { usageReport } from './service';

export const usageRouter = Router();

usageRouter.get('/', requireAuth, requireRole('admin'), async (_req, res) => {
  res.json({ usage: await usageReport() });
});
