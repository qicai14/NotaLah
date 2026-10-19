import { describe, expect, it } from 'vite-plus/test';
import { LIMITS } from '@notalah/shared';
import { makeImage, makeText, resizeTable } from './elements';
import { emptyDeck, groupScaleRange, useEditor } from './store';

describe('code, table and image blocks', () => {
  it('NOTE-TC84: tables grow and shrink within the schema limits, keeping typed cells', () => {
    const cells = [
      ['Form', 'Rule'],
      ['1NF', 'Atomic'],
    ];
    expect(resizeTable(cells, 3, 2)).toEqual([...cells, ['', '']]);
    expect(resizeTable(cells, 2, 1)).toEqual([['Form'], ['1NF']]);
    expect(resizeTable(cells, 2, 2)).toBeNull();
    expect(resizeTable(cells, 0, 2)).toEqual([['Form', 'Rule']]);
    expect(resizeTable(cells, 99, 99)?.length).toBe(LIMITS.tableRows);
    expect(resizeTable(cells, 99, 99)?.[0].length).toBe(LIMITS.tableCols);
  });

  it('NOTE-TC84: an image keeps its own ratio, fits the slide and clips long alt text', () => {
    const img = makeImage(1250, { kind: 'upload', assetId: 3 }, 1200, 800, 'x'.repeat(400));
    expect(img.w / img.h).toBeCloseTo(1.5, 1);
    expect(img.w).toBeLessThanOrEqual(700);
    expect(img.x + img.w / 2).toBeCloseTo(500, 0);
    expect(img.alt).toHaveLength(LIMITS.altText);
    expect(img.crop).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('NOTE-TC87: a paste stops at the image cap, and group scaling stays inside the schema limits', () => {
    useEditor.getState().load(emptyDeck());
    const images = Array.from({ length: 12 }, () => makeImage(1250, { kind: 'upload', assetId: 1 }, 400, 400));
    useEditor.getState().addElements([...images, makeText('body', 1250)]);
    const els = useEditor.getState().deck.slides[0].elements;
    expect(els.filter((e) => e.type === 'image')).toHaveLength(LIMITS.imagesPerSlide);
    expect(els.filter((e) => e.type === 'text')).toHaveLength(1); // other elements still go in
    const heading = { ...makeText('heading', 1250), size: 100, w: 760, h: 40 };
    const range = groupScaleRange([heading], 8);
    expect(range.min).toBeCloseTo(0.2); // 40 high cannot go under 8
    expect(range.max).toBe(4); // a 100 font may grow to 400, not past it
  });
});
