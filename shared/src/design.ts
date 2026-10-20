import type { Deck, El, Fill, Slide, SlideElement } from './deck.js';
import { round1 } from './geometry.js';
import { type Aspect, BOARD_WIDTH, boardHeight, type FontId, type ThemeId } from './limits.js';

/**
 * Deck design data (R21 spec 2.3, D69): fonts, themes and slide layouts. Applying a theme writes concrete fonts and
 * colours into the elements, so a later change to these constants never alters a saved note. The AI assistant (R28)
 * imports the same constants.
 */

export const FONT_NAMES: Record<FontId, string> = {
  'source-sans-3': 'Source Sans 3',
  atkinson: 'Atkinson Hyperlegible',
  lora: 'Lora',
  merriweather: 'Merriweather',
  montserrat: 'Montserrat',
  'jetbrains-mono': 'JetBrains Mono',
};

export interface Theme {
  id: ThemeId;
  name: string;
  background: Fill;
  /** Text at HEADING_MIN size or larger. */
  heading: string;
  text: string;
  /** Shapes and lines. */
  accent: string;
  /** Table borders and image placeholders. */
  muted: string;
  headingFont: FontId;
  bodyFont: FontId;
  code: 'light' | 'dark';
}

/** Text this size or larger is a heading: it takes the theme's heading font and colour. */
export const HEADING_MIN = 40;

export const THEMES: Record<ThemeId, Theme> = {
  plain: {
    id: 'plain',
    name: 'Plain',
    background: { kind: 'color', color: '#ffffff' },
    heading: '#111827',
    text: '#111827',
    accent: '#2b37e3',
    muted: '#9ca3af',
    headingFont: 'source-sans-3',
    bodyFont: 'source-sans-3',
    code: 'dark',
  },
  lecture: {
    id: 'lecture',
    name: 'Lecture',
    background: { kind: 'color', color: '#f5f7ff' },
    heading: '#1e2a78',
    text: '#1f2937',
    accent: '#2b37e3',
    muted: '#a5acd6',
    headingFont: 'merriweather',
    bodyFont: 'source-sans-3',
    code: 'dark',
  },
  revision: {
    id: 'revision',
    name: 'Revision',
    background: { kind: 'color', color: '#fff8e1' },
    heading: '#3d2b00',
    text: '#2a2300',
    accent: '#d97706',
    muted: '#e0c98a',
    headingFont: 'montserrat',
    bodyFont: 'atkinson',
    code: 'light',
  },
  howto: {
    id: 'howto',
    name: 'Step by step',
    background: { kind: 'color', color: '#e6f4ea' },
    heading: '#0b4f3a',
    text: '#1f2937',
    accent: '#0b7a4b',
    muted: '#9cc9ae',
    headingFont: 'montserrat',
    bodyFont: 'source-sans-3',
    code: 'dark',
  },
  journal: {
    id: 'journal',
    name: 'Journal',
    background: { kind: 'color', color: '#fbf5ee' },
    heading: '#5b1a32',
    text: '#3b2f2f',
    accent: '#b4475f',
    muted: '#d9c3b0',
    headingFont: 'lora',
    bodyFont: 'lora',
    code: 'light',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    background: { kind: 'gradient', from: '#15171c', to: '#1e2a78', angle: 160 },
    heading: '#ffffff',
    text: '#e5e7eb',
    accent: '#8a93ff',
    muted: '#4b5280',
    headingFont: 'montserrat',
    bodyFont: 'atkinson',
    code: 'dark',
  },
};

/**
 * One element in a theme's fonts and colours. Text keeps a monospace font and its inline colours, and a filled box
 * keeps its text colour; shapes filled with
 * the previous theme's muted colour are placeholders and stay muted; images and videos are untouched.
 */
export function themeElement(el: SlideElement, theme: Theme, previous: Theme = theme): SlideElement {
  switch (el.type) {
    case 'text': {
      const heading = el.size >= HEADING_MIN;
      return {
        ...el,
        font: el.font === 'jetbrains-mono' ? el.font : heading ? theme.headingFont : theme.bodyFont,
        // A filled box keeps its text colour, so the text/fill pair stays readable.
        color: el.fill ? el.color : heading ? theme.heading : theme.text,
      };
    }
    case 'table':
      return { ...el, font: theme.bodyFont, color: theme.text, borderColor: theme.muted };
    case 'code':
      return { ...el, theme: theme.code };
    case 'shape': {
      const tone = (c: string | null) => (c === null ? null : c === previous.muted ? theme.muted : theme.accent);
      return { ...el, fill: tone(el.fill), stroke: tone(el.stroke) };
    }
    case 'line':
      return { ...el, stroke: theme.accent };
    default:
      return el;
  }
}

/** The deck in a theme: every element restyled, and every slide without a photo background gets the theme's. */
export function applyTheme(deck: Deck, id: ThemeId): Deck {
  const theme = THEMES[id];
  const previous = THEMES[deck.theme];
  return {
    ...deck,
    theme: id,
    slides: deck.slides.map((s) => ({
      ...s,
      background: s.background.kind === 'image' ? s.background : theme.background,
      elements: s.elements.map((e) => themeElement(e, theme, previous)),
    })),
  };
}

export const LAYOUT_IDS = ['title', 'title-body', 'two-column', 'code', 'image-caption'] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const LAYOUT_NAMES: Record<LayoutId, string> = {
  title: 'Title',
  'title-body': 'Title and body',
  'two-column': 'Two columns',
  code: 'Code',
  'image-caption': 'Image and caption',
};

const bullets = (...items: string[]) => `<ul>${items.map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`;

/** A slide laid out for the aspect in the theme's style; `newId` makes the element ids. */
export function layoutSlide(layout: LayoutId, theme: Theme, aspect: Aspect, newId: () => string): Slide {
  const H = boardHeight(aspect);
  const f = Math.max(0.6, Math.min(1, H / 1250)); // shorter boards get smaller type and margins
  const m = round1(80 * f);
  const width = BOARD_WIDTH - 2 * m;
  const text = (html: string, x: number, y: number, w: number, size: number, lines: number, center = false) =>
    ({
      id: newId(),
      type: 'text',
      x: round1(x),
      y: round1(y),
      w: round1(w),
      h: round1(size * 1.3 * lines),
      rotation: 0,
      opacity: 1,
      locked: false,
      html,
      font: 'source-sans-3',
      size: round1(size),
      weight: size >= HEADING_MIN ? 700 : 400,
      color: '#111827',
      align: center ? 'center' : 'left',
      lineHeight: 1.25,
      letterSpacing: 0,
      padding: 0,
    }) satisfies El<'text'>;
  const headSize = Math.max(HEADING_MIN + 4, 64 * f);
  const head = (t: string) => text(`<p>${t}</p>`, m, m, width, headSize, 1);
  const below = m + headSize * 1.3 + 40 * f;
  const rest = H - below - m;
  const body = Math.min(32, Math.max(22, 32 * f));

  let elements: SlideElement[];
  switch (layout) {
    case 'title': {
      const size = Math.max(56, 88 * f);
      const y = H * 0.36;
      elements = [
        text('<p>Note title</p>', m, y, width, size, 1, true),
        text('<p>Module, topic or week</p>', m, y + size * 1.3 + 24 * f, width, Math.min(36, 36 * f + 6), 1, true),
      ];
      break;
    }
    case 'title-body':
      elements = [
        head('Heading'),
        {
          ...text(bullets('First key point', 'Second key point', 'Third key point'), m, below, width, body, 1),
          h: round1(rest),
        },
      ];
      break;
    case 'two-column': {
      const w = (width - 40) / 2;
      const col = (x: number, name: string) => ({
        ...text(`<p><strong>${name}</strong></p>${bullets('Point', 'Point')}`, x, below, w, body, 1),
        h: round1(rest),
      });
      elements = [head('Compare'), col(m, 'Left'), col(m + w + 40, 'Right')];
      break;
    }
    case 'code':
      elements = [
        head('Example'),
        {
          id: newId(),
          type: 'code',
          x: m,
          y: round1(below),
          w: width,
          h: round1(Math.min(rest, 520 * f)),
          rotation: 0,
          opacity: 1,
          locked: false,
          code: 'SELECT name\nFROM "MODULE_T"\nORDER BY name;',
          language: 'sql',
          theme: 'dark',
          size: round1(26 * f),
        },
      ];
      break;
    case 'image-caption': {
      const capSize = Math.min(30, Math.max(22, 30 * f));
      const capH = capSize * 1.3 * 2;
      elements = [
        {
          id: newId(),
          type: 'shape',
          shape: 'rect',
          x: m,
          y: m,
          w: width,
          h: round1(H - 2 * m - capH - 24 * f),
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: theme.muted, // the placeholder frame: it stays muted when the theme changes
          stroke: null,
          strokeWidth: 0,
          radius: round1(24 * f),
        },
        text('<p>Caption: what the image shows and why it matters</p>', m, H - m - capH, width, capSize, 2, true),
      ];
      break;
    }
  }
  return {
    background: theme.background,
    elements: elements.map((e) => themeElement(e, theme)),
    notes: '',
  };
}
