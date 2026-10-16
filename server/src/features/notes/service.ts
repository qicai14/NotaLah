import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';
import { issueMap } from '../../lib/validation';

export const MAX_SLIDES = 30;
const MAX_SLIDE_CHARS = 20_000;
export const MAX_HASHTAGS = 5;

// Mirrors the TipTap StarterKit nodes the editor can produce (D20); every attribute is dropped.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 's', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'br', 'hr'],
  allowedAttributes: { ol: ['start'] }, // TipTap writes start on a continued numbered list
  transformTags: { b: 'strong', i: 'em', strike: 's', del: 's' },
};

const sanitizeSlide = (html: string) => sanitizeHtml(html, OPTIONS);

const plainText = (html: string) => sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();

const baseSchema = z.object({
  title: z
    .string({ error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(150, 'Title must be at most 150 characters'),
  template: z.enum(['plain', 'lecture', 'revision', 'howto'], { error: 'Invalid template' }).optional(),
  slides: z
    .array(z.string({ error: 'Each slide must be text' }), { error: 'Slides must be a list' })
    .max(MAX_SLIDES, `Maximum ${MAX_SLIDES} slides`)
    .default([]),
  moduleId: z.number({ error: 'Invalid module' }).int('Invalid module').positive('Invalid module').nullish(),
  status: z.enum(['draft', 'published'], { error: 'Status must be draft or published' }),
  visibility: z.enum(['public', 'contacts'], { error: 'Visibility must be public or contacts' }).nullish(),
});

export interface NoteInput {
  title: string;
  template: string;
  slides: string[];
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
  let slides = (d?.slides ?? []).map(sanitizeSlide);
  if (slides.some((s) => s.length > MAX_SLIDE_CHARS)) {
    errors.slides ??= `Each slide must be at most ${MAX_SLIDE_CHARS} characters`;
  }
  if (publishing) {
    slides = slides.filter((s) => plainText(s) !== '');
    if (slides.length === 0) errors.slides ??= 'At least one slide with content is required';
    if (!obj.moduleId) errors.moduleId ??= 'Module is required to publish';
    if (!obj.visibility) errors.visibility ??= 'Visibility is required to publish';
  }

  if (!d || Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      title: d.title,
      template: d.template ?? 'plain',
      slides,
      moduleId: d.moduleId ?? null,
      hashtags: tags,
      status: d.status,
      visibility: d.visibility ?? null,
    },
  };
}
