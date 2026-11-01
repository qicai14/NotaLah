/** Board width in units; the height follows from the aspect, so one scale factor renders any size (R21 spec 1.1). */
export const BOARD_WIDTH = 1000;

export const ASPECTS = ['4:5', '9:16', '16:9'] as const;
export type Aspect = (typeof ASPECTS)[number];

const RATIO: Record<Aspect, number> = { '4:5': 4 / 5, '9:16': 9 / 16, '16:9': 16 / 9 };
export const boardHeight = (aspect: Aspect): number => BOARD_WIDTH / RATIO[aspect];

export const FONT_IDS = ['source-sans-3', 'atkinson', 'lora', 'merriweather', 'montserrat', 'jetbrains-mono'] as const;
export type FontId = (typeof FONT_IDS)[number];

/** Deck themes: the four old note templates keep their names (R21 spec 2.1); the styles live in design.ts (D69). */
export const THEME_IDS = ['plain', 'lecture', 'revision', 'howto', 'journal', 'midnight'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const CODE_LANGS = [
  'plaintext',
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'sql',
  'html',
  'css',
  'json',
  'bash',
] as const;
export type CodeLang = (typeof CODE_LANGS)[number];

export const LIMITS = {
  slides: 30,
  hashtags: 5,
  elementsPerSlide: 60,
  imagesPerSlide: 10,
  videosPerSlide: 1,
  textHtml: 20_000,
  textPerSlide: 20_000,
  code: 5_000,
  pageNotes: 2_000,
  slideBytes: 48 * 1024,
  altText: 250,
  tableRows: 20,
  tableCols: 8,
  tableCell: 200,
} as const;

/** Longest message on a request to collaborate (R30). */
export const COLLAB_REQUEST_MESSAGE_MAX = 300;

/** Messaging limits (FR6, FR7, FR13, D50), shared so the server enforces what the client shows. */
export const MESSAGING_LIMITS = Object.freeze({
  /** Longest message or held request text, in characters (the column is VARCHAR(2000)). */
  bodyMax: 2000,
  /** Longest group name (the column is VARCHAR(80)). */
  groupNameMax: 80,
  /** A group holds at most this many members, the creator included; a new group needs at least two other members. */
  groupMax: 30,
  groupMinOthers: 2,
  /** History page size; conversation and request inbox page size. */
  historyPage: 50,
  listPage: 20,
  /** A socket's typing events for one conversation are relayed at most once per this window; the rest are dropped. */
  typingThrottleMs: 2000,
});

/**
 * AI outline limits (R28, #111). Sized to the layoutSlide boxes at the tightest aspect (16:9: 904-unit width, 22 px body,
 * 44 px heading), so generated text is not clipped. Shorter boards are the binding case; 4:5 and 9:16 have more room
 * for body text but a 64 px heading that holds about 23 characters per line.
 */
export const OUTLINE_LIMITS = {
  /** Most Slides one outline may add. */
  slides: 15,
  title: 40,
  subtitle: 60,
  /** Bullets per body or column, and characters per bullet (about 1 to 3 lines in a column). */
  bullets: 6,
  columnBullets: 4,
  bullet: 80,
  columnHeading: 30,
  /** Code box fits about 12 lines of 80 characters at 16:9. */
  code: 600,
  codeLines: 12,
} as const;
