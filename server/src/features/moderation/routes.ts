import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { decideLecturer, listPendingLecturers } from '../users/repository';
import { requireAuth, requireRole, me } from '../auth/middleware';
import { bodyOrEmpty, idParam, issueMap } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import * as modules from '../modules/repository';
import { isUniqueViolation } from '../../lib/pool';
import * as repo from './repository';
import { disconnectUser } from '../messaging/socket';
import { notify } from '../notifications/service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));
adminRouter.param('userId', idParam('Invalid user id', 400));
adminRouter.param('noteId', idParam('Invalid note id', 400));
adminRouter.param('moduleId', idParam('Module not found'));
adminRouter.param('termId', idParam('Term not found'));

adminRouter.get('/lecturer-applications', async (_req, res) => {
  res.json({ applications: await listPendingLecturers() });
});

async function decide(req: Request<{ userId: string }>, res: Response, approve: boolean) {
  const userId = Number(req.params.userId);
  const blank = typeof req.body?.reason !== 'string' || !req.body.reason.trim();
  const reason = approve && blank ? 'Approved' : requiredText(res, req.body?.reason, 'Reason'); // reason optional only when approving (D18)
  if (reason === undefined) return;
  const user = await decideLecturer(userId, me(req).id, approve, reason);
  if (!user) {
    res.status(404).json({ error: 'No pending lecturer application for this user' });
    return;
  }
  await notify({ type: approve ? 'lecturer_approved' : 'lecturer_rejected', actorId: null }, [userId]);
  res.json({ user });
}

adminRouter.post('/lecturer-applications/:userId/approve', (req, res) => decide(req, res, true));
adminRouter.post('/lecturer-applications/:userId/reject', (req, res) => decide(req, res, false));

/** A required trimmed text of 1-300 characters (remark or reason); sends 400 and returns undefined when missing. */
function requiredText(res: Response, value: unknown, label: 'Remark' | 'Reason'): string | undefined {
  const parsed = z
    .string()
    .trim()
    .min(1)
    .max(300, `${label} must be at most 300 characters`)
    .safeParse(value ?? '');
  if (parsed.success) return parsed.data;
  const tooLong = parsed.error.issues[0].code === 'too_big';
  res.status(400).json({ error: tooLong ? parsed.error.issues[0].message : `${label} is required` });
}

const REPORT_PAGE = 20;

adminRouter.get('/reports', async (req, res) => {
  const page = parseKeyset(req, res, 2, REPORT_PAGE);
  if (!page) return;
  const { items, nextCursor } = await repo.listOpenReports(page);
  res.json({ groups: items, nextCursor });
});

adminRouter.get('/reports/:noteId', async (req, res) => {
  const group = await repo.getOpenReportGroup(Number(req.params.noteId));
  if (!group) return res.status(404).json({ error: 'No open reports for this note' });
  res.json({ group });
});

adminRouter.post('/reports/:noteId/resolve', async (req, res) => {
  const outcome = req.body?.outcome;
  if (outcome !== 'dismiss' && outcome !== 'hide')
    return res.status(400).json({ error: 'Outcome must be dismiss or hide' });
  const remark = requiredText(res, req.body?.remark, 'Remark');
  if (remark === undefined) return;
  const noteId = Number(req.params.noteId);
  const { resolved, hiddenAuthorId } = await repo.resolveReports(noteId, me(req).id, outcome, remark);
  if (resolved === 0) return res.status(404).json({ error: 'No open reports for this note' });
  if (hiddenAuthorId !== null) await notify({ type: 'note_hidden', actorId: null, noteId }, [hiddenAuthorId]);
  res.json({ outcome, resolved });
});

adminRouter.get('/users', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
  res.json({ users: await repo.searchUsers(q) });
});

const ACTIONS: repo.AccountAction[] = ['restrict', 'suspend', 'reinstate', 'delete'];
adminRouter.post('/users/:userId/:action', async (req, res) => {
  const action = ACTIONS.find((a) => a === req.params.action);
  if (!action) return res.status(404).json({ error: 'Not found' });
  const reason = requiredText(res, req.body?.reason, 'Reason');
  if (reason === undefined) return;
  const out = await repo.applyAccountAction(Number(req.params.userId), me(req).id, action, reason);
  if (out === 'not_found') return res.status(404).json({ error: 'User not found' });
  if (out === 'admin') return res.status(403).json({ error: 'Administrator accounts cannot be changed here' });
  if (out === 'deleted') return res.status(409).json({ error: 'This account has been deleted' });
  if (action === 'suspend' || action === 'delete') disconnectUser(out.id);
  res.json({ user: out });
});

const moduleName = z
  .string({ error: 'Name is required' })
  .trim()
  .min(1, 'Name is required')
  .max(150, 'Name must be at most 150 characters');
const moduleProgramme = z
  .string({ error: 'Programme is required' })
  .trim()
  .min(1, 'Programme is required')
  .max(100, 'Programme must be at most 100 characters');
const newModuleSchema = z.object({
  code: z
    .string({ error: 'Code is required' })
    .trim()
    .toUpperCase()
    .min(1, 'Code is required')
    .max(20, 'Code must be at most 20 characters')
    .regex(/^[A-Z0-9][A-Z0-9-]*$/, 'Code may contain only letters, digits and hyphens'),
  name: moduleName,
  programme: moduleProgramme,
});
const moduleEditSchema = z.strictObject({ name: moduleName.optional(), programme: moduleProgramme.optional() });

adminRouter.get('/modules', async (_req, res) => {
  res.json({ modules: await modules.listAdminModules() });
});

adminRouter.post('/modules', async (req, res) => {
  const parsed = newModuleSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { code, name, programme } = parsed.data;
  try {
    res.status(201).json({ module: await modules.createModule({ code, name, programme }) });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'Module code already exists' });
    throw err;
  }
});

// The code is immutable: notes and the dissertation refer to it, so only name and programme can change.
adminRouter.patch('/modules/:moduleId', async (req, res) => {
  const parsed = moduleEditSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { name, programme } = parsed.data;
  if (name === undefined && programme === undefined) return res.status(400).json({ error: 'Nothing to change' });
  const updated = await modules.updateModule(Number(req.params.moduleId), { name, programme });
  if (!updated) return res.status(404).json({ error: 'Module not found' });
  res.json({ module: updated });
});

const termSchema = z
  .object({
    name: z
      .string({ error: 'Name is required' })
      .trim()
      .min(1, 'Name is required')
      .max(50, 'Name must be at most 50 characters'),
    startDate: z.iso.date({ error: 'Start date must be a date (YYYY-MM-DD)' }),
    endDate: z.iso.date({ error: 'End date must be a date (YYYY-MM-DD)' }),
  })
  .refine((t) => t.startDate < t.endDate, { path: ['endDate'], message: 'End date must be after the start date' });

adminRouter.get('/terms', async (_req, res) => {
  res.json({ terms: await modules.listTerms() });
});

// Overlapping terms are allowed: intakes differ per programme (D48).
adminRouter.post('/terms', async (req, res) => {
  const parsed = termSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  try {
    res.status(201).json({ term: await modules.createTerm(parsed.data) });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'A term with this name already exists' });
    throw err;
  }
});

adminRouter.put('/terms/:termId', async (req, res) => {
  const parsed = termSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  try {
    const term = await modules.updateTerm(Number(req.params.termId), parsed.data);
    if (!term) return res.status(404).json({ error: 'Term not found' });
    res.json({ term });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'A term with this name already exists' });
    throw err;
  }
});

adminRouter.delete('/terms/:termId', async (req, res) => {
  if (!(await modules.deleteTerm(Number(req.params.termId)))) return res.status(404).json({ error: 'Term not found' });
  res.status(204).end();
});
