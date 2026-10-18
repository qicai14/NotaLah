import { Router } from 'express';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import { idParam } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import {
  createNote,
  getNoteMeta,
  getVisibleNote,
  listDrafts,
  NOT_EDITABLE,
  replaceNote,
  softDeleteNote,
} from './repository';
import { moduleExists } from '../modules/repository';
import { findBadAsset, parseBaseUpdatedAt, parseNoteBody } from './service';
import { notifyVoidedVerifiers } from '../notifications/service';

export const notesRouter = Router();
notesRouter.param('id', idParam('Note not found'));

notesRouter.get('/drafts', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2);
  if (!page) return;
  const { items, nextCursor } = await listDrafts(me(req).id, page);
  res.json({ notes: items, nextCursor });
});

notesRouter.post('/', requireAuth, requireActive, async (req, res) => {
  const parsed = parseNoteBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'Validation failed', errors: parsed.errors });
  const n = parsed.data;
  if (n.moduleId !== null && !(await moduleExists(n.moduleId))) {
    return res.status(400).json({ error: 'Validation failed', errors: { moduleId: 'Module not found' } });
  }
  const badAsset = await findBadAsset(n.slides, me(req).id, null);
  if (badAsset) return res.status(400).json({ error: 'Validation failed', errors: { slides: badAsset } });
  const id = await createNote(me(req).id, n);
  res.status(201).json({ note: await getVisibleNote(id, me(req).id) });
});

notesRouter.get('/:id', optionalAuth, async (req, res) => {
  const note = await getVisibleNote(Number(req.params.id), viewerId(req));
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

notesRouter.put('/:id', requireAuth, requireActive, async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), me(req).id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.role !== 'owner' && meta.role !== 'edit') return res.status(403).json({ error: 'Forbidden' });
  if (meta.status === 'hidden') return res.status(403).json({ error: 'This note was hidden by a moderator' });
  if (meta.role === 'edit' && !meta.authorActive) return res.status(403).json({ error: NOT_EDITABLE });

  const parsed = parseNoteBody(req.body);
  const base = parseBaseUpdatedAt(req.body, meta.role === 'edit');
  if (!parsed.ok || !base.ok) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { ...(parsed.ok ? {} : parsed.errors), ...(base.ok ? {} : base.errors) },
    });
  }
  const n = parsed.data;
  // Co-authors edit content only (D44): publishing, visibility and module stay with the owner. A difference means the
  // owner changed them since this editor loaded the note, so it is a 409 the editor recovers from like any other.
  if (
    meta.role === 'edit' &&
    (n.status !== meta.status || n.visibility !== meta.visibility || n.moduleId !== meta.moduleId)
  ) {
    return res
      .status(409)
      .json({ error: 'The owner changed who can see this note or its module. Reload to see the latest version' });
  }
  if (meta.status === 'published' && n.status === 'draft') {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { status: 'A published note cannot be changed back to a draft' },
    });
  }
  if (n.moduleId !== null && !(await moduleExists(n.moduleId))) {
    return res.status(400).json({ error: 'Validation failed', errors: { moduleId: 'Module not found' } });
  }
  const badAsset = await findBadAsset(n.slides, me(req).id, Number(req.params.id));
  if (badAsset) return res.status(400).json({ error: 'Validation failed', errors: { slides: badAsset } });
  const id = Number(req.params.id);
  const result = await replaceNote(id, n, me(req).id, base.data);
  if (result === 'gone') return res.status(404).json({ error: 'Note not found' });
  if (result === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
  if (result === 'locked') return res.status(423).json({ error: 'Another collaborator is editing this note' });
  if (result === 'stale')
    return res.status(409).json({ error: 'This note changed since you opened it. Reload to see the latest version' });
  await notifyVoidedVerifiers(id, me(req).id);
  res.json({ note: await getVisibleNote(id, me(req).id) });
});

/**
 * The owner publishes the last saved version of a draft (wireframe 29). Allowed while a co-author holds the edit lock,
 * because it changes no content they could be overwriting: it re-sends the stored note with the new status, and only
 * if nothing was saved since it was read (409 otherwise). Same checks as publishing through PUT.
 */
notesRouter.post('/:id/publish', requireAuth, requireActive, async (req, res) => {
  const id = Number(req.params.id);
  const meta = await getNoteMeta(id, me(req).id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.role !== 'owner') return res.status(403).json({ error: 'Only the owner can publish' });
  if (meta.status === 'hidden') return res.status(403).json({ error: 'This note was hidden by a moderator' });
  if (meta.status !== 'draft') return res.status(400).json({ error: 'This note is already published' });
  const visibility = (req.body as { visibility?: unknown } | undefined)?.visibility;
  if (visibility !== 'public' && visibility !== 'contacts') {
    return res.status(400).json({ error: 'Validation failed', errors: { visibility: 'Choose who can see this note' } });
  }
  const note = await getVisibleNote(id, me(req).id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const parsed = parseNoteBody({
    title: note.title,
    theme: note.theme,
    aspect: note.aspect,
    music: note.music && { provider: 'deezer', trackId: note.music.trackId, volume: note.music.volume },
    moduleId: note.module?.id ?? null,
    hashtags: note.hashtags,
    slides: note.slides.map(({ background, elements, notes }) => ({ background, elements, notes: notes ?? '' })),
    status: 'published',
    visibility,
  });
  if (!parsed.ok) return res.status(400).json({ error: 'Validation failed', errors: parsed.errors });
  const badAsset = await findBadAsset(parsed.data.slides, me(req).id, id);
  if (badAsset) return res.status(400).json({ error: 'Validation failed', errors: { slides: badAsset } });
  const result = await replaceNote(id, parsed.data, me(req).id, new Date(note.updatedAt), { ignoreLock: true });
  if (result === 'gone') return res.status(404).json({ error: 'Note not found' });
  if (result === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
  if (result === 'stale') {
    return res.status(409).json({ error: 'This note was saved again just now. Try publishing once more' });
  }
  res.json({ note: await getVisibleNote(id, me(req).id) });
});

notesRouter.delete('/:id', requireAuth, async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), me(req).id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  await softDeleteNote(Number(req.params.id));
  res.status(204).end();
});
