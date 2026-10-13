import { describe, expect, it } from 'vitest';
import { addHashtags } from './hashtags';

describe('hashtag input', () => {
  it('NOTE-TC24: client hashtag input normalises and limits tags', () => {
    const a = addHashtags([], '#Algebra, maths, Algebra');
    expect(a).toEqual({ tags: ['algebra', 'maths'], error: null });

    const bad = addHashtags(a.tags, 'two words');
    expect(bad.tags).toEqual(['algebra', 'maths']);
    expect(bad.error).toMatch(/not valid/);

    const full = addHashtags(['a', 'b', 'c', 'd', 'e'], 'f');
    expect(full.tags).toHaveLength(5);
    expect(full.error).toBe('Maximum 5 hashtags');
  });
});
