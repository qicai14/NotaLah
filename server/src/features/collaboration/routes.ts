import { createHash, randomBytes } from 'node:crypto';
import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import { env } from '../../lib/env';
import { parseKeyset } from '../../lib/keyset';
import { isUniqueViolation, pool } from '../../lib/pool';
import { bodyOrEmpty, idParam, invalidId } from '../../lib/validation';
import { shareAssetUrl } from '../assets/config';
import { getLinkedAsset } from '../assets/repository';
import { sendAsset } from '../assets/service';
import { me, optionalAuth, optionalAuthForFiles, requireActive, requireAuth, viewerId } from '../auth/middleware';
import { fileLimiter } from '../assets/rateLimit';
import { guestReadLimiter } from '../auth/rateLimit';
import { noteAccess } from '../notes/access';
import { getNoteMeta, getVisibleNote, NOT_EDITABLE } from '../notes/repository';
import { isBlocked } from '../users/repository';
import { notify } from '../notifications/service';
import { COLLABORATION } from './config';
import * as repo from './repository';

/** Mounted at /api before the engagement and notes routers (R30, D46). Every route but GET /share/:token needs a login. */
export const collaborationRouter = Router();

collaborationRouter.param('id', idParam('Note not found'));
collaborationRouter.param('userId', idParam('User not found'));
collaborationRouter.param('requestId', idParam('Request not found'));

const roleSchema = z.enum(['view', 'edit'], { error: 'Role must be view or edit' });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/; // base64url of tokenBytes (32) random bytes

collaborationRouter.get('/notes/shared', requireAuth, async (req, res) => {
  const page = parseKeyset(req, res, 2);
  if (!page) return;
  const { items, nextCursor } = await repo.listShared(me(req).id, page);
  res.json({ notes: items, nextCursor });
});

collaborationRouter.get('/notes/:id/access', requireAuth, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner']))) return;
  res.json(await repo.getAccess(Number(req.params.id)));
});

collaborationRouter.put('/notes/:id/collaborators/:userId', requireAuth, requireActive, async (req, res) => {
  const meta = await noteAccess(req, res, ['owner']);
  if (!meta) return;
  const role = roleSchema.safeParse(bodyOrEmpty(req).role);
  if (!role.success)
    return res.status(400).json({ error: 'Validation failed', errors: { role: role.error.issues[0].message } });
  const userId = Number(req.params.userId);
  if (userId === meta.authorId) return res.status(400).json({ error: 'You already own this note' });
  if (!(await repo.setCollaborator(Number(req.params.id), userId, role.data, meta.authorId))) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ userId, role: role.data });
});

// Owner removes anyone; a collaborator may remove only themself (leave). Leaving needs no active account and no access,
// so a collaborator in a block with the owner can still leave (D49).
collaborationRouter.delete('/notes/:id/collaborators/:userId', requireAuth, async (req, res) => {
  if (Number(req.params.userId) !== me(req).id && !(await noteAccess(req, res, ['owner']))) return;
  await repo.removeCollaborator(Number(req.params.id), Number(req.params.userId));
  res.status(204).end();
});

collaborationRouter.post('/notes/:id/links', requireAuth, requireActive, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner']))) return;
  const role = roleSchema.safeParse(bodyOrEmpty(req).role);
  if (!role.success)
    return res.status(400).json({ error: 'Validation failed', errors: { role: role.error.issues[0].message } });
  const token = randomBytes(COLLABORATION.tokenBytes).toString('base64url');
  await repo.replaceLink(Number(req.params.id), role.data, hashToken(token));
  res.status(201).json({ role: role.data, token, url: `${env.CLIENT_ORIGIN}/share/${token}` });
});

collaborationRouter.delete('/notes/:id/links/:role', requireAuth, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner']))) return;
  const role = roleSchema.safeParse(req.params.role);
  if (!role.success) return res.status(400).json({ error: 'Role must be view or edit' });
  await repo.revokeLink(Number(req.params.id), role.data);
  res.status(204).end();
});

/** The active link for `:token`, after answering 404 for a malformed, unknown, revoked or unreachable one, or one whose owner is in a block with the user (D49). */
async function link(req: Request, res: Response) {
  const token = String(req.params.token);
  const found = TOKEN_FORMAT.test(token) ? await repo.findLink(hashToken(token)) : undefined;
  if (!found || (req.user && (await isBlocked(req.user.id, found.ownerId)))) {
    return void res.status(404).json({ error: 'This link is invalid or was revoked' });
  }
  return found;
}

// Token lookups are limited per IP for everyone, not only guests (optionalAuth limits only guests).
collaborationRouter.get(
  '/share/:token',
  optionalAuth,
  (req, res, next) => (req.user ? guestReadLimiter(req, res, next) : next()),
  async (req, res) => {
    const found = await link(req, res);
    if (!found) return;
    if (found.role === 'edit' && !req.user) return res.status(401).json({ error: 'Log in to edit this note' });
    const note = await getVisibleNote(found.noteId, viewerId(req), true);
    // The link's holder may not pass the asset route's note checks, so images come through this link too.
    if (note) for (const id of Object.keys(note.assets)) note.assets[id] = shareAssetUrl(String(req.params.token), id);
    res.json({ role: found.role, note });
  },
);

collaborationRouter.get(
  '/share/:token/assets/:assetId',
  optionalAuthForFiles,
  fileLimiter, // the only limit here, so an image is not counted twice (R37)
  async (req, res) => {
    const found = await link(req, res);
    if (!found) return;
    if (found.role === 'edit' && !req.user) return res.status(401).json({ error: 'Log in to edit this note' });
    const assetId = String(req.params.assetId);
    const asset = invalidId(assetId) ? undefined : await getLinkedAsset(found.noteId, Number(assetId));
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    await sendAsset(req, res, asset);
  },
);

// Joining through an edit link is a write, so it is a POST behind CSRF and the write limiter, not a side effect of the GET (D46).
collaborationRouter.post('/share/:token', requireAuth, requireActive, async (req, res) => {
  const found = await link(req, res);
  if (!found) return;
  if (found.role !== 'edit') return res.status(400).json({ error: 'A view link cannot be joined' });
  if (!found.ownerActive) return res.status(403).json({ error: NOT_EDITABLE });
  if (found.ownerId !== me(req).id) await repo.joinAsEditor(found.noteId, me(req).id, found.ownerId);
  res.json({ noteId: found.noteId, role: found.ownerId === me(req).id ? 'owner' : 'edit' });
});

const requestSchema = z
  .string({ error: 'Invalid message' })
  .trim()
  .max(COLLABORATION.requestMessageMax, `Message must be at most ${COLLABORATION.requestMessageMax} characters`)
  .nullish();

// Anyone who can read the note and is not already its owner or an editor; a view collaborator may ask to edit (D46).
collaborationRouter.post('/notes/:id/requests', requireAuth, requireActive, async (req, res) => {
  const meta = await getNoteMeta(Number(req.params.id), me(req).id);
  if (!meta || !meta.visible || meta.status === 'hidden') return res.status(404).json({ error: 'Note not found' });
  if (meta.role === 'owner') return res.status(400).json({ error: 'You own this note' });
  if (meta.role === 'edit') return res.status(409).json({ error: 'You can already edit this note' });
  const message = requestSchema.safeParse(bodyOrEmpty(req).message);
  if (!message.success)
    return res.status(400).json({ error: 'Validation failed', errors: { message: message.error.issues[0].message } });
  try {
    const id = await repo.createRequest(Number(req.params.id), me(req).id, message.data || null);
    await notify({ type: 'collab_request', actorId: me(req).id, noteId: Number(req.params.id), collabRequestId: id }, [
      meta.authorId,
    ]);
    res.status(201).json({ id, status: 'pending' });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: 'You already asked to collaborate on this note' });
    throw err;
  }
});

const decisionSchema = z.object({
  decision: z.enum(['approve', 'decline'], { error: 'Decision must be approve or decline' }),
  role: roleSchema.default('edit'),
});

collaborationRouter.post('/notes/:id/requests/:requestId', requireAuth, requireActive, async (req, res) => {
  const meta = await noteAccess(req, res, ['owner']);
  if (!meta) return;
  const parsed = decisionSchema.safeParse(bodyOrEmpty(req));
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      errors: { [String(parsed.error.issues[0].path[0])]: parsed.error.issues[0].message },
    });
  }
  const { decision, role } = parsed.data;
  const [noteId, requestId] = [Number(req.params.id), Number(req.params.requestId)];
  const out = await repo.decideRequest(noteId, requestId, decision === 'approve', role, meta.authorId);
  if (out === 'not_found') return res.status(404).json({ error: 'Request not found' });
  if (out === 'decided') return res.status(409).json({ error: 'This request was already decided' });
  const type = decision === 'approve' ? 'collab_approved' : 'collab_declined';
  await notify({ type, actorId: me(req).id, noteId, collabRequestId: requestId }, [out.requesterId]);
  res.json({ status: decision === 'approve' ? 'approved' : 'declined', ...(decision === 'approve' ? { role } : {}) });
});

collaborationRouter.post('/notes/:id/lock', requireAuth, requireActive, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner', 'edit'], { editable: true }))) return;
  const lock = await repo.takeLock(Number(req.params.id), me(req).id);
  if (!lock.ok)
    return res.status(423).json({ error: 'Another collaborator is editing this note', lockedBy: lock.holder });
  res.json({ expiresAt: lock.expiresAt });
});

collaborationRouter.delete('/notes/:id/lock', requireAuth, async (req, res) => {
  if (!(await noteAccess(req, res, ['owner', 'edit']))) return;
  await repo.releaseLock(pool, Number(req.params.id), me(req).id);
  res.status(204).end();
});
