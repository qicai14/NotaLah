import { describe, expect, it } from 'vitest';
import { htmlToSlide, slideToHtml } from './slides';

// The shape the migration gives an old HTML slide: one full-board text element with a position-based id.
const migrated = (html: string) => ({
  background: { kind: 'color' as const, color: '#ffffff' },
  elements: htmlToSlide(html, 0).elements,
});

describe('slide adapter', () => {
  it('NOTE-TC47: resaving a loaded slide gives back the same background and elements', () => {
    const loaded = migrated('<p>hello</p>');
    expect(loaded.elements[0]).toMatchObject({ id: 'text-001', type: 'text', html: '<p>hello</p>' });
    const again = htmlToSlide(slideToHtml(loaded), 0);
    expect({ background: again.background, elements: again.elements }).toEqual(loaded);
    expect(htmlToSlide('<p>b</p>', 1).elements[0].id).toBe('text-002');
  });

  it('NOTE-TC48: an empty string is an empty slide and page notes are carried through', () => {
    expect(htmlToSlide('', 0).elements).toEqual([]);
    expect(slideToHtml(htmlToSlide('', 0))).toBe('');
    expect(htmlToSlide('x', 0, 'my notes').notes).toBe('my notes');
  });
});
