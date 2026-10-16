import { slideSchema } from '@parp/shared';
import { describe, expect, it } from 'vitest';
import { htmlToSlide, slideToHtml } from './slides';

describe('slide adapter', () => {
  it('NOTE-TC26: a slide built from HTML passes the shared schema and gives its HTML back', () => {
    const slide = htmlToSlide('<p>hello</p>');
    expect(slideSchema.safeParse(slide).success).toBe(true);
    expect(slideToHtml(slide)).toBe('<p>hello</p>');
  });

  it('NOTE-TC27: the shared schema rejects an unknown element type', () => {
    const bad = { ...htmlToSlide('x'), elements: [{ ...htmlToSlide('x').elements[0], type: 'iframe' }] };
    expect(slideSchema.safeParse(bad).success).toBe(false);
  });

  it('an empty string is an empty slide', () => {
    expect(htmlToSlide('').elements).toEqual([]);
    expect(slideToHtml(htmlToSlide(''))).toBe('');
  });
});
