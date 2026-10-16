import { BOARD_WIDTH, round1, type SlideElement, type TextElement } from '@parp/shared';
import StarterKit from '@tiptap/starter-kit';
import { newId } from './store';

type Shape = Extract<SlideElement, { type: 'shape' }>['shape'];

// The server's sanitiser allow-list (D20, D53 adds `u`): StarterKit v3 also ships Link, ListKeymap and TrailingNode.
export const TEXT_EXTENSIONS = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false, listKeymap: false, trailingNode: false }),
];

const base = (boardH: number, w: number, h: number) => ({
  id: newId(),
  x: round1((BOARD_WIDTH - w) / 2),
  y: round1((boardH - h) / 2),
  w,
  h,
  rotation: 0,
  opacity: 1,
  locked: false,
});

export const TEXT_PRESETS = {
  heading: { label: 'Add a heading', html: '<p>Add a heading</p>', size: 72, weight: 700, h: 110 },
  subheading: { label: 'Add a subheading', html: '<p>Add a subheading</p>', size: 44, weight: 600, h: 80 },
  body: { label: 'Add body text', html: '<p>Add a little bit of body text</p>', size: 30, weight: 400, h: 60 },
} as const;

export function makeText(kind: keyof typeof TEXT_PRESETS, boardH: number): TextElement {
  const p = TEXT_PRESETS[kind];
  return {
    ...base(boardH, 760, p.h),
    type: 'text',
    html: p.html,
    font: 'source-sans-3',
    size: p.size,
    weight: p.weight,
    color: '#111827',
    align: 'left',
    lineHeight: 1.25,
    letterSpacing: 0,
    padding: 0,
  };
}

export const SHAPES: { shape: Shape; label: string }[] = [
  { shape: 'rect', label: 'Rectangle' },
  { shape: 'ellipse', label: 'Circle' },
  { shape: 'triangle', label: 'Triangle' },
  { shape: 'diamond', label: 'Diamond' },
  { shape: 'arrow', label: 'Arrow' },
];

export function makeShape(shape: Shape, boardH: number): SlideElement {
  const w = shape === 'arrow' ? 360 : 280;
  return {
    ...base(boardH, w, shape === 'arrow' ? 180 : 280),
    type: 'shape',
    shape,
    fill: '#2b37e3',
    stroke: null,
    strokeWidth: 0,
    radius: 0,
  };
}

export function makeLine(boardH: number, arrow = false): SlideElement {
  return {
    ...base(boardH, 480, 40),
    type: 'line',
    stroke: '#111827',
    strokeWidth: 6,
    dash: 'solid',
    startCap: 'none',
    endCap: arrow ? 'arrow' : 'none',
  };
}

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The name an element is announced and listed by. */
export function elementLabel(el: SlideElement): string {
  switch (el.type) {
    case 'text':
      return `Text: ${plain(el.html).slice(0, 40) || 'empty'}`;
    case 'shape':
      return SHAPES.find((s) => s.shape === el.shape)?.label ?? 'Shape';
    case 'line':
      return el.endCap === 'arrow' || el.startCap === 'arrow' ? 'Arrow line' : 'Line';
    case 'image':
      return `Image: ${el.alt || 'no description'}`;
    case 'code':
      return 'Code block';
    case 'table':
      return 'Table';
    case 'video':
      return 'Video';
  }
}
