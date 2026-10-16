import { describe, expect, it } from 'vitest';
import { type Box, handlePoint, moveBox, resizeBox, rotationFromPointer, snapMove } from '@parp/shared';

const box: Box = { x: 100, y: 100, w: 200, h: 100, rotation: 0 };
const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 0);
  expect(a.y).toBeCloseTo(b.y, 0);
};

describe('editor geometry', () => {
  it('NOTE-TC44: resizing a 30-degree box keeps the opposite corner fixed', () => {
    const r: Box = { ...box, rotation: 30 };
    const anchor = handlePoint(r, 'nw');
    const out = resizeBox(r, 'se', { x: 420, y: 330 });
    close(handlePoint(out, 'nw'), anchor);
    expect(out.rotation).toBe(30);
    // An edge handle changes one side only and keeps the opposite edge's midpoint.
    const edge = resizeBox(r, 'e', { x: 500, y: 300 });
    expect(edge.h).toBe(100);
    close(handlePoint(edge, 'w'), handlePoint(r, 'w'));
  });

  it('NOTE-TC44: Shift keeps the ratio and a resize never goes below the minimum', () => {
    const out = resizeBox(box, 'se', { x: 700, y: 210 }, true);
    expect(out.w / out.h).toBeCloseTo(2, 5);
    expect(out.w).toBe(600);
    const tiny = resizeBox(box, 'se', { x: 0, y: 0 });
    expect(tiny.w).toBe(8);
    expect(tiny.h).toBe(8);
    expect(tiny.x).toBe(100); // nw corner held
  });

  it('NOTE-TC44: rotation snaps to 15-degree steps unless snapping is off', () => {
    const c = { x: 200, y: 150 };
    expect(rotationFromPointer(box, { x: c.x, y: c.y - 100 })).toBe(0);
    expect(rotationFromPointer(box, { x: c.x + 100, y: c.y })).toBe(90);
    expect(rotationFromPointer(box, { x: c.x + 100, y: c.y - 30 })).toBe(75); // 73.3 snaps to 75
    expect(rotationFromPointer(box, { x: c.x + 100, y: c.y - 30 }, false)).toBeCloseTo(73.3, 1);
    expect(rotationFromPointer(box, { x: c.x - 100, y: c.y - 1 })).toBe(270);
  });

  it('NOTE-TC44: moving snaps to the board centre and other boxes, with guides', () => {
    const near = moveBox(box, 297, 0); // centre x 497, three units off the board centre
    const { box: snapped, guides } = snapMove(near, [], { w: 1000, h: 1250 });
    expect(snapped.x + snapped.w / 2).toBe(500);
    expect(guides.x).toContain(500);
    const other: Box = { x: 600, y: 400, w: 100, h: 100, rotation: 0 };
    const edge = snapMove({ ...box, x: 702, y: 403 }, [other], { w: 1000, h: 1250 });
    expect(edge.box.x).toBe(700); // left edge onto the other's right edge
    expect(edge.box.y).toBe(400);
    const phone = snapMove({ ...box, x: 702, y: 403 }, [other], { w: 1000, h: 1250 }, 6, true);
    expect(phone.box.x).toBe(702); // phones snap to the centre only
  });
});
