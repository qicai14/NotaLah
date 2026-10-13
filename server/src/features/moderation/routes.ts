import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { decideLecturer, listPendingLecturers } from '../users/repository';
import { requireAuth, requireRole } from '../auth/middleware';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/lecturer-applications', async (_req, res) => {
  res.json({ applications: await listPendingLecturers() });
});

const reasonSchema = z.string().trim().max(300, 'Reason must be at most 300 characters');

async function decide(req: Request<{ userId: string }>, res: Response, approve: boolean) {
  const userId = Number(req.params.userId);
  if (!/^\d+$/.test(req.params.userId) || userId < 1 || userId > 2147483647) {
    res.status(400).json({ error: 'Invalid user id' });
    return;
  }
  const parsed = reasonSchema.optional().safeParse(req.body?.reason);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const reason = parsed.data || (approve ? 'Approved' : '');
  if (!reason) {
    res.status(400).json({ error: 'Reason is required' });
    return;
  }
  const user = await decideLecturer(userId, req.user!.id, approve, reason);
  if (!user) {
    res.status(404).json({ error: 'No pending lecturer application for this user' });
    return;
  }
  res.json({ user });
}

adminRouter.post('/lecturer-applications/:userId/approve', (req, res) => decide(req, res, true));
adminRouter.post('/lecturer-applications/:userId/reject', (req, res) => decide(req, res, false));
