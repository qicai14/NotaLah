import { describe, expect, it } from 'vitest';
import { LIMITS } from '@parp/shared';
import { makeImage, resizeTable } from './elements';

describe('code, table and image blocks', () => {
  it('NOTE-TC74: tables grow and shrink within the schema limits, keeping typed cells', () => {
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

  it('NOTE-TC74: an image keeps its own ratio, fits the slide and clips long alt text', () => {
    const img = makeImage(1250, { kind: 'upload', assetId: 3 }, 1200, 800, 'x'.repeat(400));
    expect(img.w / img.h).toBeCloseTo(1.5, 1);
    expect(img.w).toBeLessThanOrEqual(700);
    expect(img.x + img.w / 2).toBeCloseTo(500, 0);
    expect(img.alt).toHaveLength(LIMITS.altText);
    expect(img.crop).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
