import { Router } from 'express';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import { idParam } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import {
  createNote, getNoteMeta, getVisibleNote, listDrafts, NOT_EDITABLE, replaceNote, softDeleteNote,
} from './repository';
import { moduleExists } from '../modules/repository';
import { parseBaseUpdatedAt, parseNoteBody } from './service';

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
    return res.status(400).json({ error: 'Validation failed', errors: { ...(parsed.ok ? {} : parsed.errors), ...(base.ok ? {} : base.errors) } });
  }
  const n = parsed.data;
  // Co-authors edit content only (D44): publishing, visibility and module stay with the owner.
  if (meta.role === 'edit' && (n.status !== meta.status || n.visibility !== meta.visibility || n.moduleId !== meta.moduleId)) {
    return res.status(403).json({ error: 'Only the owner can change status, visibility or module' });
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
  const id = Number(req.params.id);
  const result = await replaceNote(id, n, me(req).id, base.data);
  if (result === 'gone') return res.status(404).json({ error: 'Note not found' });
  if (result === 'forbidden') return res.status(403).json({ error: 'Forbidden' });
  if (result === 'locked') return res.status(423).json({ error: 'Another collaborator is editing this note' });
  if (result === 'stale') return res.status(409).json({ error: 'This note changed since you opened it. Reload to see the latest version' });
  res.json({ note: await getVisibleNote(id, me(req).id) });
});

notesRouter.delete('/:id', requireAuth, async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), me(req).id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.role !== 'owner') return res.status(403).json({ error: 'Forbidden' });
  await softDeleteNote(Number(req.params.id));
  res.status(204).end();
});
