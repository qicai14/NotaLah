import { z } from 'zod';
import { CODE_LANGS, LIMITS, OUTLINE_LIMITS as L } from './limits.js';

const line = (max: number, what: string) =>
  z
    .string({ error: `${what} must be text` })
    .trim()
    .min(1, `${what} is required`)
    .max(max, `${what} must be at most ${max} characters`);
const title = line(L.title, 'Title');
const bullets = (max: number) =>
  z.array(line(L.bullet, 'Bullet'), { error: 'Bullets must be a list' }).min(1, 'Add at least one bullet').max(max);
const column = z.strictObject({ heading: line(L.columnHeading, 'Column heading'), bullets: bullets(L.columnBullets) });

/** One outline Slide: the model picks a layout and fills its text; the client turns it into a Slide with layoutSlide. */
export const outlineSlideSchema = z.discriminatedUnion(
  'layout',
  [
    z.strictObject({
      layout: z.literal('title'),
      title: line(L.coverTitle, 'Title'),
      subtitle: line(L.subtitle, 'Subtitle').optional(),
    }),
    z.strictObject({ layout: z.literal('title-body'), title, bullets: bullets(L.bullets) }),
    z.strictObject({ layout: z.literal('two-column'), title, left: column, right: column }),
    z.strictObject({
      layout: z.literal('code'),
      title,
      language: z.enum(CODE_LANGS).default('plaintext'),
      code: z
        .string({ error: 'Code must be text' })
        .min(1, 'Code is required')
        .max(L.code, `Code must be at most ${L.code} characters`)
        .refine((c) => c.trimEnd().split('\n').length <= L.codeLines, `Code must be at most ${L.codeLines} lines`)
        .refine(
          (c) => c.split('\n').every((l) => l.length <= L.codeLineLength),
          `Code lines must be at most ${L.codeLineLength} characters`,
        ),
    }),
  ],
  { error: 'Unknown layout' },
);

/** The assistant's whole reply. More than 15 Slides is cut to 15, not rejected. */
export const outlineSchema = z.strictObject({
  slides: z.preprocess(
    (v) => (Array.isArray(v) ? v.slice(0, L.slides) : v),
    z.array(outlineSlideSchema, { error: 'Slides must be a list' }).min(1, 'Add at least one slide'),
  ),
});
export type Outline = z.infer<typeof outlineSchema>;
export type OutlineSlide = z.infer<typeof outlineSlideSchema>;

export const outlineRoom = (current: number) => Math.max(0, Math.min(L.slides, LIMITS.slides - current));

/** Validate a reply and cut it to the room left on the Note; `slides` is empty when the Note is full. */
export function parseOutline(raw: unknown, currentSlides: number) {
  const r = outlineSchema.safeParse(raw);
  if (!r.success) return r;
  return { ...r, data: { slides: r.data.slides.slice(0, outlineRoom(currentSlides)) } };
}
