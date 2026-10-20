import type { Editor as TipTapEditor } from '@tiptap/react';
import { create } from 'zustand';
import type { VideoStatus } from '@/types';
import {
  type Aspect,
  BOARD_WIDTH,
  boardHeight,
  type Deck,
  LIMITS,
  round1,
  type Slide,
  type SlideElement,
  THEMES,
} from '@notalah/shared';

/** Snapshot undo keeps at most this many steps (R21 spec 5). */
export const HISTORY_LIMIT = 100;

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'locked';

export interface EditorState {
  deck: Deck;
  /** Selected element ids on the active slide, in the order they were picked (the first drives single-element tools). */
  selection: string[];
  activeSlide: number;
  past: Deck[];
  future: Deck[];
  /** The deck differs from what the server last confirmed. */
  dirty: boolean;
  saveState: SaveState;
  /** Note details saved with the deck but kept out of undo. */
  meta: NoteMeta;
  /** Bumped by every change, so a finished save can tell whether anything moved while it was in flight. */
  rev: number;
  /** Bumped by every `load`, so a save reply for a previous note never writes into the one now open. */
  session: number;
  /** Deck before the live changes now in progress (a drag, typing, a held arrow key); one undo step once committed. */
  previewBase: Deck | null;
  /** The TipTap instance of the text box being edited, so the toolbar can format inside it. */
  textEditor: TipTapEditor | null;
  /** Upload id to file URL for the board (the note's `assets` map plus anything uploaded since); not in undo. */
  assets: Record<string, string>;
  /** Pipeline status of each video in the deck (R40); one still processing is polled until ready or failed. Not in undo. */
  videoStatus: Record<string, VideoStatus>;
  /** The text box, code block or table open for typing (at most one, and only while it is the sole selection). */
  editingId: string | null;
}

export interface NoteMeta {
  noteId: number | null;
  title: string;
  moduleId: string;
  hashtags: string[];
  status: 'draft' | 'published';
  visibility: 'public' | 'contacts' | null;
  /** The server's `updatedAt` this editor started from, for the 409 check. */
  baseUpdatedAt: string | null;
}

export const emptyMeta = (): NoteMeta => ({
  noteId: null,
  title: '',
  moduleId: '',
  hashtags: [],
  status: 'draft',
  visibility: null,
  baseUpdatedAt: null,
});

const blankSlide = (): Slide => ({ background: { kind: 'color', color: '#ffffff' }, elements: [], notes: '' });
export const emptyDeck = (): Deck => ({ aspect: '4:5', theme: 'plain', slides: [blankSlide()], music: null });

const initial = (): EditorState => ({
  deck: emptyDeck(),
  selection: [],
  activeSlide: 0,
  past: [],
  future: [],
  dirty: false,
  saveState: 'idle',
  meta: emptyMeta(),
  rev: 0,
  session: 0,
  previewBase: null,
  textEditor: null,
  assets: {},
  videoStatus: {},
  editingId: null,
});

export const newId = (): string => crypto.randomUUID();

/** A copy of an element with a new id, nudged down and right so it does not hide the original. */
export const offsetCopy = (el: SlideElement): SlideElement => ({
  ...el,
  id: newId(),
  x: round1(el.x + 24),
  y: round1(el.y + 24),
});

const withNewIds = (s: Slide): Slide => ({ ...s, elements: s.elements.map((e) => ({ ...e, id: newId() })) });

/** Array.prototype.toSpliced, which the ES2022 lib lacks. */
const spliced = <T>(a: T[], at: number, remove: number, ...add: T[]): T[] => {
  const c = [...a];
  c.splice(at, remove, ...add);
  return c;
};

const capped = (past: Deck[], deck: Deck) => [...past, deck].slice(-HISTORY_LIMIT);

export const mapSlide = (deck: Deck, index: number, fn: (s: Slide) => Slide): Deck => ({
  ...deck,
  slides: deck.slides.map((s, i) => (i === index ? fn(s) : s)),
});

/** The deck with one element on one slide patched. */
export const patchElement = (deck: Deck, slide: number, id: string, patch: Partial<SlideElement>): Deck =>
  mapSlide(deck, slide, (s) => ({
    ...s,
    elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SlideElement) : e)),
  }));

/** Keeps the active slide and selection valid after the deck changes under them (undo, delete). */
function settle(deck: Deck, activeSlide: number, selection: string[]) {
  const active = Math.min(activeSlide, deck.slides.length - 1);
  const ids = new Set(deck.slides[active].elements.map((e) => e.id));
  const keep = selection.filter((id) => ids.has(id));
  return { activeSlide: active, selection: keep.length === selection.length ? selection : keep };
}

/** The deck with every listed element on one slide replaced by `fn(element)`. */
export const mapElements = (
  deck: Deck,
  slide: number,
  ids: readonly string[],
  fn: (e: SlideElement) => SlideElement,
): Deck => {
  const set = new Set(ids);
  return mapSlide(deck, slide, (s) => ({ ...s, elements: s.elements.map((e) => (set.has(e.id) ? fn(e) : e)) }));
};

/** Scales an element's geometry and its board-unit sizes by `s`, then shifts it by (dx, dy). */
/** Largest font any text, code or table may have (the schema's limit). */
const MAX_FONT = 400;
/** Largest width or height the schema allows. */
const MAX_SIZE = 4000;

/** The range a group may be scaled by so no member drops below the minimum box or passes the schema's size limits. */
export function groupScaleRange(els: SlideElement[], minBox: number): { min: number; max: number } {
  let min = 0;
  let max = Infinity;
  for (const e of els) {
    min = Math.max(min, minBox / Math.min(e.w, e.h));
    max = Math.min(max, MAX_SIZE / Math.max(e.w, e.h));
    if (e.type === 'text' || e.type === 'code' || e.type === 'table') max = Math.min(max, MAX_FONT / e.size);
  }
  return { min, max: Math.max(min, max) };
}

export function scaleElement(e: SlideElement, s: number, dx: number, dy: number): SlideElement {
  const g = { x: round1(e.x * s + dx), y: round1(e.y * s + dy), w: round1(e.w * s), h: round1(e.h * s) };
  const font = (n: number) => Math.max(8, round1(n * s));
  switch (e.type) {
    case 'text':
      return { ...e, ...g, size: font(e.size), padding: round1(e.padding * s) };
    case 'code':
    case 'table':
      return { ...e, ...g, size: font(e.size) };
    case 'shape':
      return { ...e, ...g, strokeWidth: round1(e.strokeWidth * s), radius: round1(e.radius * s) };
    case 'line':
      return { ...e, ...g, strokeWidth: round1(e.strokeWidth * s) };
    case 'image':
      return { ...e, ...g, radius: round1(e.radius * s) };
    case 'video':
      return { ...e, ...g };
  }
}

/**
 * Changing the aspect scales every slide uniformly by min(1, newH / oldH) and centres it (R21 spec 1.1), so content
 * never leaves a shorter board and is not stretched on a taller one.
 */
export function reaspect(deck: Deck, aspect: Aspect): Deck {
  const oldH = boardHeight(deck.aspect);
  const newH = boardHeight(aspect);
  const s = Math.min(1, newH / oldH);
  const dx = (BOARD_WIDTH - BOARD_WIDTH * s) / 2;
  const dy = (newH - oldH * s) / 2;
  return {
    ...deck,
    aspect,
    slides: deck.slides.map((sl) => ({ ...sl, elements: sl.elements.map((e) => scaleElement(e, s, dx, dy)) })),
  };
}

interface Actions {
  /** Replaces everything with a loaded (or new) deck; history is cleared. */
  load: (
    deck: Deck,
    meta?: NoteMeta,
    assets?: Record<string, string>,
    videoStatus?: Record<string, VideoStatus>,
  ) => void;
  /** Opens an element for typing, or closes the open one (null). */
  setEditing: (id: string | null) => void;
  /** Makes an upload drawable on the board. */
  addAsset: (id: number, url: string) => void;
  setVideoStatus: (id: number, status: VideoStatus) => void;
  /** Detail edits (title, module, hashtags) mark the note dirty without an undo step. */
  setMeta: (patch: Partial<NoteMeta>) => void;
  /** One undoable change. */
  apply: (recipe: (deck: Deck) => Deck) => void;
  /** Live update during a drag, typing or a held key; not recorded until `commit`. */
  preview: (recipe: (deck: Deck) => Deck) => void;
  /** Ends the live changes: everything since the first `preview` becomes one undo step. */
  commit: () => void;
  /** Drops the live changes in progress, back to the deck before the first `preview`. */
  cancelPreview: () => void;
  undo: () => void;
  redo: () => void;
  /** Selects exactly these elements (none for null). */
  select: (id: string | string[] | null) => void;
  /** Shift or Ctrl click: adds the element to the selection, or takes it out. */
  toggleSelect: (id: string) => void;
  setActiveSlide: (index: number) => void;
  addSlide: () => void;
  /** Puts a ready-made slide (a layout) on the active slide when that is empty, otherwise after it; selects nothing. */
  insertSlide: (slide: Slide) => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  moveSlide: (from: number, to: number) => void;
  setAspect: (aspect: Aspect) => void;
  addElement: (el: SlideElement) => void;
  /** Adds several elements as one step (paste, duplicate of a selection) and selects them; stops at the slide limit. */
  addElements: (els: SlideElement[]) => void;
  updateElement: (id: string, patch: Partial<SlideElement>) => void;
  deleteElement: (id: string) => void;
  /** Deletes every unlocked element in the selection as one step. */
  deleteSelected: () => void;
  setSaveState: (s: SaveState) => void;
  /**
   * The server confirmed the state at `sentRev` of `session`; the note stays dirty if it changed while the save was in
   * flight, and nothing happens if another note has been loaded since.
   */
  markSaved: (session: number, sentRev: number, meta: Partial<NoteMeta>) => void;
}

type EditorStore = EditorState & Actions;

export const useEditor = create<EditorStore>()((set, get) => {
  const apply = (recipe: (deck: Deck) => Deck, extra: Partial<EditorState> = {}) => {
    const { deck, past, activeSlide, selection, previewBase } = get();
    const next = recipe(deck);
    if (next === deck) return;
    // Live changes still in progress become their own step first, so this change undoes on its own.
    const settled = previewBase && previewBase !== deck ? capped(past, previewBase) : past;
    const pos = settle(next, extra.activeSlide ?? activeSlide, extra.selection ?? selection);
    set({
      ...extra,
      ...pos,
      deck: next,
      past: capped(settled, deck),
      future: [],
      previewBase: null,
      dirty: true,
      rev: get().rev + 1,
    });
  };
  const active = () => get().activeSlide;
  const slideCount = () => get().deck.slides.length;

  return {
    ...initial(),
    load: (deck, meta = emptyMeta(), assets = {}, videoStatus = {}) =>
      set({ ...initial(), deck, meta, assets, videoStatus, session: get().session + 1 }),
    setEditing: (editingId) => set({ editingId }),
    addAsset: (id, url) => set({ assets: { ...get().assets, [String(id)]: url } }),
    setVideoStatus: (id, status) => set({ videoStatus: { ...get().videoStatus, [String(id)]: status } }),
    setMeta: (patch) => set({ meta: { ...get().meta, ...patch }, dirty: true, rev: get().rev + 1 }),
    apply: (recipe) => apply(recipe),
    preview: (recipe) => {
      const { deck, previewBase } = get();
      const next = recipe(deck);
      if (next !== deck) set({ deck: next, previewBase: previewBase ?? deck, dirty: true, rev: get().rev + 1 });
    },
    commit: () => {
      const { deck, past, previewBase } = get();
      if (!previewBase) return;
      set(
        previewBase === deck
          ? { previewBase: null }
          : { past: capped(past, previewBase), future: [], previewBase: null },
      );
    },
    cancelPreview: () => {
      const { previewBase } = get();
      if (previewBase) set({ deck: previewBase, previewBase: null, rev: get().rev + 1 });
    },
    undo: () => {
      get().commit(); // live changes in progress are the step that undo takes back
      const { past, future, deck, activeSlide, selection } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({
        deck: prev,
        past: past.slice(0, -1),
        future: [deck, ...future].slice(0, HISTORY_LIMIT),
        dirty: true,
        rev: get().rev + 1,
        ...settle(prev, activeSlide, selection),
      });
    },
    redo: () => {
      get().commit();
      const { past, future, deck, activeSlide, selection } = get();
      if (!future.length) return;
      const next = future[0];
      set({
        deck: next,
        past: capped(past, deck),
        future: future.slice(1),
        dirty: true,
        rev: get().rev + 1,
        ...settle(next, activeSlide, selection),
      });
    },
    select: (id) => set({ selection: id === null ? [] : Array.isArray(id) ? id : [id] }),
    toggleSelect: (id) => {
      const sel = get().selection;
      set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
    },
    setActiveSlide: (index) => set({ activeSlide: Math.max(0, Math.min(index, slideCount() - 1)), selection: [] }),
    addSlide: () => {
      if (slideCount() >= LIMITS.slides) return;
      const at = active() + 1;
      apply(
        (d) => ({
          ...d,
          slides: spliced(d.slides, at, 0, { ...blankSlide(), background: THEMES[d.theme].background }),
        }),
        { activeSlide: at, selection: [] },
      );
    },
    insertSlide: (slide) => {
      const here = active();
      const empty = !get().deck.slides[here].elements.length;
      if (!empty && slideCount() >= LIMITS.slides) return;
      const at = empty ? here : here + 1;
      // An empty slide is replaced but keeps its page notes.
      const placed = empty ? { ...slide, notes: get().deck.slides[here].notes } : slide;
      apply((d) => ({ ...d, slides: spliced(d.slides, at, empty ? 1 : 0, placed) }), {
        activeSlide: at,
        selection: [],
      });
    },
    duplicateSlide: (index) => {
      if (slideCount() >= LIMITS.slides) return;
      apply((d) => ({ ...d, slides: spliced(d.slides, index + 1, 0, withNewIds(d.slides[index])) }), {
        activeSlide: index + 1,
        selection: [],
      });
    },
    deleteSlide: (index) => {
      apply((d) => ({ ...d, slides: d.slides.length === 1 ? [blankSlide()] : spliced(d.slides, index, 1) }), {
        activeSlide: Math.max(0, index - (index >= slideCount() - 1 ? 1 : 0)),
        selection: [],
      });
    },
    moveSlide: (from, to) => {
      if (from === to || to < 0 || to >= slideCount()) return;
      apply(
        (d) => {
          const slides = spliced(d.slides, from, 1);
          return { ...d, slides: spliced(slides, to, 0, d.slides[from]) };
        },
        { activeSlide: to },
      );
    },
    setAspect: (aspect) => {
      if (aspect !== get().deck.aspect) apply((d) => reaspect(d, aspect));
    },
    addElement: (el) => get().addElements([el]),
    addElements: (els) => {
      const current = get().deck.slides[active()].elements;
      const room = LIMITS.elementsPerSlide - current.length;
      // Images and videos have their own per-slide caps (D32); extra ones in a paste are left out, not saved and refused.
      let images = current.filter((e) => e.type === 'image').length;
      let videos = current.filter((e) => e.type === 'video').length;
      const fits = els.filter((e) => {
        if (e.type === 'image') return ++images <= LIMITS.imagesPerSlide;
        if (e.type === 'video') return ++videos <= LIMITS.videosPerSlide;
        return true;
      });
      const add = fits.slice(0, Math.max(0, room));
      if (!add.length) return;
      apply((d) => mapSlide(d, active(), (s) => ({ ...s, elements: [...s.elements, ...add] })), {
        selection: add.map((e) => e.id),
      });
    },
    updateElement: (id, patch) => apply((d) => patchElement(d, active(), id, patch)),
    deleteElement: (id) =>
      apply((d) => mapSlide(d, active(), (s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) })), {
        selection: get().selection.filter((x) => x !== id),
      }),
    deleteSelected: () => {
      const gone = new Set(
        get()
          .deck.slides[active()].elements.filter((e) => get().selection.includes(e.id) && !e.locked)
          .map((e) => e.id),
      );
      if (!gone.size) return;
      apply((d) => mapSlide(d, active(), (s) => ({ ...s, elements: s.elements.filter((e) => !gone.has(e.id)) })), {
        selection: get().selection.filter((x) => !gone.has(x)),
      });
    },
    setSaveState: (saveState) => set({ saveState }),
    markSaved: (session, sentRev, meta) => {
      if (session !== get().session) return;
      set({ saveState: 'saved', dirty: get().rev !== sentRev, meta: { ...get().meta, ...meta } });
    },
  };
});
