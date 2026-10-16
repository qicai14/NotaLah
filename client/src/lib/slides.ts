import type { Slide as DeckSlide, SlideElement } from '@parp/shared';

// shortcut: the pre-R21b editor and viewer still treat a slide as one HTML string. These two functions bridge that to the
// element model: only text elements survive an edit-and-save round trip. R21b and R21c replace them.

/** The HTML the old viewer shows for a slide: its text elements in array order. */
export const slideToHtml = (slide: { elements: SlideElement[] }): string =>
  slide.elements.map((e) => (e.type === 'text' ? e.html : '')).join('');

/**
 * A white slide holding `html` in one full-board text element; an empty string gives an empty slide. The id comes from
 * the slide's position, as in the migration, so resaving unchanged text is not a content edit (it would void Super Likes).
 */
export const htmlToSlide = (html: string, index: number, notes = ''): DeckSlide => ({
  background: { kind: 'color', color: '#ffffff' },
  elements: html
    ? [
        {
          id: `text-${String(index + 1).padStart(3, '0')}`,
          type: 'text',
          x: 60,
          y: 60,
          w: 880,
          h: 1130,
          rotation: 0,
          opacity: 1,
          locked: false,
          html,
          font: 'source-sans-3',
          size: 32,
          weight: 400,
          color: '#111827',
          align: 'left',
          lineHeight: 1.4,
          letterSpacing: 0,
          padding: 0,
        },
      ]
    : [],
  notes,
});
