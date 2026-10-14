import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, me } from '../auth/middleware';
import { countDrafts, listNotesByAuthor } from '../notes/repository';
import { idParam, issueMap } from '../../lib/validation';
import { programmeExists } from '../modules/repository';
import { findProfile, updateProfile } from './repository';

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
  if (programme && !(await programmeExists(programme))) {
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

usersRouter.get('/:id', async (req, res) => {
  const profile = await findProfile(Number(req.params.id));
  if (!profile) return res.status(404).json({ error: 'User not found' });
  const own = profile.id === me(req).id;
  const [notes, draftCount] = await Promise.all([listNotesByAuthor(profile.id, me(req).id), own ? countDrafts(profile.id) : undefined]);
  res.json({ user: { ...profile, notes, ...(own ? { draftCount } : {}) } });
});
