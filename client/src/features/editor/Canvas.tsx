import {
  type Box,
  boardHeight,
  BOARD_WIDTH,
  type Guides,
  type Handle,
  HANDLES,
  moveBox,
  type Point,
  resizeBox,
  rotationFromPointer,
  type SlideElement,
  snapMove,
} from '@parp/shared';
import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useRef, useState } from 'react';
import { SlideBoard } from '@/components/board/SlideBoard';
import { cn } from '@/lib/utils';
import { elementLabel } from './elements';
import { patchElement, useEditor } from './store';
import { TextEditing } from './TextEditing';

type Gesture =
  | { kind: 'move'; id: string; start: Box; from: Point; moved: boolean; reselect: boolean; isText: boolean }
  | { kind: 'resize'; id: string; start: Box; handle: Handle; keepRatio: boolean }
  | { kind: 'rotate'; id: string; start: Box };

const boxOf = (e: SlideElement): Box => ({ x: e.x, y: e.y, w: e.w, h: e.h, rotation: e.rotation });
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

/**
 * The editable board: select, drag, 8-handle resize (Shift keeps the ratio), rotate with 15° snap (Alt for free),
 * and snapping guides, all with Pointer Events. Phones get corner handles only, 44 px targets and centre-only snap.
 */
export function Canvas({ compact }: { compact: boolean }) {
  const deck = useEditor((s) => s.deck);
  const active = useEditor((s) => s.activeSlide);
  const selection = useEditor((s) => s.selection);
  const slide = deck.slides[active];
  const boardH = boardHeight(deck.aspect);
  const selected = slide.elements.find((e) => e.id === selection) ?? null;

  const [scale, setScale] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] });
  const board = useRef<HTMLDivElement>(null);
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
    const store = useEditor.getState();
    const base = store.deck;
    const others = slide.elements.filter((e) => e.id !== g.id).map(boxOf);
    const downAt = { x: down.clientX, y: down.clientY };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== down.pointerId) return;
      const pt = toBoard(ev);
      let patch: Partial<Box>;
      if (g.kind === 'move') {
        if (!g.moved && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < DRAG_SLOP) return;
        g.moved = true;
        const moved = moveBox(g.start, pt.x - g.from.x, pt.y - g.from.y);
        const snapped = ev.altKey
          ? { box: moved, guides: { x: [], y: [] } }
          : snapMove(moved, others, { w: BOARD_WIDTH, h: boardH }, 6 / scale, compact);
        setGuides(snapped.guides);
        patch = { x: snapped.box.x, y: snapped.box.y };
      } else if (g.kind === 'resize') {
        const b = resizeBox(g.start, g.handle, pt, g.keepRatio || ev.shiftKey);
        patch = { x: b.x, y: b.y, w: b.w, h: b.h };
      } else {
        patch = { rotation: rotationFromPointer(g.start, pt, !ev.altKey) };
      }
      useEditor.getState().preview((d) => patchElement(d, active, g.id, patch));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== down.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setGuides({ x: [], y: [] });
      useEditor.getState().commitFrom(base);
      // A tap on a text box that was already selected opens it for typing.
      if (g.kind === 'move' && !g.moved && g.reselect && g.isText) setEditingId(g.id);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function onElementDown(e: ReactPointerEvent<HTMLDivElement>, el: SlideElement) {
    if (e.button !== 0 || el.id === editing?.id) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    const reselect = selection === el.id;
    setEditingId(null);
    useEditor.getState().select(el.id);
    if (el.locked) return;
    track(
      { kind: 'move', id: el.id, start: boxOf(el), from: toBoard(e), moved: false, reselect, isText: el.type === 'text' },
      e,
    );
  }

  function onHandleDown(e: ReactPointerEvent, handle: Handle | 'rotate') {
    if (!selected || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = boxOf(selected);
    if (handle === 'rotate') track({ kind: 'rotate', id: selected.id, start }, e);
    else track({ kind: 'resize', id: selected.id, start, handle, keepRatio: selected.type === 'image' }, e);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const { select, deleteElement, updateElement } = useEditor.getState();
    if (editing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingId(null);
        (board.current?.querySelector(`[data-id="${editing.id}"]`) as HTMLElement | null)?.focus();
      }
      return;
    }
    if (!selected || (e.target as HTMLElement).dataset.id !== selected.id) return;
    const step = e.shiftKey ? 10 : 1;
    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (nudge[e.key] && !selected.locked) {
      e.preventDefault();
      const b = moveBox(boxOf(selected), ...nudge[e.key]);
      updateElement(selected.id, { x: b.x, y: b.y });
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !selected.locked) {
      e.preventDefault();
      deleteElement(selected.id);
      board.current?.focus();
    } else if (e.key === 'Enter' && selected.type === 'text' && !selected.locked) {
      e.preventDefault();
      setEditingId(selected.id);
    } else if (e.key === 'Escape') {
      select(null);
    }
  }

  const px = (n: number) => n / (scale || 1);
  const knob = compact ? 14 : 10;
  const hit = compact ? 44 : 22;
  const handles = compact ? HANDLES.filter((h) => h.length === 2) : HANDLES;

  const overlay = (
    <>
      {selected && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            left: selected.x,
            top: selected.y,
            width: selected.w,
            height: selected.h,
            transform: selected.rotation ? `rotate(${selected.rotation}deg)` : undefined,
            zIndex: 10_000,
            outline: `${px(2)}px solid var(--primary)`,
            outlineOffset: px(1),
          }}
        >
          {!selected.locked && !editing && (
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
          )}
        </div>
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
      className={cn('relative size-full', compact ? 'p-4' : 'p-10')}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          setEditingId(null);
          useEditor.getState().select(null);
        }
      }}
    >
      <div className="size-full [&_[aria-roledescription=slide]]:shadow-(--shadow-card)" tabIndex={-1}>
        <SlideBoard
          slide={slide}
          aspect={deck.aspect}
          mode="edit"
          label={`Slide ${active + 1} of ${deck.slides.length}`}
          editing={{
            boardRef: board,
            onScale: setScale,
            overlay,
            elementLabel: (el) => `${elementLabel(el)}${el.locked ? ', locked' : ''}`,
            onElementFocus: (el) => selection !== el.id && useEditor.getState().select(el.id),
            onElementPointerDown: onElementDown,
            onBackgroundPointerDown: () => {
              setEditingId(null);
              useEditor.getState().select(null);
            },
            renderBody: (el) => (el.id === editing?.id ? <TextEditing el={editing} slide={active} /> : undefined),
          }}
        />
      </div>
    </div>
  );
}
