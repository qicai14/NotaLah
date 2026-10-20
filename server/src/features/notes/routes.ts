import { type Response, Router } from 'express';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import { idParam } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import { createNote, getVisibleNote, listDrafts, publishNote, replaceNote, softDeleteNote } from './repository';
import { noteAccess } from './access';
import { moduleExists } from '../modules/repository';
import {
  type NoteInput,
  blankPositions,
  findBadAsset,
  parseBaseUpdatedAt,
  parseNoteBody,
  publishErrors,
} from './service';
import { lookupTrack, MusicUnavailable } from '../music/service';
import { notifyVoidedVerifiers } from '../notifications/service';

export const notesRouter = Router();

/**
 * Fills `n.musicMeta` from Jamendo when the note's track is new or still has no title (R9). An unknown track is a 400.
 * When Jamendo is down, the monthly cap is reached or the user's daily budget is spent, the save still goes through with the
 * track id and volume and no details (null clears an old track's), and the next save tries again. Returns false once it has
 * answered. A track already stored with details is not looked up again, so autosave does not spend the allowance.
 */
async function resolveMusic(
  n: NoteInput,
  userId: number,
  stored: { trackId: number | null; title: string | null } | null,
  res: Response,
): Promise<boolean> {
  if (!n.music || (n.music.trackId === stored?.trackId && stored.title !== null)) return true;
  try {
    const track = await lookupTrack(n.music.trackId, userId);
    if (!track) {
      if (n.music.trackId === stored?.trackId) return true; // saved during an outage; unrelated edits must not fail
      res.status(400).json({ error: 'Validation failed', errors: { music: 'Unknown music track' } });
      return false;
    }
    n.musicMeta = track;
  } catch (err) {
    if (!(err instanceof MusicUnavailable)) throw err;
    if (n.music.trackId !== stored?.trackId) n.musicMeta = null;
  }
  return true;
}
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
  if (!(await resolveMusic(n, me(req).id, null, res))) return;
  const id = await createNote(me(req).id, n);
  res.status(201).json({ note: await getVisibleNote(id, me(req).id) });
});

notesRouter.get('/:id', optionalAuth, async (req, res) => {
  const note = await getVisibleNote(Number(req.params.id), viewerId(req));
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json({ note });
});

notesRouter.put('/:id', requireAuth, requireActive, async (req, res) => {
  const meta = await noteAccess(req, res, ['owner', 'edit'], { editable: true });
  if (!meta) return;

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
  if (!(await resolveMusic(n, me(req).id, { trackId: meta.musicTrackId, title: meta.musicTitle }, res))) return;
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
 * because it changes no content they could be overwriting: one UPDATE of status, visibility and publish time, and only
 * if nothing was saved since it was read (409 otherwise). Same completeness rules as publishing through PUT.
 */
notesRouter.post('/:id/publish', requireAuth, requireActive, async (req, res) => {
  const id = Number(req.params.id);
  const meta = await noteAccess(req, res, ['owner'], { editable: true, forbidden: 'Only the owner can publish' });
  if (!meta) return;
  if (meta.status !== 'draft') return res.status(400).json({ error: 'This note is already published' });
  const visibility = (req.body as { visibility?: unknown } | undefined)?.visibility;
  if (visibility !== 'public' && visibility !== 'contacts') {
    return res.status(400).json({ error: 'Validation failed', errors: { visibility: 'Choose who can see this note' } });
  }
  const note = await getVisibleNote(id, me(req).id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  const errors = publishErrors(note);
  if (Object.keys(errors).length > 0) return res.status(400).json({ error: 'Validation failed', errors });
  if (!(await publishNote(id, me(req).id, visibility, new Date(note.updatedAt), blankPositions(note.slides)))) {
    return res.status(409).json({ error: 'This note was saved again just now. Try publishing once more' });
  }
  res.json({ note: await getVisibleNote(id, me(req).id) });
});

notesRouter.delete('/:id', requireAuth, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner']))) return;
  await softDeleteNote(Number(req.params.id));
  res.status(204).end();
});
