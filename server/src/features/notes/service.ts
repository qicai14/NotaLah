import {
  aspectSchema,
  hasMusicVideoConflict,
  LIMITS,
  MUSIC_VIDEO_CONFLICT,
  musicSchema,
  slidesSchema,
  themeSchema,
  type Aspect,
  type MusicRef,
  type Slide,
} from '@notalah/shared';
import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { issueMap } from '../../lib/validation';
import { usableAssetKinds } from '../assets/repository';
import type { TrackMeta } from '../music/service';

// Mirrors the TipTap nodes the editor can produce (D20) plus underline and a text colour span. Box-level font, size and
// alignment are typed element props, so colour is the only CSS allowed inside the HTML (R21 spec 2.5).
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h1',
    'h2',
    'h3',
    'strong',
    'em',
    's',
    'u',
    'span',
    'code',
    'pre',
    'ul',
    'ol',
    'li',
    'blockquote',
    'br',
    'hr',
  ],
  allowedAttributes: { ol: ['start'], span: ['style'] }, // TipTap writes start on a continued numbered list
  allowedStyles: { span: { color: [/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i] } },
  transformTags: { b: 'strong', i: 'em', strike: 's', del: 's' },
};

const plainText = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();

/** A slide with nothing to show: a plain colour background and no element, or only text boxes with no text. */
const isBlank = (slide: Pick<Slide, 'background' | 'elements'>) =>
  slide.background.kind === 'color' && slide.elements.every((e) => e.type === 'text' && plainText(e.html) === '');

const textChars = (e: Slide['elements'][number]) =>
  e.type === 'text'
    ? e.html.length
    : e.type === 'code'
      ? e.code.length
      : e.type === 'table'
        ? e.cells.flat().join('').length
        : 0;

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

const baseSchema = z
  .object({
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
  })
  .superRefine((d, ctx) => {
    if (hasMusicVideoConflict(d)) ctx.addIssue({ code: 'custom', path: ['music'], message: MUSIC_VIDEO_CONFLICT });
  });

export interface NoteInput {
  title: string;
  theme: string;
  aspect: Aspect;
  slides: Slide[];
  music: MusicRef | null;
  /** Filled by the route from Jamendo when the track is new to the note; absent means keep what is stored. */
  musicMeta?: TrackMeta;
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

/** Positions of the slides a publish drops as blank (the same rule parseNoteBody applies when saving a publish). */
export const blankPositions = (
  slides: { position: number; background: Slide['background']; elements: Slide['elements'] }[],
) => slides.filter(isBlank).map((s) => s.position);

/** What a saved draft still lacks before it can be published; empty when it can. Same rules and messages as parseNoteBody. */
export function publishErrors(note: {
  hashtags: string[];
  module: unknown;
  slides: Pick<Slide, 'background' | 'elements'>[];
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (note.hashtags.length === 0) errors.hashtags = 'At least one hashtag is required';
  if (note.slides.every(isBlank)) errors.slides = 'At least one slide with content is required';
  if (!note.module) errors.moduleId = 'Module is required to publish';
  return errors;
}

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
  if (!errors.hashtags && tags.length > LIMITS.hashtags) errors.hashtags = `Maximum ${LIMITS.hashtags} hashtags`;
  if (publishing && !errors.hashtags && tags.length === 0) errors.hashtags = 'At least one hashtag is required';

  // Slides: sanitise first, then measure; empty slides are dropped when publishing.
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

interface AssetRef {
  id: number;
  kind: 'image' | 'video';
  /** "Slide 2, element 1" or "Slide 2" for a background, for error messages. */
  where: string;
}

/** Every uploaded asset a deck points at: image elements, video elements and image backgrounds. */
export function assetRefs(slides: Pick<Slide, 'background' | 'elements'>[]): AssetRef[] {
  const refs: AssetRef[] = [];
  slides.forEach((slide, i) => {
    const bg = slide.background;
    if (bg.kind === 'image' && bg.image.kind === 'upload') {
      refs.push({ id: bg.image.assetId, kind: 'image', where: `Slide ${i + 1}` });
    }
    slide.elements.forEach((e, j) => {
      const where = `Slide ${i + 1}, element ${j + 1}`;
      if (e.type === 'image' && e.source.kind === 'upload') refs.push({ id: e.source.assetId, kind: 'image', where });
      if (e.type === 'video') refs.push({ id: e.assetId, kind: 'video', where });
    });
  });
  return refs;
}

/**
 * The first asset the deck cannot use, as a message for `errors.slides`, or null. An asset must be ready, of the kind the
 * element needs, and owned by the saver or already linked to this note (so a co-author's save keeps the owner's images
 * and an owner's save keeps a co-author's, but neither can pull in the other's unrelated uploads).
 */
export async function findBadAsset(slides: Slide[], saverId: number, postId: number | null): Promise<string | null> {
  const refs = assetRefs(slides);
  const kinds = await usableAssetKinds([...new Set(refs.map((r) => r.id))], saverId, postId);
  const bad = refs.find((r) => kinds.get(r.id) !== r.kind);
  return bad ? `${bad.where}: ${bad.kind === 'image' ? 'Image' : 'Video'} not found` : null;
}
