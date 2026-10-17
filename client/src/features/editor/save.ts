import { type Deck, deckSchema, type ThemeId } from '@parp/shared';
import { api, ApiError, errorText } from '@/lib/api';
import type { Note } from '@/types';
import { BACKUP_PREFIX } from './backup';
import { type EditorState, type NoteMeta, useEditor } from './store';

export type SaveChoice = 'draft' | 'public' | 'contacts';

/** A draft with no title is saved under this one (D56); the author can rename it at any time. */
export const UNTITLED = 'Untitled note';
export type SaveOutcome = { ok: true; note: Note } | { ok: false; errors: Record<string, string> };

/** Drafts autosave this long after the last change (R21 spec 5)... */
export const AUTOSAVE_IDLE_MS = 2000;
/** ...but never wait longer than this while changes keep coming. */
export const AUTOSAVE_MAX_MS = 10_000;

/** Wait before the next autosave: the idle delay, cut short so no change waits more than the maximum. */
export const autosaveDelay = (firstChangeAt: number, now: number): number =>
  Math.max(0, Math.min(AUTOSAVE_IDLE_MS, firstChangeAt + AUTOSAVE_MAX_MS - now));

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

/** What one save sends: taken when the save is asked for, so it never picks up a later note's state. */
export type Snapshot = Pick<EditorState, 'deck' | 'meta' | 'rev' | 'session'>;

export const snapshot = (): Snapshot => {
  const { deck, meta, rev, session } = useEditor.getState();
  return { deck, meta, rev, session };
};

let inFlight: Promise<SaveOutcome> | null = null;

/**
 * Creates or replaces the note. Saves never overlap: a second call waits for the first, then sends its own snapshot
 * with the id and `updatedAt` the first one received. A 409 (changed elsewhere, R30) or 423 (a collaborator holds the
 * lock) puts the editor in the conflict or locked state, which stops autosave. Replies for a note that is no longer
 * open (the session changed) never touch the store.
 */
export async function saveNote(choice: SaveChoice = 'draft', snap: Snapshot = snapshot()): Promise<SaveOutcome> {
  while (inFlight) await inFlight;
  const live = useEditor.getState();
  const s =
    live.session === snap.session
      ? { ...snap, meta: { ...snap.meta, noteId: live.meta.noteId, baseUpdatedAt: live.meta.baseUpdatedAt } }
      : snap;
  inFlight = send(choice, s);
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function send(choice: SaveChoice, { deck, meta, rev, session }: Snapshot): Promise<SaveOutcome> {
  const current = () => useEditor.getState().session === session;
  const publishing = choice !== 'draft';
  if (current()) useEditor.getState().setSaveState('saving');
  const body = {
    title: publishing ? meta.title : meta.title.trim() || UNTITLED,
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
    useEditor.getState().markSaved(session, rev, {
      noteId: note.id,
      baseUpdatedAt: note.updatedAt,
      status: note.status === 'published' ? 'published' : 'draft',
      visibility: note.visibility,
    });
    return { ok: true, note };
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 0;
    const state = status === 409 ? 'conflict' : status === 423 ? 'locked' : 'error';
    if (current()) useEditor.getState().setSaveState(state);
    if (state !== 'error') return { ok: false, errors: {} }; // the banner says it, with its own actions
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

// Local backup (D43, D52): published notes only change on an explicit Update, and a locked draft cannot be saved, so a
// crash or a closed tab would lose those edits. A backup is restored only for the same user, when it was taken from
// the version the server still has, and after it passes the deck schema and the text allow-list.

export interface Backup {
  owner: number;
  base: string;
  at: string;
  deck: Deck;
  meta: Pick<NoteMeta, 'title' | 'hashtags' | 'moduleId'>;
}

/** Writes the backup now; false when there is nothing to back up to or storage refused it. */
export function writeBackup(owner: number | undefined): boolean {
  const { deck, meta } = useEditor.getState();
  if (!owner || !meta.noteId || !meta.baseUpdatedAt) return false;
  const b: Backup = {
    owner,
    base: meta.baseUpdatedAt,
    at: new Date().toISOString(),
    deck,
    meta: { title: meta.title, hashtags: meta.hashtags, moduleId: meta.moduleId },
  };
  try {
    localStorage.setItem(BACKUP_PREFIX + meta.noteId, JSON.stringify(b));
    return true;
  } catch {
    return false; // storage full or blocked: editing carries on without a backup
  }
}

const TEXT_TAGS = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'STRONG',
  'EM',
  'S',
  'U',
  'SPAN',
  'CODE',
  'PRE',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'BR',
  'HR',
]);
const DROPPED = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT']);
const SAFE_COLOUR = /^\s*color:\s*#(?:[0-9a-f]{6}|[0-9a-f]{8})\s*;?\s*$/i;

/**
 * The server's text allow-list (D20, D53) applied to HTML read back from local storage, which anything with access to
 * the browser could have edited: unknown tags are unwrapped (script, style and similar are dropped with their
 * content), and the only attributes kept are `start` on lists and a hex `color` style on spans.
 */
export function cleanHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walk = (node: Element) => {
    // Array.from copies the live collection, because the loop removes and unwraps children.
    for (const child of Array.from(node.children)) {
      if (DROPPED.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      for (const attr of Array.from(child.attributes)) {
        const keep =
          (attr.name === 'start' && child.tagName === 'OL') ||
          (attr.name === 'style' && child.tagName === 'SPAN' && SAFE_COLOUR.test(attr.value));
        if (!keep) child.removeAttribute(attr.name);
      }
      if (!TEXT_TAGS.has(child.tagName)) child.replaceWith(...child.childNodes);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML;
}

/** The backup for this note if it is this user's, taken from `updatedAt`, and valid; any other backup is removed. */
export function readBackup(noteId: number, updatedAt: string, owner: number | undefined): Backup | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + noteId);
    if (!raw) return null;
    const b = JSON.parse(raw) as Partial<Backup> | null;
    const deck = deckSchema.safeParse(b?.deck);
    if (b && owner && b.owner === owner && b.base === updatedAt && deck.success) {
      const slides = deck.data.slides.map((sl) => ({
        ...sl,
        elements: sl.elements.map((e) => (e.type === 'text' ? { ...e, html: cleanHtml(e.html) } : e)),
      }));
      const m: Partial<Backup['meta']> = b.meta ?? {};
      return {
        owner,
        base: updatedAt,
        at: typeof b.at === 'string' ? b.at : new Date().toISOString(),
        deck: { ...deck.data, slides },
        meta: {
          title: typeof m.title === 'string' ? m.title.slice(0, 150) : '',
          hashtags: Array.isArray(m.hashtags) ? m.hashtags.filter((t) => typeof t === 'string').slice(0, 5) : [],
          moduleId: typeof m.moduleId === 'string' && /^\d*$/.test(m.moduleId) ? m.moduleId : '',
        },
      };
    }
  } catch {
    // Unreadable backup: removed below.
  }
  clearBackup(noteId);
  return null;
}

export function clearBackup(noteId: number): void {
  try {
    localStorage.removeItem(BACKUP_PREFIX + noteId);
  } catch {
    // Nothing to clear.
  }
}
