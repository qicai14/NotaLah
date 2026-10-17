import {
  angleAbout,
  type Box,
  boardHeight,
  BOARD_WIDTH,
  boxesTouching,
  groupBounds,
  groupScale,
  type Guides,
  type Handle,
  HANDLES,
  moveBox,
  normaliseAngle,
  type Point,
  type Rect,
  resizeBox,
  ROTATE_STEP,
  rotateAbout,
  rotationFromPointer,
  round1,
  type SlideElement,
  snapMove,
} from '@parp/shared';
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';
import { SlideBoard } from '@/components/board/SlideBoard';
import { cn } from '@/lib/utils';
import { boxOf } from './arrange';
import { elementLabel } from './elements';
import { mapElements, patchElement, scaleElement, useEditor } from './store';
import { TextEditing } from './TextEditing';

type Gesture =
  | {
      kind: 'move';
      starts: SlideElement[];
      frame: Rect;
      from: Point;
      moved: boolean;
      /** The pressed element, and whether the press alone (no drag) should narrow the selection to it or open it. */
      hit: { id: string; wasSelected: boolean; isText: boolean; narrow: boolean };
    }
  | { kind: 'resize'; id: string; start: Box; handle: Handle; keepRatio: boolean }
  | { kind: 'rotate'; id: string; start: Box }
  | { kind: 'group-resize'; starts: SlideElement[]; frame: Rect; handle: Handle }
  | { kind: 'group-rotate'; starts: SlideElement[]; pivot: Point; from: number }
  | { kind: 'marquee'; from: Point; base: string[] };

/** Screen pixels a press may travel before it counts as a drag. */
const DRAG_SLOP = 4;
const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};
const HANDLE_POS: Record<Handle, [number, number]> = {
  nw: [0, 0],
  n: [50, 0],
  ne: [100, 0],
  e: [100, 50],
  se: [100, 100],
  s: [50, 100],
  sw: [0, 100],
  w: [0, 50],
};
const CORNERS = HANDLES.filter((h) => h.length === 2);
const additive = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => e.shiftKey || e.ctrlKey || e.metaKey;

/**
 * The editable board: select (Shift or Ctrl click and marquee drag for several), drag, 8-handle resize (Shift keeps
 * the ratio), rotate with 15° snap (Alt for free), group move, scale and rotate, and snapping guides, all with
 * Pointer Events. Phones get corner handles only, 44 px targets and centre-only snap.
 */
export function Canvas({ compact }: { compact: boolean }) {
  const deck = useEditor((s) => s.deck);
  const active = useEditor((s) => s.activeSlide);
  const selection = useEditor((s) => s.selection);
  const slide = deck.slides[active];
  const boardH = boardHeight(deck.aspect);
  const picked = slide.elements.filter((e) => selection.includes(e.id));
  const selected = picked.length === 1 ? picked[0] : null;
  const multi = picked.length > 1;

  const [scale, setScale] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  /** The pointer driving the current gesture; a second finger or pen is ignored until it ends. */
  const activePointer = useRef<number | null>(null);
  /** Focus moved by a press, which has already set the selection itself. */
  const pressing = useRef(false);
  const editing = editingId && selected?.id === editingId && selected.type === 'text' ? selected : null;

  const toBoard = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const r = board.current!.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    },
    [scale],
  );

  /** Tracks one gesture on window, so it keeps going when the pointer leaves the board. */
  function track(g: Gesture, down: ReactPointerEvent) {
    activePointer.current = down.pointerId;
    const moving = g.kind === 'move' ? new Set(g.starts.map((e) => e.id)) : null;
    const others = slide.elements.filter((e) => !moving?.has(e.id)).map(boxOf);
    const downAt = { x: down.clientX, y: down.clientY };
    const { preview } = useEditor.getState();
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== down.pointerId) return;
      const pt = toBoard(ev);
      switch (g.kind) {
        case 'move': {
          if (!g.moved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < DRAG_SLOP) return;
          g.moved = true;
          const start = { ...g.frame, rotation: 0 };
          const one = g.starts.length === 1 ? boxOf(g.starts[0]) : start;
          const moved = moveBox(one, pt.x - g.from.x, pt.y - g.from.y);
          const snapped = ev.altKey
            ? { box: moved, guides: { x: [], y: [] } }
            : snapMove(moved, others, { w: BOARD_WIDTH, h: boardH }, 6 / scale, compact);
          setGuides(snapped.guides);
          const dx = snapped.box.x - one.x;
          const dy = snapped.box.y - one.y;
          const byId = new Map(g.starts.map((e) => [e.id, e]));
          preview((d) =>
            mapElements(d, active, [...byId.keys()], (e) => {
              const s = byId.get(e.id)!;
              return { ...e, x: round1(s.x + dx), y: round1(s.y + dy) };
            }),
          );
          return;
        }
        case 'resize': {
          const b = resizeBox(g.start, g.handle, pt, g.keepRatio || ev.shiftKey);
          preview((d) => patchElement(d, active, g.id, { x: b.x, y: b.y, w: b.w, h: b.h }));
          return;
        }
        case 'rotate':
          preview((d) => patchElement(d, active, g.id, { rotation: rotationFromPointer(g.start, pt, !ev.altKey) }));
          return;
        case 'group-resize': {
          const { k, anchor } = groupScale(g.frame, g.handle, pt);
          const byId = new Map(g.starts.map((e) => [e.id, e]));
          preview((d) =>
            mapElements(d, active, [...byId.keys()], (e) =>
              scaleElement(byId.get(e.id)!, k, anchor.x * (1 - k), anchor.y * (1 - k)),
            ),
          );
          return;
        }
        case 'group-rotate': {
          const raw = angleAbout(g.pivot, pt) - g.from;
          const deg = ev.altKey ? round1(raw) : Math.round(raw / ROTATE_STEP) * ROTATE_STEP;
          const byId = new Map(g.starts.map((e) => [e.id, e]));
          preview((d) =>
            mapElements(d, active, [...byId.keys()], (e) => {
              const s = byId.get(e.id)!;
              return { ...s, ...rotateAbout(boxOf(s), g.pivot, normaliseAngle(deg)) };
            }),
          );
          return;
        }
        case 'marquee': {
          if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < DRAG_SLOP) return;
          const r = {
            x: Math.min(g.from.x, pt.x),
            y: Math.min(g.from.y, pt.y),
            w: Math.abs(pt.x - g.from.x),
            h: Math.abs(pt.y - g.from.y),
          };
          setMarquee(r);
          const hit = boxesTouching(
            r,
            slide.elements.map((e) => ({ id: e.id, box: boxOf(e) })),
          );
          useEditor.getState().select([...new Set([...g.base, ...hit])]);
        }
      }
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== down.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      activePointer.current = null;
      setGuides({ x: [], y: [] });
      setMarquee(null);
      useEditor.getState().commit();
      if (g.kind === 'move' && !g.moved && g.hit.narrow) {
        // A press without a drag on one of several selected elements picks just that one; a second tap on a text
        // box that was already the only selection opens it for typing.
        if (g.hit.wasSelected && g.starts.length === 1 && g.hit.isText) setEditingId(g.hit.id);
        else useEditor.getState().select(g.hit.id);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function focusWithoutSelecting(el: HTMLElement) {
    pressing.current = true;
    el.focus({ preventScroll: true });
    pressing.current = false;
  }

  function onElementDown(e: ReactPointerEvent<HTMLDivElement>, el: SlideElement) {
    if (e.button !== 0 || el.id === editing?.id || activePointer.current !== null) return;
    e.preventDefault();
    setEditingId(null);
    const st = useEditor.getState();
    const wasSelected = st.selection.includes(el.id);
    if (additive(e)) {
      // Shift or Ctrl click adds or removes one element, and never starts a drag.
      st.toggleSelect(el.id);
      focusWithoutSelecting(wasSelected ? frame.current! : e.currentTarget);
      return;
    }
    if (!wasSelected) st.select(el.id);
    focusWithoutSelecting(e.currentTarget);
    const ids = wasSelected ? st.selection : [el.id];
    const starts = slide.elements.filter((x) => ids.includes(x.id) && !x.locked);
    const hit = { id: el.id, wasSelected, isText: el.type === 'text', narrow: wasSelected };
    if (!starts.length) return;
    track({ kind: 'move', starts, frame: groupBounds(starts.map(boxOf)), from: toBoard(e), moved: false, hit }, e);
  }

  function onBackgroundDown(e: ReactPointerEvent) {
    if (e.button !== 0 || activePointer.current !== null) return;
    setEditingId(null);
    const base = additive(e) ? useEditor.getState().selection : [];
    useEditor.getState().select(base);
    track({ kind: 'marquee', from: toBoard(e), base }, e);
  }

  function onHandleDown(e: ReactPointerEvent, handle: Handle | 'rotate') {
    if (e.button !== 0 || activePointer.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    if (selected) {
      const start = boxOf(selected);
      if (handle === 'rotate') track({ kind: 'rotate', id: selected.id, start }, e);
      else track({ kind: 'resize', id: selected.id, start, handle, keepRatio: selected.type === 'image' }, e);
      return;
    }
    const frameBox = groupBounds(picked.map(boxOf));
    if (handle === 'rotate') {
      const pivot = { x: frameBox.x + frameBox.w / 2, y: frameBox.y + frameBox.h / 2 };
      track({ kind: 'group-rotate', starts: picked, pivot, from: angleAbout(pivot, toBoard(e)) }, e);
    } else track({ kind: 'group-resize', starts: picked, frame: frameBox, handle }, e);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const { select, deleteSelected, preview } = useEditor.getState();
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingId(null);
        (board.current?.querySelector(`[data-id="${editing.id}"]`) as HTMLElement | null)?.focus();
      }
      return;
    }
    const target = (e.target as HTMLElement).dataset.id;
    const onSelection = target ? selection.includes(target) : e.target === frame.current && picked.length > 0;
    if (!onSelection) return;
    const free = picked.filter((p) => !p.locked);
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (nudge[e.key] && free.length) {
      e.preventDefault();
      const [dx, dy] = nudge[e.key];
      // Held or repeated arrows are one undo step, committed on key up or blur.
      preview((d) =>
        mapElements(
          d,
          active,
          free.map((p) => p.id),
          (x) => ({ ...x, x: round1(x.x + dx), y: round1(x.y + dy) }),
        ),
      );
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && free.length) {
      e.preventDefault();
      deleteSelected();
      frame.current?.focus(); // the deleted element had focus; keep it inside the canvas
    } else if (e.key === 'Enter' && selected?.type === 'text' && !selected.locked) {
      e.preventDefault();
      setEditingId(selected.id);
    } else if (e.key === 'Escape') {
      select(null);
    }
  }

  const px = (n: number) => n / (scale || 1);
  const knob = compact ? 14 : 10;
  const hit = compact ? 44 : 22;

  const handleSet = (handles: readonly Handle[]) => (
    <>
      {handles.map((h) => (
        <span
          key={h}
          data-handle={h}
          onPointerDown={(e) => onHandleDown(e, h)}
          className="pointer-events-auto absolute flex touch-none items-center justify-center"
          style={{
            left: `${HANDLE_POS[h][0]}%`,
            top: `${HANDLE_POS[h][1]}%`,
            width: px(hit),
            height: px(hit),
            transform: 'translate(-50%, -50%)',
            cursor: CURSORS[h],
          }}
        >
          <span
            className="block rounded-full bg-background shadow-(--shadow-card)"
            style={{
              width: h.length === 2 ? px(knob) : px(h === 'n' || h === 's' ? knob * 2 : knob * 0.7),
              height: h.length === 2 ? px(knob) : px(h === 'e' || h === 'w' ? knob * 2 : knob * 0.7),
              border: `${px(1.5)}px solid var(--primary)`,
            }}
          />
        </span>
      ))}
      <span
        data-handle="rotate"
        onPointerDown={(e) => onHandleDown(e, 'rotate')}
        className="pointer-events-auto absolute flex cursor-grab touch-none items-center justify-center"
        style={{
          left: '50%',
          top: -px(compact ? 40 : 32),
          width: px(hit),
          height: px(hit),
          transform: 'translate(-50%, -50%)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          className="rounded-full bg-background text-primary shadow-(--shadow-card)"
          style={{ width: px(knob * 2), height: px(knob * 2), padding: px(3) }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
        >
          <path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5" />
        </svg>
      </span>
    </>
  );

  const outline = (b: Box, width: number, dashed = false) => ({
    left: b.x,
    top: b.y,
    width: b.w,
    height: b.h,
    transform: b.rotation ? `rotate(${b.rotation}deg)` : undefined,
    zIndex: 10_000,
    outline: `${px(width)}px ${dashed ? 'dashed' : 'solid'} var(--primary)`,
    outlineOffset: px(1),
  });

  const group = multi ? groupBounds(picked.map(boxOf)) : null;
  const overlay = (
    <>
      {selected && (
        <div aria-hidden="true" className="pointer-events-none absolute" style={outline(boxOf(selected), 2)}>
          {!selected.locked && !editing && handleSet(compact ? CORNERS : HANDLES)}
        </div>
      )}
      {multi &&
        picked.map((p) => (
          <div key={p.id} aria-hidden="true" className="pointer-events-none absolute" style={outline(boxOf(p), 1.5)} />
        ))}
      {group && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={outline({ ...group, rotation: 0 }, 1, true)}
        >
          {!picked.some((p) => p.locked) && handleSet(CORNERS)}
        </div>
      )}
      {marquee && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bg-primary/10"
          style={{ ...outline({ ...marquee, rotation: 0 }, 1), zIndex: 10_002 }}
        />
      )}
      {guides.x.map((x) => (
        <div
          key={`gx${x}`}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bg-editor-guide"
          style={{ left: x - px(0.5), width: px(1), height: boardH, zIndex: 10_001 }}
        />
      ))}
      {guides.y.map((y) => (
        <div
          key={`gy${y}`}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 bg-editor-guide"
          style={{ top: y - px(0.5), height: px(1), width: BOARD_WIDTH, zIndex: 10_001 }}
        />
      ))}
    </>
  );

  return (
    <div
      className={cn('relative size-full', compact ? 'px-6 py-12' : 'p-12')}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key.startsWith('Arrow') && useEditor.getState().commit()}
      onBlur={() => useEditor.getState().commit()}
      // A press on the slide background or the grey canvas around it starts a marquee selection.
      onPointerDown={(e) => !(e.target as Element).closest('[data-id], [data-handle]') && onBackgroundDown(e)}
    >
      <div
        ref={frame}
        aria-label={multi ? `${picked.length} elements selected` : undefined}
        className="size-full outline-none [&_[aria-roledescription=slide]]:shadow-(--shadow-card)"
        tabIndex={-1}
      >
        <SlideBoard
          slide={slide}
          aspect={deck.aspect}
          mode="edit"
          label={`Slide ${active + 1} of ${deck.slides.length}`}
          editing={{
            boardRef: board,
            onScale: setScale,
            overlay,
            elementLabel: (el) =>
              `${elementLabel(el)}${el.locked ? ', locked' : ''}${multi && selection.includes(el.id) ? ', selected' : ''}`,
            onElementFocus: (el) =>
              !pressing.current && !selection.includes(el.id) && useEditor.getState().select(el.id),
            onElementPointerDown: onElementDown,
            renderBody: (el) => (el.id === editing?.id ? <TextEditing el={editing} slide={active} /> : undefined),
          }}
        />
      </div>
    </div>
  );
}
