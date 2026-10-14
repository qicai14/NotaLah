import { Router } from 'express';
import { requireActive, requireAuth } from '../auth/middleware';
import { idParam } from '../../lib/validation';
import {
  createNote, getNoteMeta, getVisibleNote, listDrafts, listModules, moduleExists, replaceNote, softDeleteNote,
} from './repository';
import { parseNoteBody } from './service';

export const notesRouter = Router();
export const modulesRouter = Router();
notesRouter.use(requireAuth);
notesRouter.param('id', idParam('Note not found'));
modulesRouter.use(requireAuth);

modulesRouter.get('/', async (_req, res) => {
  res.json({ modules: await listModules() });
});

notesRouter.get('/drafts', async (req, res) => {
  res.json({ notes: await listDrafts(req.user!.id) });
});

notesRouter.post('/', requireActive, async (req, res) => {
  const parsed = parseNoteBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'Validation failed', errors: parsed.errors });
  const n = parsed.data;
  if (n.moduleId !== null && !(await moduleExists(n.moduleId))) {
    return res.status(400).json({ error: 'Validation failed', errors: { moduleId: 'Module not found' } });
  }
  const id = await createNote(req.user!.id, n);
  res.status(201).json({ note: await getVisibleNote(id, req.user!.id) });
});

notesRouter.get('/:id', async (req, res) => {
  const note = await getVisibleNote(Number(req.params.id), req.user!.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

notesRouter.put('/:id', requireActive, async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), req.user!.id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.authorId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
  if (meta.status === 'hidden') return res.status(403).json({ error: 'This note was hidden by a moderator' });

  const parsed = parseNoteBody(req.body);
  if (!parsed.ok) return res.status(400).json({ error: 'Validation failed', errors: parsed.errors });
  const n = parsed.data;
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
  if (!(await replaceNote(id, n))) return res.status(404).json({ error: 'Note not found' });
  res.json({ note: await getVisibleNote(id, req.user!.id) });
});

notesRouter.delete('/:id', async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), req.user!.id);
  if (!meta || !meta.visible) return res.status(404).json({ error: 'Note not found' });
  if (meta.authorId !== req.user!.id) return res.status(403).json({ error: 'Forbidden' });
  await softDeleteNote(Number(req.params.id));
  res.status(204).end();
});
