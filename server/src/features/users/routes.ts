import { Router } from 'express';
import { z } from 'zod';
import { requireActive, requireAuth, me } from '../auth/middleware';
import { countDrafts, listNotesByAuthor } from '../notes/repository';
import { idParam, issueMap } from '../../lib/validation';
import { findProfile, follow, getFollowState, listFollows, unfollow, updateProfile } from './repository';

export const usersRouter = Router();
usersRouter.use(requireAuth);
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

usersRouter.put('/me', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body && typeof req.body === 'object' ? req.body : {});
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', errors: issueMap(parsed.error.issues) });
  const { displayName, programme, bio } = parsed.data;
  // omitted fields keep their value; an empty string clears to NULL (D22)
  const user = await updateProfile(me(req).id, {
    displayName,
    ...(programme !== undefined && { programme: programme || null }),
    ...(bio !== undefined && { bio: bio || null }),
  });
  res.json({ user });
});

usersRouter.post('/:id/follow', requireActive, async (req, res) => {
  const target = Number(req.params.id);
  if (target === me(req).id) return res.status(400).json({ error: 'You cannot follow yourself' });
  const out = await follow(me(req).id, target);
  if (out === 'not_found') return res.status(404).json({ error: 'User not found' });
  res.status(out === 'created' ? 201 : 200).json(await getFollowState(me(req).id, target));
});

// no requireActive: a restricted user can still undo (D22 removal rule)
usersRouter.delete('/:id/follow', async (req, res) => {
  const target = Number(req.params.id);
  await unfollow(me(req).id, target);
  const state = await getFollowState(me(req).id, target);
  if (!state) return res.status(404).json({ error: 'User not found' });
  res.json(state);
});

for (const side of ['followers', 'following'] as const) {
  usersRouter.get(`/:id/${side}`, async (req, res) => {
    const raw = req.query.cursor;
    const m = raw === undefined ? null : /^(\d{1,17})_(\d{1,10})$/.exec(String(raw));
    if (raw !== undefined && (typeof raw !== 'string' || !m || Number(m[2]) > 2147483647)) {
      return res.status(400).json({ error: 'Invalid cursor' });
    }
    const user = Number(req.params.id);
    if (!(await findProfile(user, me(req).id))) return res.status(404).json({ error: 'User not found' });
    res.json(await listFollows(user, me(req).id, side, m ? { micros: m[1], userId: Number(m[2]) } : null));
  });
}

usersRouter.get('/:id', async (req, res) => {
  const profile = await findProfile(Number(req.params.id), me(req).id);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  const own = profile.id === me(req).id;
  const [notes, draftCount] = await Promise.all([listNotesByAuthor(profile.id, me(req).id), own ? countDrafts(profile.id) : undefined]);
  res.json({ user: { ...profile, notes, ...(own ? { draftCount } : {}) } });
});
