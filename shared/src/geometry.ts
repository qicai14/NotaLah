/**
 * Pure transform maths for the slide editor (R21 spec 5). Everything is in board units: x/y/w/h is the unrotated box
 * from the board's top-left and `rotation` (degrees, clockwise, [0, 360)) turns it about its centre.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Resize handles: the four corners and the four edge midpoints. */
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Smallest box the editor lets a resize produce (the schema allows 1). */
export const MIN_BOX = 8;
/** Rotation snaps to these steps unless the user turns snapping off. */
export const ROTATE_STEP = 15;

/** Coordinates are stored rounded to 0.1 (R21 spec 1.1). */
export const round1 = (n: number): number => Math.round(n * 10) / 10;

const rad = (deg: number) => (deg * Math.PI) / 180;
const rotate = (p: Point, deg: number): Point => {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

/** Angle in [0, 360). */
export const normaliseAngle = (deg: number): number => {
  const a = deg % 360;
  const n = a < 0 ? a + 360 : a;
  return n >= 359.95 ? 0 : n;
};

export const centreOf = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** Direction of a handle from the box centre in the box's own frame: -1, 0 or 1 on each axis. */
const handleSign = (h: Handle): Point => ({
  x: h.includes('e') ? 1 : h.includes('w') ? -1 : 0,
  y: h.includes('s') ? 1 : h.includes('n') ? -1 : 0,
});

/** Where a handle sits on the board, rotation included. */
export function handlePoint(b: Box, h: Handle): Point {
  const s = handleSign(h);
  const c = centreOf(b);
  const off = rotate({ x: (s.x * b.w) / 2, y: (s.y * b.h) / 2 }, b.rotation);
  return { x: c.x + off.x, y: c.y + off.y };
}

export const moveBox = (b: Box, dx: number, dy: number): Box => ({ ...b, x: round1(b.x + dx), y: round1(b.y + dy) });

/**
 * Drags `handle` to `pointer` (board units) and returns the new box. The opposite corner (or edge midpoint) stays
 * where it is on the board, whatever the rotation; `keepRatio` (Shift) keeps the starting width/height ratio.
 */
export function resizeBox(start: Box, handle: Handle, pointer: Point, keepRatio = false, min = MIN_BOX): Box {
  const s = handleSign(handle);
  const anchor = handlePoint(start, opposite(handle));
  const local = rotate({ x: pointer.x - anchor.x, y: pointer.y - anchor.y }, -start.rotation);
  let w = s.x ? Math.max(min, s.x * local.x) : start.w;
  let h = s.y ? Math.max(min, s.y * local.y) : start.h;
  if (keepRatio) {
    const ratio = start.w / start.h;
    if (s.x && s.y) {
      const k = Math.max(w / start.w, h / start.h);
      w = start.w * k;
      h = start.h * k;
    } else if (s.x) h = w / ratio;
    else w = h * ratio;
    if (w < min || h < min) {
      const k = Math.max(min / w, min / h);
      w *= k;
      h *= k;
    }
  }
  // The new centre lies half the new size away from the anchor, along the handle's direction in the box's frame.
  const off = rotate({ x: (s.x * w) / 2, y: (s.y * h) / 2 }, start.rotation);
  const cx = anchor.x + off.x;
  const cy = anchor.y + off.y;
  return { ...start, x: round1(cx - w / 2), y: round1(cy - h / 2), w: round1(w), h: round1(h) };
}

export function opposite(h: Handle): Handle {
  const map: Record<Handle, Handle> = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };
  return map[h];
}

/**
 * Rotation for a pointer dragged around the box centre, with the rotate handle drawn above the top edge (so a pointer
 * straight above the centre is 0°). `snap` rounds to 15° steps.
 */
export function rotationFromPointer(b: Box, pointer: Point, snap = true, step = ROTATE_STEP): number {
  const c = centreOf(b);
  const deg = (Math.atan2(pointer.y - c.y, pointer.x - c.x) * 180) / Math.PI + 90;
  return normaliseAngle(snap ? Math.round(deg / step) * step : round1(deg));
}

/** Axis-aligned bounds of a rotated box, used for guides. */
export function bounds(b: Box): { left: number; top: number; right: number; bottom: number } {
  const c = centreOf(b);
  const a = rad(b.rotation);
  const hw = (Math.abs(b.w * Math.cos(a)) + Math.abs(b.h * Math.sin(a))) / 2;
  const hh = (Math.abs(b.w * Math.sin(a)) + Math.abs(b.h * Math.cos(a))) / 2;
  return { left: c.x - hw, top: c.y - hh, right: c.x + hw, bottom: c.y + hh };
}

export interface Guides {
  /** Vertical guide lines (x positions) and horizontal ones (y positions) to draw. */
  x: number[];
  y: number[];
}

/**
 * Snaps a moving box to the board's centre and edges and to other boxes' centres and edges, within `threshold` units.
 * `centreOnly` (phones) snaps only to the board centre. Returns the snapped box and the guides that matched.
 */
export function snapMove(
  b: Box,
  others: Box[],
  board: { w: number; h: number },
  threshold = 6,
  centreOnly = false,
): { box: Box; guides: Guides } {
  const r = bounds(b);
  const xs = [r.left, (r.left + r.right) / 2, r.right];
  const ys = [r.top, (r.top + r.bottom) / 2, r.bottom];
  const tx: number[] = centreOnly ? [board.w / 2] : [0, board.w / 2, board.w];
  const ty: number[] = centreOnly ? [board.h / 2] : [0, board.h / 2, board.h];
  if (!centreOnly) {
    for (const o of others) {
      const ob = bounds(o);
      tx.push(ob.left, (ob.left + ob.right) / 2, ob.right);
      ty.push(ob.top, (ob.top + ob.bottom) / 2, ob.bottom);
    }
  }
  const best = (mine: number[], targets: number[]) => {
    let pick: { d: number; at: number } | null = null;
    for (const m of mine) {
      for (const t of targets) {
        const d = t - m;
        if (Math.abs(d) <= threshold && (!pick || Math.abs(d) < Math.abs(pick.d))) pick = { d, at: t };
      }
    }
    return pick;
  };
  const sx = best(xs, tx);
  const sy = best(ys, ty);
  const box = moveBox(b, sx?.d ?? 0, sy?.d ?? 0);
  // Every target the snapped box now touches gets a guide, so aligning two edges at once shows both.
  const nb = bounds(box);
  const touch = (mine: number[], targets: number[]) => [
    ...new Set(targets.filter((t) => mine.some((m) => Math.abs(m - t) < 0.06)).map(round1)),
  ];
  return {
    box,
    guides: {
      x: sx ? touch([nb.left, (nb.left + nb.right) / 2, nb.right], tx) : [],
      y: sy ? touch([nb.top, (nb.top + nb.bottom) / 2, nb.bottom], ty) : [],
    },
  };
}
