import type { KeysetPage } from '../../lib/keyset';
import { getCandidates, getInteractionRows } from '../ranking/repository';
import { buildInterestVector, scoreCandidate, type Components } from '../ranking/service';
import type { NoteWithEngagement } from '../notes/repository';
import { GUEST_ID } from '../users/repository';
import { getCutoff, getFollowingNotes, getNotesByIds, readSnapshot, saveSnapshot, type RankedEntry } from './repository';

const PAGE_SIZE = 10;

type FeedItem = NoteWithEngagement & { score: number; components: Components };

/** Scores every candidate at the cutoff and sorts by score, then newest, then id (IR 2.3.4, D24). */
async function rank(viewerId: number, cutoff: Date): Promise<RankedEntry[]> {
  const [candidates, interactions] = await Promise.all([getCandidates(viewerId, cutoff), getInteractionRows(viewerId, cutoff)]);
  const interest = buildInterestVector(interactions, cutoff);
  return candidates
    .map((c) => ({ id: c.id, publishedAt: c.publishedAt, ...scoreCandidate(c, interest, cutoff) }))
    .sort((a, b) => b.score - a.score || b.publishedAt.getTime() - a.publishedAt.getTime() || b.id - a.id)
    .map(({ id, score, components }) => ({ id, score, components }));
}

/**
 * One page of the ranked feed (page is 1-based). `asOf` freezes the candidate set, recency and the engagement that is
 * scored (D24). The ranking is computed once per asOf and stored in "FEED_SNAPSHOT_T"; later pages with that asOf read
 * their slice from it, recomputing only when it is missing (D40). The counts shown on each item are live (D24).
 * A guest (GUEST_ID) sees public notes only, with M = 0 since there is no interest history (R31).
 */
export async function getFeedPage(
  viewerId: number, page: number, asOf: Date | null,
): Promise<{ items: FeedItem[]; nextPage: number | null; asOf: Date }> {
  const cutoff = await getCutoff(asOf);
  const from = (page - 1) * PAGE_SIZE;
  // shortcut: guests are re-ranked on every page because "FEED_SNAPSHOT_T" is keyed by a user id (FK); the ranking at one
  // asOf is the same, but a note hidden between pages shifts later slices by one. Add a guest snapshot keyed by IP if UAT shows it (D45).
  const guest = viewerId === GUEST_ID;
  let stored = asOf && !guest ? await readSnapshot(viewerId, cutoff, from, from + PAGE_SIZE) : undefined;
  if (!stored) {
    const ranked = await rank(viewerId, cutoff);
    if (!guest) await saveSnapshot(viewerId, cutoff, ranked);
    stored = { entries: ranked.slice(from, from + PAGE_SIZE), total: ranked.length };
  }
  const { entries, total } = stored;
  const rows = entries.length === 0 ? [] : await getNotesByIds(viewerId, entries.map((r) => r.id));
  const notes = new Map(rows.map((n) => [n.id, n]));
  const items = entries.flatMap(({ id, score, components }) => {
    const note = notes.get(id); // gone only if hidden or deleted since the ranking was stored
    return note ? [{ ...note, score, components }] : [];
  });
  return { items, nextPage: total > page * PAGE_SIZE ? page + 1 : null, asOf: cutoff };
}

/** One page of the Following feed: chronological, not ranked, so items carry no score; keyset cursor with the same `asOf` cutoff (D38). */
export async function getFollowingPage(
  viewerId: number, keyset: KeysetPage, asOf: Date | null,
): Promise<{ items: NoteWithEngagement[]; nextCursor: string | null; asOf: Date }> {
  const cutoff = await getCutoff(asOf);
  return { ...(await getFollowingNotes(viewerId, cutoff, keyset)), asOf: cutoff };
}
