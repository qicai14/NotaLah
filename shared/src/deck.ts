import { z } from 'zod';
import { ASPECTS, CODE_LANGS, FONT_IDS, LIMITS, THEME_IDS } from './limits.js';

const num = (min: number, max: number, what: string) =>
  z
    .number({ error: `${what} must be a number` })
    .min(min, `${what} must be between ${min} and ${max}`)
    .max(max, `${what} must be between ${min} and ${max}`);
const int = (min: number, max: number, what: string) => num(min, max, what).int(`${what} must be a whole number`);
const bool = (what: string) => z.boolean({ error: `${what} must be true or false` });
const oneOf = <const T extends readonly [string, ...string[]]>(values: T, what: string) =>
  z.enum(values, { error: `Invalid ${what}` });
const text = (max: number, what: string) =>
  z.string({ error: `${what} must be text` }).max(max, `${what} must be at most ${max} characters`);

const hexSchema = z.string({ error: 'Invalid colour' }).regex(/^#[0-9a-f]{6}([0-9a-f]{2})?$/i, 'Invalid colour');
const idSchema = z.string({ error: 'Invalid element id' }).regex(/^[A-Za-z0-9-]{8,36}$/, 'Invalid element id');

const fontSchema = oneOf(FONT_IDS, 'font');
const alignSchema = oneOf(['left', 'center', 'right', 'justify'], 'alignment');
const capSchema = oneOf(['none', 'arrow'], 'line cap');

export const aspectSchema = oneOf(ASPECTS, 'aspect');
export const themeSchema = oneOf(THEME_IDS, 'theme');

const unsplashUrl = z
  .string({ error: 'Invalid image URL' })
  .max(500, 'Invalid image URL')
  .regex(/^https:\/\/images\.unsplash\.com\/[A-Za-z0-9\-._~/?&=%+]*$/, 'Invalid Unsplash image URL');
const unsplashAuthorUrl = z
  .string({ error: 'Invalid author URL' })
  .max(500, 'Invalid author URL')
  .regex(/^https:\/\/unsplash\.com\//, 'Author URL must come from unsplash.com');

export const imageSourceSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({ kind: z.literal('upload'), assetId: int(1, 2147483647, 'Image') }),
    z.strictObject({
      kind: z.literal('unsplash'),
      photoId: z.string({ error: 'Invalid photo id' }).regex(/^[A-Za-z0-9_-]{1,40}$/, 'Invalid photo id'),
      url: unsplashUrl,
      authorName: text(100, 'Author name'),
      authorUrl: unsplashAuthorUrl,
    }),
  ],
  { error: 'Unknown image source' },
);

const fillSchema = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({ kind: z.literal('color'), color: hexSchema }),
    z.strictObject({
      kind: z.literal('gradient'),
      from: hexSchema,
      to: hexSchema,
      angle: num(0, 360, 'Gradient angle'),
    }),
    z.strictObject({ kind: z.literal('image'), image: imageSourceSchema, overlay: hexSchema.optional() }),
  ],
  { error: 'Unknown background type' },
);

const shadowSchema = z.strictObject({
  x: num(-100, 100, 'Shadow offset'),
  y: num(-100, 100, 'Shadow offset'),
  blur: num(0, 100, 'Shadow blur'),
  color: hexSchema,
});

const base = {
  id: idSchema,
  x: num(-1000, 2778, 'x'),
  y: num(-1000, 2778, 'y'),
  w: num(1, 4000, 'Width'),
  h: num(1, 4000, 'Height'),
  rotation: num(0, 360, 'Rotation').lt(360, 'Rotation must be between 0 and 360'),
  opacity: num(0, 1, 'Opacity'),
  locked: bool('Locked'),
};

const textEl = z.strictObject({
  ...base,
  type: z.literal('text'),
  html: z.string({ error: 'Text must be a string' }),
  font: fontSchema,
  size: num(8, 400, 'Font size'),
  weight: z.union([z.literal(400), z.literal(600), z.literal(700)], { error: 'Invalid weight' }),
  color: hexSchema,
  align: alignSchema,
  lineHeight: num(0.8, 3, 'Line height'),
  letterSpacing: num(-20, 100, 'Letter spacing'),
  fill: hexSchema.optional(),
  padding: num(0, 200, 'Padding'),
  shadow: shadowSchema.optional(),
});

const shapeEl = z.strictObject({
  ...base,
  type: z.literal('shape'),
  shape: oneOf(['rect', 'ellipse', 'triangle', 'diamond', 'arrow'], 'shape'),
  fill: hexSchema.nullable(),
  stroke: hexSchema.nullable(),
  strokeWidth: num(0, 40, 'Stroke width'),
  radius: num(0, 1000, 'Radius'),
});

const lineEl = z.strictObject({
  ...base,
  type: z.literal('line'),
  stroke: hexSchema,
  strokeWidth: num(0, 40, 'Stroke width'),
  dash: oneOf(['solid', 'dashed', 'dotted'], 'dash style'),
  startCap: capSchema,
  endCap: capSchema,
});

const fraction = num(0, 1, 'Crop');
const imageEl = z.strictObject({
  ...base,
  type: z.literal('image'),
  source: imageSourceSchema,
  alt: text(LIMITS.altText, 'Alt text'),
  crop: z.strictObject({ x: fraction, y: fraction, w: fraction, h: fraction }),
  flipX: bool('Flip'),
  flipY: bool('Flip'),
  radius: num(0, 1000, 'Radius'),
});

const codeEl = z.strictObject({
  ...base,
  type: z.literal('code'),
  code: text(LIMITS.code, 'Code'),
  language: oneOf(CODE_LANGS, 'language'),
  theme: oneOf(['light', 'dark'], 'code theme'),
  size: num(8, 400, 'Font size'),
});

const videoEl = z.strictObject({
  ...base,
  type: z.literal('video'),
  assetId: int(1, 2147483647, 'Video'),
  loop: bool('Loop'),
});

/** The wireframe's text grid (D43): plain-text cells, every row the same width. */
const tableEl = z.strictObject({
  ...base,
  type: z.literal('table'),
  cells: z
    .array(
      z
        .array(text(LIMITS.tableCell, 'Cell'))
        .min(1, 'Table needs a column')
        .max(LIMITS.tableCols, `Maximum ${LIMITS.tableCols} columns`),
      {
        error: 'Table cells must be a list of rows',
      },
    )
    .min(1, 'Table needs a row')
    .max(LIMITS.tableRows, `Maximum ${LIMITS.tableRows} rows`)
    .refine((rows) => rows.every((r) => r.length === rows[0].length), 'Table rows must have the same number of cells'),
  font: fontSchema,
  size: num(8, 400, 'Font size'),
  color: hexSchema,
  borderColor: hexSchema,
  headerRow: bool('Header row'),
});

const elementSchema = z.discriminatedUnion('type', [textEl, shapeEl, lineEl, imageEl, codeEl, videoEl, tableEl], {
  error: 'Unknown element type',
});

const count = (els: { type: string }[], type: string) => els.filter((e) => e.type === type).length;

/** One slide as sent by the editor. `notes` are the private page notes, which the database keeps apart from the document. */
const slideSchema = z
  .strictObject({
    background: fillSchema,
    elements: z
      .array(elementSchema, { error: 'Elements must be a list' })
      .max(LIMITS.elementsPerSlide, `Maximum ${LIMITS.elementsPerSlide} elements per slide`),
    notes: text(LIMITS.pageNotes, 'Notes').default(''),
  })
  .superRefine((s, ctx) => {
    if (count(s.elements, 'image') > LIMITS.imagesPerSlide) {
      ctx.addIssue({
        code: 'custom',
        path: ['elements'],
        message: `Maximum ${LIMITS.imagesPerSlide} images per slide`,
      });
    }
    if (count(s.elements, 'video') > LIMITS.videosPerSlide) {
      ctx.addIssue({ code: 'custom', path: ['elements'], message: `Maximum ${LIMITS.videosPerSlide} video per slide` });
    }
  });

export const slidesSchema = z
  .array(slideSchema, { error: 'Slides must be a list' })
  .max(LIMITS.slides, `Maximum ${LIMITS.slides} slides`)
  .superRefine((slides, ctx) => {
    const seen = new Set<string>();
    slides.forEach((s, si) =>
      s.elements.forEach((e, ei) => {
        if (seen.has(e.id)) {
          ctx.addIssue({ code: 'custom', path: [si, 'elements', ei, 'id'], message: 'Duplicate element id' });
        }
        seen.add(e.id);
      }),
    );
  });

export const musicSchema = z.strictObject({
  provider: z.literal('jamendo', { error: 'Unknown music provider' }),
  trackId: int(1, Number.MAX_SAFE_INTEGER, 'Track'),
  volume: int(0, 100, 'Volume'),
});

/** A deck with a video cannot carry music (R9): both would play at once. */
export const MUSIC_VIDEO_CONFLICT = 'Remove videos to add music';
export const hasMusicVideoConflict = (d: { music?: unknown; slides: { elements: { type: string }[] }[] }) =>
  Boolean(d.music) && d.slides.some((s) => s.elements.some((e) => e.type === 'video'));

/** The whole deck; the AI assistant's output is validated against the same schema (D33). */
export const deckSchema = z
  .strictObject({
    aspect: aspectSchema,
    theme: themeSchema,
    slides: slidesSchema,
    music: musicSchema.nullable(),
  })
  .superRefine((d, ctx) => {
    if (hasMusicVideoConflict(d)) ctx.addIssue({ code: 'custom', path: ['music'], message: MUSIC_VIDEO_CONFLICT });
  });

/** Where a Jamendo track streams from, derived from its id alone so no stored or user-supplied URL is ever played. */
export const jamendoStreamUrl = (trackId: number) =>
  `https://prod-1.storage.jamendo.com/?trackid=${trackId}&format=mp31`;

export type Fill = z.infer<typeof fillSchema>;
export type ImageSource = z.infer<typeof imageSourceSchema>;
export type SlideElement = z.infer<typeof elementSchema>;
/** One element type, e.g. `El<'text'>`. */
export type El<T extends SlideElement['type']> = Extract<SlideElement, { type: T }>;
export type TextElement = z.infer<typeof textEl>;
export type Slide = z.infer<typeof slideSchema>;
export type MusicRef = z.infer<typeof musicSchema>;
export type Deck = z.infer<typeof deckSchema>;
