import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, viewerId } from '../auth/middleware';
import { parseKeyset } from '../../lib/keyset';
import { invalidId } from '../../lib/validation';
import { getTerm } from '../modules/repository';
import { searchHashtags, searchModules, searchPeople } from './repository';
import { searchNotes } from './service';

export const searchRouter = Router();

const PAGE_SIZE = 20;
/** Results per section in the Top tab, which pages its notes only. */
const TOP_SECTION_SIZE = 3;

const id = (message: string) => z.string({ error: message }).refine((s) => !invalidId(s), message).transform(Number);

const searchSchema = z
  .object({
    q: z.string({ error: 'Query is required' }).trim().min(1, 'Query is required').max(100, 'Query too long'),
    tab: z.enum(['top', 'notes', 'people', 'hashtags', 'modules'], { error: 'Invalid tab' }).default('top'),
    lecturer: z.union([z.literal('any'), id('Invalid lecturer')], { error: 'Invalid lecturer' }).optional(),
    term: id('Invalid term').optional(),
    module: id('Invalid module').optional(),
    from: z.iso.date({ error: 'Invalid date' }).optional(),
    to: z.iso.date({ error: 'Invalid date' }).optional(),
    asOf: z.iso.datetime({ offset: true, error: 'Invalid asOf' }).optional(),
  })
  .refine((s) => s.term === undefined || (s.from === undefined && s.to === undefined), 'Choose a term or a date range, not both')
  .refine((s) => !s.from || !s.to || s.from <= s.to, 'Invalid date range');

// FR4, FR5, FR12, FR15 (D48). Guests search public notes, rate-limited by IP (D44).
searchRouter.get('/', optionalAuth, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const s = parsed.data;
  const keyset = parseKeyset(req, res, s.tab === 'top' || s.tab === 'notes' ? 3 : 2, PAGE_SIZE);
  if (!keyset) return;
  const termDates = s.term === undefined ? undefined : await getTerm(s.term);
  if (s.term !== undefined && !termDates) return res.status(400).json({ error: 'Term not found' });

  const viewer = viewerId(req);
  // People, hashtags and modules ignore a leading # or @ and the note filters.
  const text = s.q.replace(/^[#@]+/, '');
  const empty = { items: [], nextCursor: null };
  if (s.tab === 'people') return res.json(text ? await searchPeople(viewer, text, keyset) : empty);
  if (s.tab === 'hashtags') return res.json(text ? await searchHashtags(viewer, text, keyset) : empty);
  if (s.tab === 'modules') return res.json(text ? await searchModules(viewer, text, keyset) : empty);

  const filters = {
    lecturer: s.lecturer ?? null,
    from: termDates?.startDate ?? s.from ?? null,
    to: termDates?.endDate ?? s.to ?? null,
    moduleId: s.module ?? null,
  };
  const notes = await searchNotes(viewer, s.q, filters, keyset, s.asOf ? new Date(s.asOf) : null);
  if (s.tab === 'notes' || keyset.cursor) return res.json(notes);
  const first = { cursor: null, limit: TOP_SECTION_SIZE };
  const [people, hashtags, modules] = text
    ? await Promise.all([searchPeople(viewer, text, first), searchHashtags(viewer, text, first), searchModules(viewer, text, first)])
    : [empty, empty, empty];
  res.json({ ...notes, people: people.items, hashtags: hashtags.items, modules: modules.items });
});
