import type { Slide } from '@notalah/shared';
import type { Annotation } from '../../types';

export const MAX_QUOTE = 300;

/** Where a selection sits: the text element and the quote's offset in that element's plain text (`textContent`). */
export interface Anchor {
  elementId: string;
  quote: string;
  offset: number;
}

/** Maps a selection to its anchor, or null unless it lies inside one slide text element (`[data-anchor]`). Edge whitespace is dropped. */
export function selectionAnchor(range: Range): Anchor | null {
  const start = (range.startContainer.parentElement ?? null)?.closest<HTMLElement>('[data-anchor]');
  const end = (range.endContainer.parentElement ?? null)?.closest<HTMLElement>('[data-anchor]');
  if (!start || start !== end || start.closest('[inert]')) return null;
  const raw = range.toString();
  const quote = raw.trim();
  if (!quote) return null;
  const before = document.createRange();
  before.selectNodeContents(start);
  before.setEnd(range.startContainer, range.startOffset);
  return {
    elementId: start.dataset.anchor!,
    quote,
    offset: before.toString().length + raw.length - raw.trimStart().length,
  };
}

/** Where the quote starts now: at its offset if still there, else its first occurrence, else null ("Text changed"). */
export function resolveOffset(text: string, quote: string, offset: number): number | null {
  if (text.startsWith(quote, offset)) return offset;
  const i = text.indexOf(quote);
  return i < 0 ? null : i;
}

/** An element's plain text as the slide renders it; a template parses the HTML without running or fetching anything. */
export function htmlText(html: string): string {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content.textContent ?? '';
}

/** The annotation's start in the current deck, or null when its slide, element or quote is gone. */
export function resolveAnchor(slides: Pick<Slide, 'elements'>[], a: Annotation): number | null {
  const el = slides[a.slideId - 1]?.elements.find((e) => e.id === a.elementId);
  return el?.type === 'text' ? resolveOffset(htmlText(el.html), a.quote, a.offset) : null;
}

/** A DOM range over `length` characters of `root`'s text from `start`. */
export function textRange(root: Node, start: number, length: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let begun = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent!.length;
    if (!begun && start < pos + len) {
      range.setStart(n, start - pos);
      begun = true;
    }
    if (begun && start + length <= pos + len) {
      range.setEnd(n, start + length - pos);
      return range;
    }
    pos += len;
  }
  return null;
}
