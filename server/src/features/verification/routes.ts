import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { invalidId } from '../../lib/validation';
import { requireActive, requireAuth, requireRole } from '../auth/middleware';
import { getTarget } from '../engagement/repository';
import { isApprovedLecturer } from '../users/repository';
import * as repo from './repository';

/** Mounted at /api before the notes router. Lecturer-only, never admin (D19). */
export const verificationRouter = Router();

const remarkSchema = z.string({ error: 'Invalid remark' }).trim().max(300, 'Remark must be at most 300 characters').nullish();

// Role and approval come from the DB on every request (requireAuth); a pending applicant is still a student (D6).
const approved: RequestHandler = (req, res, next) => {
  if (!isApprovedLecturer(req.user!)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const lecturerOnly = [requireAuth, requireRole('lecturer'), approved];

verificationRouter.post('/notes/:id/verify', ...lecturerOnly, requireActive, async (req, res) => {
  const id = invalidId(req.params.id) ? undefined : Number(req.params.id);
  const t = id === undefined ? undefined : await getTarget(id, req.user!.id);
  if (!t) return res.status(404).json({ error: 'Note not found' });
  const parsed = remarkSchema.safeParse(req.body?.remark);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: { remark: parsed.error.issues[0].message } });
  if (t.authorId === req.user!.id) return res.status(409).json({ error: 'Cannot verify own note' });
  const { added, verification } = await repo.addVerification(id!, req.user!.id, parsed.data || null);
  res.status(added ? 201 : 200).json(verification);
});

// Withdrawal skips the active-account check so a restricted lecturer can still undo (D22 removal rule).
verificationRouter.delete('/notes/:id/verify', ...lecturerOnly, async (req, res) => {
  if (invalidId(req.params.id)) return res.status(404).json({ error: 'Note not found' });
  res.json(await repo.removeVerification(Number(req.params.id), req.user!.id));
});
