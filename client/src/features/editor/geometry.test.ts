import { describe, expect, it } from 'vite-plus/test';
import {
  alignBoxes,
  type Box,
  boxesTouching,
  distributeBoxes,
  groupBounds,
  groupScale,
  handlePoint,
  moveBox,
  resizeBox,
  rotateAbout,
  rotationFromPointer,
  snapMove,
} from '@parp/shared';

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

describe('editor group geometry', () => {
  const a: Box = { x: 0, y: 0, w: 100, h: 50, rotation: 0 };
  const b: Box = { x: 300, y: 100, w: 50, h: 50, rotation: 0 };
  const c: Box = { x: 120, y: 200, w: 100, h: 100, rotation: 0 };

  it('NOTE-TC78: the group frame, alignment and even spacing follow the rotated bounds', () => {
    expect(groupBounds([a, b, c])).toEqual({ x: 0, y: 0, w: 350, h: 300 });
    const turned = groupBounds([{ ...a, rotation: 90 }]); // 100 x 50 turned on its centre (50, 25)
    expect(turned.w).toBeCloseTo(50);
    expect(turned.h).toBeCloseTo(100);
    const left = alignBoxes([a, b, c], groupBounds([a, b, c]), 'left');
    expect(left.map((x) => x.x)).toEqual([0, 0, 0]);
    const middle = alignBoxes([a, b], { x: 0, y: 0, w: 1000, h: 1000 }, 'middle');
    expect(middle.map((x) => x.y)).toEqual([475, 475]);
    // Sorted by left edge: a (0-100), c (150-250), b (300-350); span 350, sizes 250, so gaps of 50.
    const spaced = distributeBoxes([a, b, c], 'x');
    expect(spaced.map((x) => x.x)).toEqual([0, 300, 150]);
    const spacedY = distributeBoxes([a, b, c], 'y'); // a 0-50, b 100-150, c 200-300: gaps already 50
    expect(spacedY.map((x) => x.y)).toEqual([0, 100, 200]);
    expect(distributeBoxes([a, b], 'x')).toEqual([a, b]); // two boxes have nothing to space
  });

  it('NOTE-TC78: group scale keeps the opposite corner, rotation turns about the frame centre, marquee hits', () => {
    const frame = groupBounds([a, b]); // 0,0 350 x 150
    const { k, anchor } = groupScale(frame, 'se', { x: 700, y: 150 });
    expect(k).toBe(2);
    expect(anchor).toEqual({ x: 0, y: 0 });
    const r = rotateAbout(a, { x: 50, y: 125 }, 180); // a's centre (50, 25) goes to (50, 225)
    expect(r).toMatchObject({ x: 0, y: 200, rotation: 180 });
    const hits = boxesTouching({ x: 90, y: 40, w: 100, h: 200 }, [
      { id: 'a', box: a },
      { id: 'b', box: b },
      { id: 'c', box: c },
    ]);
    expect(hits).toEqual(['a', 'c']);
  });
});
