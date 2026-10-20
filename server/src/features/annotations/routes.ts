import { Router } from 'express';
import { z } from 'zod';
import { bodyOrEmpty, idParam, issueMap } from '../../lib/validation';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import { LECTURER_REASONS, reportSchema } from '../engagement/report';
import { noteAccess } from '../notes/access';
import { notify } from '../notifications/service';
import { isApprovedLecturer } from '../users/repository';
import * as repo from './repository';

/** Mounted at /api; auth is applied per route (R10, D75). */
export const annotationsRouter = Router();
annotationsRouter.param('noteId', idParam('Note not found'));
annotationsRouter.param('annId', idParam('Annotation not found'));

annotationsRouter.get('/notes/:noteId/annotations', optionalAuth, async (req, res) => {
  const noteId = Number(req.params.noteId);
  const note = await repo.getNote(noteId, viewerId(req), { adminRead: true });
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!note.annotationsOn) return res.json({ annotationsOn: false, annotations: [] });
  res.json({ annotationsOn: true, annotations: await repo.listAnnotations(noteId, viewerId(req)) });
});

const annotationSchema = z.object({
  slideId: z
    .number({ error: 'Invalid slide' })
    .int('Invalid slide')
    .min(1, 'Invalid slide')
    .max(32767, 'Invalid slide'),
  elementId: z.string({ error: 'Invalid element' }).regex(/^[A-Za-z0-9-]{8,36}$/, 'Invalid element'),
  quote: z
    .string({ error: 'Select some text first' })
    .min(1, 'Select some text first')
    .max(300, 'The selection must be at most 300 characters'),
  offset: z
    .number({ error: 'Invalid offset' })
    .int('Invalid offset')
    .min(0, 'Invalid offset')
    .max(1_000_000, 'Invalid offset'),
  body: z
    .string({ error: 'Annotation is required' })
    .trim()
    .min(1, 'Annotation is required')
    .max(500, 'Annotation must be at most 500 characters'),
});

annotationsRouter.post('/notes/:noteId/annotations', requireAuth, requireActive, async (req, res) => {
  const noteId = Number(req.params.noteId);
  const note = await repo.getNote(noteId, me(req).id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (!note.annotationsOn) return res.status(403).json({ error: 'Annotations are turned off for this note' });
  const parsed = annotationSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const a = parsed.data;
  const type = await repo.elementType(noteId, a.slideId, a.elementId);
  if (type !== 'text') {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { elementId: type ? 'Only text can be annotated' : 'That text is not on this slide' },
    });
  }
  const id = await repo.addAnnotation(noteId, me(req).id, a);
  await notify({ type: 'annotation', actorId: me(req).id, noteId }, [note.authorId]);
  res.status(201).json({ annotation: await repo.getAnnotation(id, noteId, me(req).id) });
});

annotationsRouter.delete('/notes/:noteId/annotations/:annId', requireAuth, async (req, res) => {
  const noteId = Number(req.params.noteId);
  const id = Number(req.params.annId);
  const found = await repo.findAnnotation(id, noteId);
  if (!found) return res.status(404).json({ error: 'Annotation not found' });
  const u = me(req).id;
  if (found.annotatorId !== u && found.noteAuthorId !== u) {
    // Someone who cannot see the note learns nothing about its annotations.
    return (await repo.getNote(noteId, u, { adminRead: true }))
      ? res.status(403).json({ error: 'Forbidden' })
      : res.status(404).json({ error: 'Annotation not found' });
  }
  await repo.softDelete(id);
  res.status(204).end();
});

const toggleSchema = z.strictObject({ enabled: z.boolean({ error: 'enabled must be true or false' }) });

// A small PATCH rather than the note PUT: the PUT is a full-deck replace (2 MB, edit lock, optimistic check) and a
// co-author's save must never flip a setting only the owner holds.
annotationsRouter.patch('/notes/:noteId/annotations', requireAuth, requireActive, async (req, res) => {
  req.params.id = req.params.noteId;
  if (!(await noteAccess(req, res, ['owner'], { forbidden: 'Only the owner can change this' }))) return;
  const parsed = toggleSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  await repo.setAnnotationsOn(Number(req.params.noteId), parsed.data.enabled);
  res.json({ annotationsOn: parsed.data.enabled });
});

// A block never stops a report (D49); one open report per reporter and annotation.
annotationsRouter.post('/notes/:noteId/annotations/:annId/report', requireAuth, requireActive, async (req, res) => {
  const noteId = Number(req.params.noteId);
  const id = Number(req.params.annId);
  if (!(await repo.getNote(noteId, me(req).id, { ignoreBlocks: true }))) {
    return res.status(404).json({ error: 'Note not found' });
  }
  const found = await repo.findAnnotation(id, noteId);
  if (!found) return res.status(404).json({ error: 'Annotation not found' });
  const parsed = reportSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success)
    return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { reason, details } = parsed.data;
  const u = me(req);
  if (found.annotatorId === u.id) return res.status(400).json({ error: 'You cannot report your own annotation' });
  if (LECTURER_REASONS.includes(reason) && !isApprovedLecturer(u)) {
    return res.status(403).json({ error: 'This reason is only available to approved lecturers' });
  }
  if (!(await repo.addReport(noteId, id, u.id, reason, details || null))) {
    return res.status(409).json({ error: 'You have already reported this annotation' });
  }
  res.status(201).json({ reported: true });
});
