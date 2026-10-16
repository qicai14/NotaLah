import { create } from 'zustand';
import {
  type Aspect,
  BOARD_WIDTH,
  boardHeight,
  type Deck,
  LIMITS,
  round1,
  type Slide,
  type SlideElement,
} from '@parp/shared';

/** Snapshot undo keeps at most this many steps (R21 spec 5). */
export const HISTORY_LIMIT = 100;

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'conflict';

export interface EditorState {
  deck: Deck;
  /** Selected element id on the active slide. */
  selection: string | null;
  activeSlide: number;
  past: Deck[];
  future: Deck[];
  /** The deck differs from what the server last confirmed. */
  dirty: boolean;
  saveState: SaveState;
  /** Deck as it was when the current drag began; the drag becomes one undo step on release. */
  gestureBase: Deck | null;
}

export const blankSlide = (): Slide => ({ background: { kind: 'color', color: '#ffffff' }, elements: [], notes: '' });
export const emptyDeck = (): Deck => ({ aspect: '4:5', theme: 'plain', slides: [blankSlide()], music: null });

const initial = (): EditorState => ({
  deck: emptyDeck(),
  selection: null,
  activeSlide: 0,
  past: [],
  future: [],
  dirty: false,
  saveState: 'idle',
  gestureBase: null,
});

export const newId = (): string => crypto.randomUUID();

const withNewIds = (s: Slide): Slide => ({ ...s, elements: s.elements.map((e) => ({ ...e, id: newId() })) });

/** Array.prototype.toSpliced, which the ES2022 lib lacks. */
const spliced = <T,>(a: T[], at: number, remove: number, ...add: T[]): T[] => {
  const c = [...a];
  c.splice(at, remove, ...add);
  return c;
};

const capped = (past: Deck[], deck: Deck) => [...past, deck].slice(-HISTORY_LIMIT);

const mapSlide = (deck: Deck, index: number, fn: (s: Slide) => Slide): Deck => ({
  ...deck,
  slides: deck.slides.map((s, i) => (i === index ? fn(s) : s)),
});

/** Keeps the active slide and selection valid after the deck changes under them (undo, delete). */
function settle(deck: Deck, activeSlide: number, selection: string | null) {
  const active = Math.min(activeSlide, deck.slides.length - 1);
  const keep = selection && deck.slides[active].elements.some((e) => e.id === selection) ? selection : null;
  return { activeSlide: active, selection: keep };
}

/** Scales an element's geometry and its board-unit sizes by `s`, then shifts it by (dx, dy). */
function scaleElement(e: SlideElement, s: number, dx: number, dy: number): SlideElement {
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
  load: (deck: Deck) => void;
  /** One undoable change. */
  apply: (recipe: (deck: Deck) => Deck) => void;
  beginGesture: () => void;
  /** Live update during a drag; not recorded until `endGesture`. */
  preview: (recipe: (deck: Deck) => Deck) => void;
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  setActiveSlide: (index: number) => void;
  addSlide: () => void;
  duplicateSlide: (index: number) => void;
  deleteSlide: (index: number) => void;
  moveSlide: (from: number, to: number) => void;
  setAspect: (aspect: Aspect) => void;
  addElement: (el: SlideElement) => void;
  updateElement: (id: string, patch: Partial<SlideElement>) => void;
  deleteElement: (id: string) => void;
  setSaveState: (s: SaveState) => void;
  /** The server confirmed `sent`; the deck stays dirty if it changed while the save was in flight. */
  markSaved: (sent: Deck) => void;
}

export type EditorStore = EditorState & Actions;

export const useEditor = create<EditorStore>()((set, get) => {
  const apply = (recipe: (deck: Deck) => Deck, extra: Partial<EditorState> = {}) => {
    const { deck, past, activeSlide, selection } = get();
    const next = recipe(deck);
    if (next === deck) return;
    const pos = settle(next, extra.activeSlide ?? activeSlide, 'selection' in extra ? (extra.selection ?? null) : selection);
    set({ ...extra, ...pos, deck: next, past: capped(past, deck), future: [], dirty: true });
  };
  const active = () => get().activeSlide;
  const slideCount = () => get().deck.slides.length;

  return {
    ...initial(),
    load: (deck) => set({ ...initial(), deck }),
    apply: (recipe) => apply(recipe),
    beginGesture: () => set({ gestureBase: get().deck }),
    preview: (recipe) => set({ deck: recipe(get().deck), dirty: true }),
    endGesture: () => {
      const { gestureBase, deck, past } = get();
      if (gestureBase && gestureBase !== deck) set({ past: capped(past, gestureBase), future: [] });
      set({ gestureBase: null });
    },
    undo: () => {
      const { past, future, deck, activeSlide, selection } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({
        deck: prev,
        past: past.slice(0, -1),
        future: [deck, ...future].slice(0, HISTORY_LIMIT),
        dirty: true,
        ...settle(prev, activeSlide, selection),
      });
    },
    redo: () => {
      const { past, future, deck, activeSlide, selection } = get();
      if (!future.length) return;
      const next = future[0];
      set({ deck: next, past: capped(past, deck), future: future.slice(1), dirty: true, ...settle(next, activeSlide, selection) });
    },
    select: (id) => set({ selection: id }),
    setActiveSlide: (index) => set({ activeSlide: Math.max(0, Math.min(index, slideCount() - 1)), selection: null }),
    addSlide: () => {
      if (slideCount() >= LIMITS.slides) return;
      const at = active() + 1;
      apply((d) => ({ ...d, slides: spliced(d.slides, at, 0, blankSlide()) }), { activeSlide: at, selection: null });
    },
    duplicateSlide: (index) => {
      if (slideCount() >= LIMITS.slides) return;
      apply((d) => ({ ...d, slides: spliced(d.slides, index + 1, 0, withNewIds(d.slides[index])) }), {
        activeSlide: index + 1,
        selection: null,
      });
    },
    deleteSlide: (index) => {
      apply(
        (d) => ({ ...d, slides: d.slides.length === 1 ? [blankSlide()] : spliced(d.slides, index, 1) }),
        { activeSlide: Math.max(0, index - (index >= slideCount() - 1 ? 1 : 0)), selection: null },
      );
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
    addElement: (el) => {
      if (get().deck.slides[active()].elements.length >= LIMITS.elementsPerSlide) return;
      apply((d) => mapSlide(d, active(), (s) => ({ ...s, elements: [...s.elements, el] })), { selection: el.id });
    },
    updateElement: (id, patch) =>
      apply((d) =>
        mapSlide(d, active(), (s) => ({
          ...s,
          elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as SlideElement) : e)),
        })),
      ),
    deleteElement: (id) =>
      apply((d) => mapSlide(d, active(), (s) => ({ ...s, elements: s.elements.filter((e) => e.id !== id) })), {
        selection: null,
      }),
    setSaveState: (saveState) => set({ saveState }),
    markSaved: (sent) => set({ saveState: 'saved', dirty: get().deck !== sent }),
  };
});
