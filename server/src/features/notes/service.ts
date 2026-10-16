import { aspectSchema, LIMITS, musicSchema, slidesSchema, themeSchema, type Aspect, type MusicRef, type Slide } from '@parp/shared';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { issueMap } from '../../lib/validation';

export const MAX_SLIDES = LIMITS.slides;
export const MAX_HASHTAGS = LIMITS.hashtags;

// Mirrors the TipTap nodes the editor can produce (D20) plus underline and a text colour span. Box-level font, size and
// alignment are typed element props, so colour is the only CSS allowed inside the HTML (R21 spec 2.5).
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 's', 'u', 'span', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'br', 'hr'],
  allowedAttributes: { ol: ['start'], span: ['style'] }, // TipTap writes start on a continued numbered list
  allowedStyles: { span: { color: [/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i] } },
  transformTags: { b: 'strong', i: 'em', strike: 's', del: 's' },
};

const plainText = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();

/** A slide with nothing to show: no element, or only text boxes with no text. */
const isBlank = (slide: Slide) => slide.elements.every((e) => e.type === 'text' && plainText(e.html) === '');

const textChars = (e: Slide['elements'][number]) =>
  e.type === 'text' ? e.html.length : e.type === 'code' ? e.code.length : e.type === 'table' ? e.cells.flat().join('').length : 0;

/**
 * Sanitises a slide's text and measures it afterwards (limits apply to what is stored, R21 spec 1.4). Problems are added
 * to `errors.slides` as "Slide 3, element 2: ..." (first one wins).
 */
function cleanSlide(slide: Slide, errors: Record<string, string>, n: number): Slide {
  const elements = slide.elements.map((e, j) => {
    if (e.type !== 'text') return e;
    const html = sanitizeHtml(e.html, OPTIONS);
    if (html.length > LIMITS.textHtml) errors.slides ??= `Slide ${n}, element ${j + 1}: Text is too long`;
    return { ...e, html };
  });
  const clean = { ...slide, elements };
  if (elements.reduce((sum, e) => sum + textChars(e), 0) > LIMITS.textPerSlide) {
    errors.slides ??= `Slide ${n}: Text must be at most ${LIMITS.textPerSlide.toLocaleString('en-US')} characters`;
  }
  if (Buffer.byteLength(JSON.stringify(clean)) > LIMITS.slideBytes) errors.slides ??= `Slide ${n}: Slide is too large`;
  return clean;
}

const baseSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(150, 'Title must be at most 150 characters'),
  theme: themeSchema.default('plain'),
  aspect: aspectSchema.default('4:5'),
  slides: slidesSchema.default([]),
  music: musicSchema.nullish(),
  moduleId: z.number({ error: 'Invalid module' }).int('Invalid module').positive('Invalid module').nullish(),
  status: z.enum(['draft', 'published'], { error: 'Status must be draft or published' }),
  visibility: z.enum(['public', 'contacts'], { error: 'Visibility must be public or contacts' }).nullish(),
});

export interface NoteInput {
  title: string;
  theme: string;
  aspect: Aspect;
  slides: Slide[];
  music: MusicRef | null;
  moduleId: number | null;
  hashtags: string[];
  status: 'draft' | 'published';
  visibility: 'public' | 'contacts' | null;
}

const baseUpdatedAtSchema = z.iso.datetime({ offset: true, error: 'Invalid baseUpdatedAt' });

/**
 * The `updatedAt` the editor loaded, for the optimistic 409 check (R30). Required from co-authors; optional for the
 * owner, whose existing editor does not send it yet, so a missing value skips the check (D46).
 */
export function parseBaseUpdatedAt(
  body: unknown,
  required: boolean,
): { ok: true; data: Date | null } | { ok: false; errors: Record<string, string> } {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).baseUpdatedAt : undefined;
  if (raw === undefined || raw === null) {
    return required ? { ok: false, errors: { baseUpdatedAt: 'baseUpdatedAt is required' } } : { ok: true, data: null };
  }
  const parsed = baseUpdatedAtSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, data: new Date(parsed.data) }
    : { ok: false, errors: { baseUpdatedAt: 'Invalid baseUpdatedAt' } };
}

type Parsed = { ok: true; data: NoteInput } | { ok: false; errors: Record<string, string> };

/** Validates and sanitises a create/replace body. Module existence is checked by the route. */
export function parseNoteBody(body: unknown): Parsed {
  const obj: Record<string, unknown> = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const parsed = baseSchema.safeParse(obj);
  const errors = parsed.success ? {} : issueMap(parsed.error.issues);
  const d = parsed.success ? parsed.data : undefined;
  const publishing = obj.status === 'published';

  const tags: string[] = [];
  if (obj.hashtags !== undefined && !Array.isArray(obj.hashtags)) errors.hashtags = 'Hashtags must be a list';
  for (const raw of Array.isArray(obj.hashtags) ? obj.hashtags : []) {
    const name = typeof raw === 'string' ? raw.trim().replace(/^#/, '').toLowerCase() : '';
    if (!/^[a-z0-9_]{1,50}$/.test(name)) {
      errors.hashtags ??= `Invalid hashtag: ${typeof raw === 'string' ? raw : String(raw)}`;
    } else if (!tags.includes(name)) tags.push(name);
  }
  if (!errors.hashtags && tags.length > MAX_HASHTAGS) errors.hashtags = `Maximum ${MAX_HASHTAGS} hashtags`;
  if (publishing && !errors.hashtags && tags.length === 0) errors.hashtags = 'At least one hashtag is required';

  // Slides: sanitise first, then measure; empty slides are dropped when publishing.
  // shortcut: image and video asset ids are not checked against ASSET_T (owner, ready, kind), which arrives with R22.
  let slides = (d?.slides ?? []).map((slide, i) => cleanSlide(slide, errors, i + 1));
  if (publishing) {
    slides = slides.filter((s) => !isBlank(s));
    if (slides.length === 0) errors.slides ??= 'At least one slide with content is required';
    if (!obj.moduleId) errors.moduleId ??= 'Module is required to publish';
    if (!obj.visibility) errors.visibility ??= 'Visibility is required to publish';
  }

  if (!d || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title: d.title,
      theme: d.theme,
      aspect: d.aspect,
      slides,
      music: d.music ?? null,
      moduleId: d.moduleId ?? null,
      hashtags: tags,
      status: d.status,
      visibility: d.visibility ?? null,
    },
  };
}
