import type { Request, Response } from 'express';
import { me } from '../auth/middleware';
import { getNoteMeta, NOT_EDITABLE, type NoteMeta, type NoteRole } from './repository';

interface AccessOptions {
  /** Also refuse a note a moderator hid, and a co-author's edit while the author's account is restricted. */
  editable?: boolean;
  /** The 403 message for a viewer whose role is not in `roles`. */
  forbidden?: string;
}

/**
 * The note `:id` for the signed-in user, after answering 404 (cannot read it) or 403 (role not in `roles`, or, with
 * `editable`, hidden by a moderator or its author restricted). Returns undefined once it has answered.
 */
export async function noteAccess(
  req: Request,
  res: Response,
  roles: NoteRole[],
  { editable = false, forbidden = 'Forbidden' }: AccessOptions = {},
): Promise<NoteMeta | undefined> {
  const meta = await getNoteMeta(Number(req.params.id), me(req).id);
  if (!meta || !meta.visible) return void res.status(404).json({ error: 'Note not found' });
  if (!meta.role || !roles.includes(meta.role)) return void res.status(403).json({ error: forbidden });
  if (editable && meta.status === 'hidden') {
    return void res.status(403).json({ error: 'This note was hidden by a moderator' });
  }
  if (editable && meta.role === 'edit' && !meta.authorActive) {
    return void res.status(403).json({ error: NOT_EDITABLE });
  }
  return meta;
}
