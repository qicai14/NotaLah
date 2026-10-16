import { Router } from 'express';
import { z } from 'zod';
import { parseKeyset } from '../../lib/keyset';
import { bodyOrEmpty } from '../../lib/validation';
import { me, requireAuth } from '../auth/middleware';
import { NOTIFICATIONS } from './config';
import * as repo from './repository';
import { pushUnreadCount } from './service';

/** Mounted at /api/notifications; every route needs a login (R8, D51). Restricted users may read and mark read. */
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const typesSchema = z
  .string()
  .transform((s) => s.split(','))
  .pipe(z.array(z.enum(repo.NOTIFICATION_TYPES, { error: 'Invalid type' })))
  .optional();

notificationsRouter.get('/', async (req, res) => {
  const types = typesSchema.safeParse(req.query.type);
  if (!types.success) return res.status(400).json({ error: 'Invalid type' });
  const page = parseKeyset(req, res, 2, NOTIFICATIONS.listPage);
  if (!page) return;
  const { items, nextCursor } = await repo.listNotifications(me(req).id, types.data ?? null, page);
  res.json({ notifications: items, nextCursor });
});

notificationsRouter.get('/unread-count', async (req, res) => {
  res.json({ unreadCount: await repo.unreadCount(me(req).id) });
});

const readSchema = z.object({
  ids: z
    .array(z.number({ error: 'Invalid id' }).int('Invalid id').min(1, 'Invalid id').max(2147483647, 'Invalid id'), { error: 'ids must be a list' })
    .min(1, 'ids must not be empty')
    .max(NOTIFICATIONS.markReadMax, `At most ${NOTIFICATIONS.markReadMax} ids`)
    .optional(),
});

// Without ids every notification is marked read; with ids only those (the user's own).
notificationsRouter.post('/read', async (req, res) => {
  const parsed = readSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  await repo.markRead(me(req).id, parsed.data.ids ?? null);
  res.json({ unreadCount: await pushUnreadCount(me(req).id) });
});
