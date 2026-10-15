import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireActive, requireAuth, me, viewerId } from '../auth/middleware';
import { countDrafts, listNotesByAuthor } from '../notes/repository';
import { bodyOrEmpty, idParam, issueMap } from '../../lib/validation';
import { parseKeyset } from '../../lib/keyset';
import { programmeExists } from '../modules/repository';
import { findProfile, follow, getFollowState, listFollows, unfollow, updateProfile } from './repository';

export const usersRouter = Router();
const PROFILE_NOTES = 50;
usersRouter.param('id', idParam('User not found'));

const profileSchema = z.object({
  displayName: z
    .string({ error: 'Display name is required' })
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name must be at most 50 characters'),
  programme: z.string({ error: 'Invalid programme' }).trim().max(100, 'Programme must be at most 100 characters').optional(),
  bio: z.string({ error: 'Invalid bio' }).trim().max(300, 'Bio must be at most 300 characters').optional(),
});

usersRouter.put('/me', requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { displayName, programme, bio } = parsed.data;
  if (programme && !(await programmeExists(programme, me(req).id))) {
    return res.status(400).json({ error: 'Validation failed', errors: { programme: 'Choose a programme from the list' } });
  }
  // omitted fields keep their value; an empty string clears to NULL (D22)
  const user = await updateProfile(me(req).id, {
    displayName,
    ...(programme !== undefined && { programme: programme || null }),
    ...(bio !== undefined && { bio: bio || null }),
  });
  res.json({ user });
});

usersRouter.post('/:id/follow', requireAuth, requireActive, async (req, res) => {
  const target = Number(req.params.id);
  if (target === me(req).id) return res.status(400).json({ error: 'You cannot follow yourself' });
  const out = await follow(me(req).id, target);
  if (out === 'not_found') return res.status(404).json({ error: 'User not found' });
  res.status(out === 'created' ? 201 : 200).json(await getFollowState(me(req).id, target));
});

// no requireActive: a restricted user can still undo (D22 removal rule)
usersRouter.delete('/:id/follow', requireAuth, async (req, res) => {
  const target = Number(req.params.id);
  const removed = await unfollow(me(req).id, target);
  const state = await getFollowState(me(req).id, target);
  if (!state) return removed ? res.status(204).end() : res.status(404).json({ error: 'User not found' }); // a hidden target still lets the follower leave
  res.json(state);
});

for (const side of ['followers', 'following'] as const) {
  usersRouter.get(`/:id/${side}`, requireAuth, async (req, res) => {
    const page = parseKeyset(req, res, 2, 20);
    if (!page) return;
    const user = Number(req.params.id);
    if (!(await findProfile(user, me(req).id))) return res.status(404).json({ error: 'User not found' });
    res.json(await listFollows(user, me(req).id, side, page));
  });
}

usersRouter.get('/:id/notes', optionalAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2);
  if (!page) return;
  const user = Number(req.params.id);
  if (!(await findProfile(user, viewerId(req)))) return res.status(404).json({ error: 'User not found' });
  const { items, nextCursor } = await listNotesByAuthor(user, viewerId(req), page);
  res.json({ notes: items, nextCursor });
});

usersRouter.get('/:id', optionalAuth, async (req, res) => {
  const profile = await findProfile(Number(req.params.id), viewerId(req));
  if (!profile) return res.status(404).json({ error: 'User not found' });
  const own = profile.id === viewerId(req);
  const [notes, draftCount] = await Promise.all([
    listNotesByAuthor(profile.id, viewerId(req), { cursor: null, limit: PROFILE_NOTES }),
    own ? countDrafts(profile.id) : undefined,
  ]);
  // the first page is embedded; GET /:id/notes?cursor=<notesNextCursor> continues it (D40)
  res.json({ user: { ...profile, notes: notes.items, notesNextCursor: notes.nextCursor, ...(own ? { draftCount } : {}) } });
});
