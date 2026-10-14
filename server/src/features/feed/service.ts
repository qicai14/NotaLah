import { getCandidates, getInteractionRows } from '../ranking/repository';
import { buildInterestVector, scoreCandidate, type Components } from '../ranking/service';
import type { NoteWithEngagement } from '../notes/repository';
import { getCutoff, getNotesByIds } from './repository';

const PAGE_SIZE = 10;

type FeedItem = NoteWithEngagement & { score: number; components: Components };

/**
 * One page of the ranked feed (page is 1-based). Candidates are scored in the app and sorted by score, then
 * newest, then id (IR 2.3.4, D24). `asOf` freezes the candidate set, recency and the engagement that is scored, so
 * pages stay stable; the counts shown on each item are live (D24).
 */
export async function getFeedPage(
  viewerId: number, page: number, asOf: Date | null,
): Promise<{ items: FeedItem[]; nextPage: number | null; asOf: Date }> {
  const cutoff = await getCutoff(asOf);
  const [candidates, interactions] = await Promise.all([getCandidates(viewerId, cutoff), getInteractionRows(viewerId, cutoff)]);
  const interest = buildInterestVector(interactions, cutoff);
  const ranked = candidates
    .map((c) => ({ id: c.id, publishedAt: c.publishedAt, ...scoreCandidate(c, interest, cutoff) }))
    .sort((a, b) => b.score - a.score || b.publishedAt.getTime() - a.publishedAt.getTime() || b.id - a.id);
  const slice = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rows = slice.length === 0 ? [] : await getNotesByIds(viewerId, slice.map((r) => r.id));
  const notes = new Map(rows.map((n) => [n.id, n]));
  const items = slice.flatMap(({ id, score, components }) => {
    const note = notes.get(id); // gone only if hidden or deleted since the candidate query
    return note ? [{ ...note, score, components }] : [];
  });
  return { items, nextPage: ranked.length > page * PAGE_SIZE ? page + 1 : null, asOf: cutoff };
}
