import { describe, expect, it } from 'vite-plus/test';
import { OUTLINE_LIMITS as L, outlineRoom, outlineSchema, parseOutline } from './index.js';

const slide = (i = 0) => ({ layout: 'title-body', title: `Slide ${i}`, bullets: ['A point'] });
const outline = (n: number) => ({ slides: Array.from({ length: n }, (_, i) => slide(i)) });

describe('outline schema', () => {
  it('AI-TC1 accepts an outline of every layout', () => {
    const col = { heading: 'Left', bullets: ['x'] };
    const r = outlineSchema.safeParse({
      slides: [
        { layout: 'title', title: 'Intro', subtitle: 'Week 1' },
        slide(),
        { layout: 'two-column', title: 'Compare', left: col, right: col },
        { layout: 'code', title: 'Query', code: 'SELECT 1;' },
      ],
    });
    expect(r.success).toBe(true);
    expect(r.data!.slides[3]).toMatchObject({ language: 'plaintext' });
  });

  it.each([
    ['unknown layout', { slides: [{ layout: 'image-caption', title: 'x' }] }],
    ['missing title', { slides: [{ layout: 'title-body', bullets: ['a'] }] }],
    ['blank title', { slides: [{ ...slide(), title: '  ' }] }],
    ['title over limit', { slides: [{ ...slide(), title: 'x'.repeat(L.title + 1) }] }],
    ['bullet over limit', { slides: [{ ...slide(), bullets: ['x'.repeat(L.bullet + 1)] }] }],
    ['too many bullets', { slides: [{ ...slide(), bullets: Array(L.bullets + 1).fill('a') }] }],
    ['code over limit', { slides: [{ layout: 'code', title: 'c', code: 'x'.repeat(L.code + 1) }] }],
    ['too many code lines', { slides: [{ layout: 'code', title: 'c', code: 'a\n'.repeat(L.codeLines + 1) }] }],
    ['cover title over limit', { slides: [{ layout: 'title', title: 'x'.repeat(L.coverTitle + 1) }] }],
    ['code line over limit', { slides: [{ layout: 'code', title: 'c', code: 'x'.repeat(L.codeLineLength + 1) }] }],
    ['extra field', { slides: [{ ...slide(), html: '<b>x</b>' }] }],
    ['no slides', { slides: [] }],
  ])('AI-TC2 rejects %s', (_, bad) => {
    expect(outlineSchema.safeParse(bad).success).toBe(false);
  });

  it('AI-TC1 accepts 12 code lines with a trailing newline', () => {
    const code = 'a\n'.repeat(L.codeLines);
    expect(outlineSchema.safeParse({ slides: [{ layout: 'code', title: 'c', code }] }).success).toBe(true);
  });

  it('AI-TC3 cuts an outline of 20 Slides to 15', () => {
    expect(outlineSchema.parse(outline(20)).slides).toHaveLength(15);
  });
});

describe('outline room', () => {
  it('AI-TC4 allows 10 new Slides on a Note with 20, none on a Note with 30', () => {
    expect(outlineRoom(20)).toBe(10);
    expect(parseOutline(outline(15), 20).data!.slides).toHaveLength(10);
    expect(outlineRoom(30)).toBe(0);
    expect(parseOutline(outline(15), 30).data!.slides).toHaveLength(0);
  });

  it('AI-TC5 allows 15 on an empty Note and still rejects a bad outline', () => {
    expect(outlineRoom(0)).toBe(15);
    expect(parseOutline(outline(20), 0).data!.slides).toHaveLength(15);
    expect(parseOutline({ slides: [{ layout: 'x' }] }, 0).success).toBe(false);
  });
});
