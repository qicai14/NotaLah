import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { issueMap, invalidId } from '../../lib/validation';
import { requireActive, requireAuth } from '../auth/middleware';
import * as repo from './repository';

export const feedRouter = Router();
/** Mounted at /api; auth is applied per route so unrelated /api paths keep their own behaviour. */
export const engagementRouter = Router();

const notFound = (res: Response) => res.status(404).json({ error: 'Note not found' });
const idOf = (req: Request) => (invalidId(req.params.id) ? undefined : Number(req.params.id));
/** The target note id when the viewer may engage with it, else sends 404 and returns undefined. */
async function target(req: Request, res: Response) {
  const id = idOf(req);
  const t = id === undefined ? undefined : await repo.getTarget(id, req.user!.id);
  if (!t) return void notFound(res);
  return { id: id!, ...t };
}

feedRouter.get('/', requireAuth, async (req, res) => {
  const raw = req.query.page ?? '1';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 1_000_000) {
    return res.status(400).json({ error: 'Invalid page' });
  }
  res.json(await repo.getFeedPage(req.user!.id, Number(raw)));
});

// ---- views and likes ----
engagementRouter.post('/notes/:id/view', requireAuth, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  await repo.logView(t.id, req.user!.id);
  res.status(204).end();
});

engagementRouter.post('/notes/:id/like', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const { added, likes } = await repo.likeNote(t.id, req.user!.id);
  res.status(added ? 201 : 200).json({ liked: true, likes });
});

engagementRouter.delete('/notes/:id/like', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  res.json({ liked: false, likes: await repo.unlikeNote(t.id, req.user!.id) });
});

// ---- comments ----
engagementRouter.get('/notes/:id/comments', requireAuth, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  res.json({ comments: await repo.listComments(t.id, req.user!.id) });
});

const commentSchema = z.object({
  body: z.string({ error: 'Comment is required' }).trim().min(1, 'Comment is required').max(1000, 'Comment must be at most 1000 characters'),
  slideNo: z.number({ error: 'Invalid slide number' }).int('Invalid slide number').min(1, 'Invalid slide number').nullish(),
  parentId: z.number({ error: 'Invalid parent comment' }).int('Invalid parent comment').min(1, 'Invalid parent comment').nullish(),
});

engagementRouter.post('/notes/:id/comments', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const parsed = commentSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { body, slideNo = null, parentId = null } = parsed.data;
  if (slideNo !== null && slideNo > t.slideCount) {
    return res.status(400).json({ error: 'Validation failed', errors: { slideNo: 'Slide number is beyond the last slide' } });
  }
  if (parentId !== null) {
    const parent = await repo.getParent(parentId);
    if (!parent || parent.noteId !== t.id) {
      return res.status(400).json({ error: 'Validation failed', errors: { parentId: 'Parent comment not found on this note' } });
    }
    if (parent.parentId !== null) return res.status(400).json({ error: 'Replies are limited to one level' });
  }
  const comment = await repo.addComment(t.id, req.user!.id, { body, slideNo, parentId });
  res.status(201).json({ comment: { ...comment, body, slideNo, parentId } });
});

/** Loads the comment for the viewer or sends 404. */
async function commentOf(req: Request, res: Response) {
  const id = idOf(req);
  const c = id === undefined ? undefined : await repo.getVisibleComment(id, req.user!.id);
  if (!c) return void res.status(404).json({ error: 'Comment not found' });
  return { id: id!, ...c };
}

engagementRouter.delete('/comments/:id', requireAuth, async (req, res) => {
  const c = await commentOf(req, res);
  if (!c) return;
  if (c.authorId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
  await repo.softDeleteComment(c.id);
  res.status(204).end();
});

engagementRouter.post('/comments/:id/like', requireAuth, requireActive, async (req, res) => {
  const c = await commentOf(req, res);
  if (!c) return;
  const { added, likes } = await repo.likeComment(c.id, req.user!.id);
  res.status(added ? 201 : 200).json({ liked: true, likes });
});

engagementRouter.delete('/comments/:id/like', requireAuth, requireActive, async (req, res) => {
  const c = await commentOf(req, res);
  if (!c) return;
  res.json({ liked: false, likes: await repo.unlikeComment(c.id, req.user!.id) });
});

// ---- reports (UC12) ----
const EVERYONE_REASONS = ['inaccurate', 'inappropriate', 'spam', 'other'];
const LECTURER_REASONS = ['plagiarism', 'copyright'];

engagementRouter.post('/notes/:id/report', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const { reason, details } = (req.body ?? {}) as { reason?: unknown; details?: unknown };
  if (typeof reason !== 'string' || ![...EVERYONE_REASONS, ...LECTURER_REASONS].includes(reason)) {
    return res.status(400).json({ error: 'Validation failed', errors: { reason: 'Invalid reason' } });
  }
  if (details != null && (typeof details !== 'string' || details.length > 500)) {
    return res.status(400).json({ error: 'Validation failed', errors: { details: 'Details must be at most 500 characters' } });
  }
  if (t.authorId === req.user!.id) return res.status(400).json({ error: 'You cannot report your own note' });
  const u = req.user!;
  if (LECTURER_REASONS.includes(reason) && !(u.role === 'lecturer' && u.lecturerStatus === 'approved')) {
    return res.status(403).json({ error: 'This reason is only available to approved lecturers' });
  }
  const stored = typeof details === 'string' && details.trim() ? details.trim() : null;
  if (!(await repo.addReport(t.id, u.id, reason, stored))) {
    return res.status(409).json({ error: 'You have already reported this note' });
  }
  res.status(201).json({ reported: true });
});

// ---- bookmarks (UC13) ----
engagementRouter.post('/notes/:id/bookmark', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  await repo.addBookmark(t.id, req.user!.id);
  res.json({ bookmarked: true });
});

engagementRouter.delete('/notes/:id/bookmark', requireAuth, requireActive, async (req, res) => {
  const id = idOf(req);
  if (id === undefined) return notFound(res);
  await repo.removeBookmark(id, req.user!.id); // removal never needs visibility
  res.json({ bookmarked: false });
});

engagementRouter.get('/bookmarks', requireAuth, async (req, res) => {
  res.json({ notes: await repo.listBookmarks(req.user!.id) });
});
