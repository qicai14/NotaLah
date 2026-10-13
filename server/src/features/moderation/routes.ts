import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { decideLecturer, listPendingLecturers } from '../users/repository';
import { requireAuth, requireRole } from '../auth/middleware';
import { invalidId } from '../../lib/validation';
import * as repo from './repository';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/lecturer-applications', async (_req, res) => {
  res.json({ applications: await listPendingLecturers() });
});

const reasonSchema = z.string().trim().max(300, 'Reason must be at most 300 characters');

async function decide(req: Request<{ userId: string }>, res: Response, approve: boolean) {
  const userId = Number(req.params.userId);
  if (invalidId(req.params.userId)) {
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

/** A required trimmed text of 1-300 characters (remark or reason); sends 400 and returns undefined when missing. */
function requiredText(res: Response, value: unknown, label: 'Remark' | 'Reason'): string | undefined {
  const parsed = z.string().trim().min(1).max(300, `${label} must be at most 300 characters`).safeParse(value ?? '');
  if (parsed.success) return parsed.data;
  const tooLong = parsed.error.issues[0].code === 'too_big';
  res.status(400).json({ error: tooLong ? parsed.error.issues[0].message : `${label} is required` });
}

// ---- report queue (UC20) ----
adminRouter.get('/reports', async (_req, res) => {
  res.json({ groups: await repo.listOpenReports() });
});

adminRouter.post('/reports/:noteId/resolve', async (req, res) => {
  if (invalidId(req.params.noteId)) return res.status(400).json({ error: 'Invalid note id' });
  const outcome = req.body?.outcome;
  if (outcome !== 'dismiss' && outcome !== 'hide') return res.status(400).json({ error: 'Outcome must be dismiss or hide' });
  const remark = requiredText(res, req.body?.remark, 'Remark');
  if (remark === undefined) return;
  const resolved = await repo.resolveReports(Number(req.params.noteId), req.user!.id, outcome, remark);
  if (resolved === 0) return res.status(404).json({ error: 'No open reports for this note' });
  res.json({ outcome, resolved });
});

// ---- account management (UC21) ----
adminRouter.get('/users', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  res.json({ users: await repo.searchUsers(q) });
});

const ACTIONS: repo.AccountAction[] = ['restrict', 'suspend', 'reinstate', 'delete'];
adminRouter.post('/users/:userId/:action', async (req, res) => {
  const action = req.params.action as repo.AccountAction;
  if (!ACTIONS.includes(action)) return res.status(404).json({ error: 'Not found' });
  if (invalidId(req.params.userId)) return res.status(400).json({ error: 'Invalid user id' });
  const reason = requiredText(res, req.body?.reason, 'Reason');
  if (reason === undefined) return;
  const out = await repo.applyAccountAction(Number(req.params.userId), req.user!.id, action, reason);
  if (out === 'not_found') return res.status(404).json({ error: 'User not found' });
  if (out === 'admin') return res.status(403).json({ error: 'Administrator accounts cannot be changed here' });
  if (out === 'deleted') return res.status(409).json({ error: 'This account has been deleted' });
  res.json({ user: out });
});
