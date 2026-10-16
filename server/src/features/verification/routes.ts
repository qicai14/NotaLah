import { type RequestHandler, Router } from 'express';
import { z } from 'zod';
import { idParam } from '../../lib/validation';
import { requireActive, requireAuth, requireRole, me } from '../auth/middleware';
import { getTarget } from '../engagement/repository';
import { isApprovedLecturer } from '../users/repository';
import { notify } from '../notifications/service';
import * as repo from './repository';

/** Mounted at /api before the notes router. Lecturer-only, never admin (D19). */
export const verificationRouter = Router();

verificationRouter.param('id', idParam('Note not found'));

const remarkSchema = z.string({ error: 'Invalid remark' }).trim().max(300, 'Remark must be at most 300 characters').nullish();

// Role and approval come from the DB on every request (requireAuth); a pending applicant is still a student (D6).
const approved: RequestHandler = (req, res, next) => {
  if (!isApprovedLecturer(me(req))) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const lecturerOnly = [requireAuth, requireRole('lecturer'), approved];

verificationRouter.post('/notes/:id/verify', ...lecturerOnly, requireActive, async (req, res) => {
  const id = Number(req.params.id);
  const t = await getTarget(id, me(req).id);
  if (!t) return res.status(404).json({ error: 'Note not found' });
  const parsed = remarkSchema.safeParse(req.body?.remark);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: { remark: parsed.error.issues[0].message } });
  if (t.authorId === me(req).id || t.isEditor) return res.status(409).json({ error: 'Cannot verify own note' });
  const { added, verification } = await repo.addVerification(id, me(req).id, parsed.data || null);
  if (added) await notify({ type: 'super_like', actorId: me(req).id, noteId: id }, [t.authorId]);
  res.status(added ? 201 : 200).json(verification);
});

// Withdrawal skips the active-account check so a restricted lecturer can still undo (D22 removal rule).
verificationRouter.delete('/notes/:id/verify', ...lecturerOnly, async (req, res) => {
  res.json(await repo.removeVerification(Number(req.params.id), me(req).id));
});
