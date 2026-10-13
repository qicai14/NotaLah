import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';
import { countDrafts, listNotesByAuthor } from '../notes/repository';
import { invalidId, issueMap } from '../../lib/validation';
import { findProfile, updateProfile } from './repository';

export const usersRouter = Router();
usersRouter.use(requireAuth);

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
  const user = await updateProfile(req.user!.id, { displayName, programme: programme || null, bio: bio || null });
  res.json({ user });
});

usersRouter.get('/:id', async (req, res) => {
  const profile = invalidId(req.params.id) ? undefined : await findProfile(Number(req.params.id));
  if (!profile) return res.status(404).json({ error: 'User not found' });
  const notes = await listNotesByAuthor(profile.id, req.user!.id);
  const own = profile.id === req.user!.id;
  res.json({ user: { ...profile, notes, ...(own ? { draftCount: await countDrafts(profile.id) } : {}) } });
});
