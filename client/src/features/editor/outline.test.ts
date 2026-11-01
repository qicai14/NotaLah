import { describe, expect, it } from 'vite-plus/test';
import { ASPECTS, deckSchema, type Outline, THEME_IDS, THEMES } from '@notalah/shared';
import { outlineToSlides } from './outline';
import { emptyDeck } from './store';

const XSS = '<img src=x onerror=alert(1)>';
const col = { heading: XSS, bullets: [XSS] };
const outline: Outline = {
  slides: [
    { layout: 'title', title: XSS, subtitle: XSS },
    { layout: 'title-body', title: XSS, bullets: [XSS, 'Plain & simple'] },
    { layout: 'two-column', title: XSS, left: col, right: col },
    { layout: 'code', title: XSS, language: 'plaintext', code: XSS },
  ],
};
const htmlOf = (s: ReturnType<typeof outlineToSlides>[number]) =>
  s.elements.flatMap((e) => (e.type === 'text' ? [e.html] : []));

describe('outlineToSlides (R28)', () => {
  it('AI-TC21: model text with markup is escaped in every layout', () => {
    for (const s of outlineToSlides(outline, THEMES.plain, '4:5'))
      for (const h of htmlOf(s)) {
        expect(h).not.toContain('<img');
        expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
      }
  });

  it('AI-TC22: each layout fills its boxes, and a cover without a subtitle has one box', () => {
    const [title, body, two, code] = outlineToSlides(outline, THEMES.plain, '4:5');
    expect(htmlOf(title)).toHaveLength(2);
    expect(htmlOf(body)[1]).toContain('<li><p>Plain &amp; simple</p></li>');
    expect(htmlOf(two)).toHaveLength(3);
    expect(code.elements.find((e) => e.type === 'code')).toMatchObject({ code: XSS, language: 'plaintext' });
    const [bare] = outlineToSlides({ slides: [{ layout: 'title', title: 'Hi' }] }, THEMES.plain, '4:5');
    expect(htmlOf(bare)).toEqual(['<p>Hi</p>']);
  });

  it('AI-TC23: the Slides take the Note theme and aspect and pass the deck schema', () => {
    for (const id of THEME_IDS)
      for (const aspect of ASPECTS) {
        const slides = outlineToSlides(outline, THEMES[id], aspect);
        expect(slides[0].background).toEqual(THEMES[id].background);
        expect(deckSchema.safeParse({ ...emptyDeck(), theme: id, aspect, slides }).success).toBe(true);
      }
  });
});
