import {
  type Aspect,
  bullets,
  escapeHtml,
  LIMITS,
  layoutSlide,
  type Outline,
  type OutlineSlide,
  para,
  type Slide,
  type SlideElement,
  type Theme,
} from '@notalah/shared';
import { newId } from './store';

const column = (c: { heading: string; bullets: string[] }) =>
  `<p><strong>${escapeHtml(c.heading)}</strong></p>${bullets(...c.bullets)}`;

/** The html of each text box of the layout, in the order layoutSlide makes them. Every model string is escaped here. */
function texts(o: OutlineSlide): string[] {
  switch (o.layout) {
    case 'title':
      return o.subtitle ? [para(o.title), para(o.subtitle)] : [para(o.title)];
    case 'title-body':
      return [para(o.title), bullets(...o.bullets)];
    case 'two-column':
      return [para(o.title), column(o.left), column(o.right)];
    case 'code':
      return [para(o.title)];
  }
}

/** Turns a validated outline into Slides in the Note's theme and aspect: the layout's boxes with the outline's text. */
export function outlineToSlides(outline: Outline, theme: Theme, aspect: Aspect): Slide[] {
  return outline.slides.map((o) => {
    const html = texts(o);
    let i = 0;
    const base = layoutSlide(o.layout, theme, aspect, newId);
    return {
      ...base,
      elements: base.elements.flatMap((e): SlideElement[] => {
        if (e.type === 'text') return i < html.length ? [{ ...e, html: html[i++] }] : []; // a cover without a subtitle
        if (e.type === 'code' && o.layout === 'code') return [{ ...e, code: o.code, language: o.language }];
        return [e];
      }),
    };
  });
}

/** The plain text of a text box, one line per paragraph or list item. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  doc.body.querySelectorAll('p,li,br').forEach((n) => n.after('\n'));
  return (doc.body.textContent ?? '').replace(/\n+/g, '\n').trim();
}

/** A model reply as a text box body: every line becomes an escaped paragraph, so it is plain text like typed text. */
export const textToHtml = (text: string): string =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(para)
    .join('');

/** One Slide for a quiz: the questions as bullets, the numbered answers in the page notes. */
export function quizSlide(questions: { q: string; a: string }[], theme: Theme, aspect: Aspect): Slide {
  const [slide] = outlineToSlides(
    { slides: [{ layout: 'title-body', title: 'Quiz me', bullets: questions.map((x) => x.q) }] },
    theme,
    aspect,
  );
  const notes = questions.map((x, i) => `${i + 1}. ${x.a}`).join('\n');
  return { ...slide, notes: notes.slice(0, LIMITS.pageNotes) };
}
