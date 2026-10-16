import type { Deck, ThemeId } from '@parp/shared';
import { api, ApiError, errorText } from '@/lib/api';
import type { Note } from '@/types';
import { BACKUP_PREFIX } from './backup';
import { type NoteMeta, useEditor } from './store';

export type SaveChoice = 'draft' | 'public' | 'contacts';
export type SaveOutcome = { ok: true; note: Note } | { ok: false; errors: Record<string, string> };

/** Drafts autosave this long after the last change (R21 spec 5)... */
export const AUTOSAVE_IDLE_MS = 2000;
/** ...but never wait longer than this while changes keep coming. */
export const AUTOSAVE_MAX_MS = 10_000;

export const noteToDeck = (note: Note): Deck => ({
  aspect: note.aspect,
  theme: note.theme as ThemeId,
  slides: note.slides.map((s) => ({ background: s.background, elements: s.elements, notes: s.notes ?? '' })),
  music: note.music && { provider: 'deezer', trackId: note.music.trackId, volume: note.music.volume },
});

export const noteToMeta = (note: Note): NoteMeta => ({
  noteId: note.id,
  title: note.title,
  moduleId: note.module ? String(note.module.id) : '',
  hashtags: note.hashtags,
  status: note.status === 'published' ? 'published' : 'draft',
  visibility: note.visibility,
  baseUpdatedAt: note.updatedAt,
});

let inFlight: Promise<SaveOutcome> | null = null;

/**
 * Creates or replaces the note from the store. Saves never overlap: a second call waits for the first, then sends the
 * newer state. A 409 (changed elsewhere, R30) puts the editor in the conflict state and stops autosave.
 */
export async function saveNote(choice: SaveChoice = 'draft'): Promise<SaveOutcome> {
  while (inFlight) await inFlight;
  inFlight = send(choice);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function send(choice: SaveChoice): Promise<SaveOutcome> {
  const store = useEditor.getState();
  const { deck, meta, rev } = store;
  const publishing = choice !== 'draft';
  store.setSaveState('saving');
  const body = {
    title: meta.title,
    theme: deck.theme,
    aspect: deck.aspect,
    music: deck.music,
    moduleId: meta.moduleId ? Number(meta.moduleId) : null,
    hashtags: meta.hashtags,
    slides: deck.slides,
    status: publishing ? 'published' : 'draft',
    visibility: publishing ? choice : null,
    baseUpdatedAt: meta.baseUpdatedAt ?? undefined,
  };
  const id = meta.noteId;
  try {
    const { note } = await api<{ note: Note }>(id ? `/notes/${id}` : '/notes', { method: id ? 'PUT' : 'POST', body });
    useEditor.getState().markSaved(rev, {
      noteId: note.id,
      baseUpdatedAt: note.updatedAt,
      status: note.status === 'published' ? 'published' : 'draft',
      visibility: note.visibility,
    });
    return { ok: true, note };
  } catch (e) {
    const conflict = e instanceof ApiError && e.status === 409;
    useEditor.getState().setSaveState(conflict ? 'conflict' : 'error');
    if (e instanceof ApiError && Object.keys(e.errors ?? {}).length) return { ok: false, errors: e.errors };
    return { ok: false, errors: { form: errorText(e) } };
  }
}

/** "Keep mine" after a 409: take the server's current version as the base and save over it. */
export async function keepMine(choice: SaveChoice): Promise<SaveOutcome> {
  const { meta, setMeta } = useEditor.getState();
  try {
    const { note } = await api<{ note: Note }>(`/notes/${meta.noteId}`);
    setMeta({ baseUpdatedAt: note.updatedAt });
  } catch (e) {
    return { ok: false, errors: { form: errorText(e) } };
  }
  return saveNote(choice);
}

// Local backup for published notes (D43, D52): their edits are only sent on an explicit Update, so a crash or a closed
// tab would lose them. Restored only when the backup was taken from the version the server still has.

export interface Backup {
  base: string;
  at: string;
  deck: Deck;
  meta: Pick<NoteMeta, 'title' | 'hashtags' | 'moduleId'>;
}

export function writeBackup(): void {
  const { deck, meta } = useEditor.getState();
  if (!meta.noteId || !meta.baseUpdatedAt) return;
  const b: Backup = {
    base: meta.baseUpdatedAt,
    at: new Date().toISOString(),
    deck,
    meta: { title: meta.title, hashtags: meta.hashtags, moduleId: meta.moduleId },
  };
  try {
    localStorage.setItem(BACKUP_PREFIX + meta.noteId, JSON.stringify(b));
  } catch {
    // Storage full or blocked: the backup is a convenience, so editing carries on without it.
  }
}

/** The backup for this note if it was taken from `updatedAt`; any other backup is stale and removed. */
export function readBackup(noteId: number, updatedAt: string): Backup | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + noteId);
    if (!raw) return null;
    const b = JSON.parse(raw) as Backup;
    if (b.base === updatedAt) return b;
    localStorage.removeItem(BACKUP_PREFIX + noteId);
  } catch {
    // Unreadable backup: treat as none.
  }
  return null;
}

export function clearBackup(noteId: number): void {
  try {
    localStorage.removeItem(BACKUP_PREFIX + noteId);
  } catch {
    // Nothing to clear.
  }
}
