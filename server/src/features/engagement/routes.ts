import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { idParam, issueMap } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import { isApprovedLecturer } from '../users/repository';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import * as repo from './repository';

/** Mounted at /api; auth is applied per route so unrelated /api paths keep their own behaviour. */
export const engagementRouter = Router();

engagementRouter.param('noteId', idParam('Note not found'));
engagementRouter.param('commentId', idParam('Comment not found'));
async function target(req: Request, res: Response, ignoreBlocks = false) {
  const id = Number(req.params.noteId);
  const t = await repo.getTarget(id, viewerId(req), ignoreBlocks);
  if (!t) return void res.status(404).json({ error: 'Note not found' });
  return { id, ...t };
}

engagementRouter.post('/notes/:noteId/view', requireAuth, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  if (t.authorId !== me(req).id) await repo.logView(t.id, me(req).id); // own views are not interest signals (D22)
  res.status(204).end();
});

engagementRouter.post('/notes/:noteId/like', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const { added, likes } = await repo.likeNote(t.id, me(req).id);
  res.status(added ? 201 : 200).json({ liked: true, likes });
});

engagementRouter.delete('/notes/:noteId/like', requireAuth, async (req, res) => {
  res.json({ liked: false, likes: await repo.unlikeNote(Number(req.params.noteId), me(req).id) }); // no visibility check (D22)
});

engagementRouter.get('/notes/:noteId/comments', optionalAuth, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const page = parseKeyset(req, res, 4);
  if (!page) return;
  const { items, nextCursor } = await repo.listComments(t.id, viewerId(req), page);
  res.json({ comments: items, nextCursor });
});

const commentSchema = z.object({
  body: z.string({ error: 'Comment is required' }).trim().min(1, 'Comment is required').max(1000, 'Comment must be at most 1000 characters'),
  slideNo: z.number({ error: 'Invalid slide number' }).int('Invalid slide number').min(1, 'Invalid slide number').nullish(),
  parentId: z.number({ error: 'Invalid parent comment' }).int('Invalid parent comment').min(1, 'Invalid parent comment').nullish(),
});

engagementRouter.post('/notes/:noteId/comments', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  const parsed = commentSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { body, slideNo = null, parentId = null } = parsed.data;
  if (slideNo !== null && slideNo > t.slideCount) {
    return res.status(400).json({ error: 'Validation failed', errors: { slideNo: 'Slide number is beyond the last slide' } });
  }
  if (parentId !== null) {
    const parent = await repo.getParent(parentId, me(req).id);
    if (!parent || parent.noteId !== t.id) {
      return res.status(400).json({ error: 'Validation failed', errors: { parentId: 'Parent comment not found on this note' } });
    }
    if (parent.parentId !== null) return res.status(400).json({ error: 'Replies are limited to one level' });
  }
  const comment = await repo.addComment(t.id, me(req).id, { body, slideNo, parentId });
  res.status(201).json({ comment: { ...comment, body, slideNo, parentId } });
});

async function commentOf(req: Request, res: Response) {
  const id = Number(req.params.commentId);
  const c = await repo.getVisibleComment(id, me(req).id);
  if (!c) return void res.status(404).json({ error: 'Comment not found' });
  return { id, ...c };
}

engagementRouter.delete('/comments/:commentId', requireAuth, async (req, res) => {
  const id = Number(req.params.commentId);
  const c = await repo.getVisibleComment(id, me(req).id);
  if (c && c.authorId !== me(req).id) return res.status(403).json({ error: 'Forbidden' });
  // Owners may delete their comment even when the note is no longer visible to them (D22).
  if (!(await repo.softDeleteComment(id, me(req).id))) {
    return res.status(404).json({ error: 'Comment not found' });
  }
  res.status(204).end();
});

engagementRouter.post('/comments/:commentId/like', requireAuth, requireActive, async (req, res) => {
  const c = await commentOf(req, res);
  if (!c) return;
  const { added, likes } = await repo.likeComment(c.id, me(req).id);
  res.status(added ? 201 : 200).json({ liked: true, likes });
});

engagementRouter.delete('/comments/:commentId/like', requireAuth, async (req, res) => {
  res.json({ liked: false, likes: await repo.unlikeComment(Number(req.params.commentId), me(req).id) }); // no visibility check (D22)
});

const EVERYONE_REASONS = ['inaccurate', 'inappropriate', 'spam', 'other'];
const LECTURER_REASONS = ['plagiarism', 'copyright'];
const reportSchema = z.object({
  reason: z.enum([...EVERYONE_REASONS, ...LECTURER_REASONS], { error: 'Invalid reason' }),
  details: z.string({ error: 'Invalid details' }).trim().max(500, 'Details must be at most 500 characters').nullish(),
});

// UC12; a block never stops a report, so harassment can still reach moderators (D49)
engagementRouter.post('/notes/:noteId/report', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res, true);
  if (!t) return;
  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { reason, details } = parsed.data;
  const u = me(req);
  if (t.authorId === u.id) return res.status(400).json({ error: 'You cannot report your own note' });
  if (LECTURER_REASONS.includes(reason) && !isApprovedLecturer(u)) {
    return res.status(403).json({ error: 'This reason is only available to approved lecturers' });
  }
  if (!(await repo.addReport(t.id, u.id, reason, details || null))) {
    return res.status(409).json({ error: 'You have already reported this note' });
  }
  res.status(201).json({ reported: true });
});

// UC13
engagementRouter.post('/notes/:noteId/bookmark', requireAuth, requireActive, async (req, res) => {
  const t = await target(req, res);
  if (!t) return;
  await repo.addBookmark(t.id, me(req).id);
  res.json({ bookmarked: true });
});

engagementRouter.delete('/notes/:noteId/bookmark', requireAuth, async (req, res) => {
  await repo.removeBookmark(Number(req.params.noteId), me(req).id); // removal never needs visibility
  res.json({ bookmarked: false });
});

engagementRouter.get('/bookmarks', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2);
  if (!page) return;
  const { items, nextCursor } = await repo.listBookmarks(me(req).id, page);
  res.json({ notes: items, nextCursor });
});
