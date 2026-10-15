import type { KeysetPage } from '../../lib/keyset';
import { getNotesByIds } from '../feed/repository';
import type { NoteWithEngagement } from '../notes/repository';
import { RANKING } from '../ranking/config';
import { engagement, validation } from '../ranking/service';
import { matchNotes, type NoteFilters } from './repository';

type Key = [score: number, publishedMs: number, id: number];

/** Orders keys ascending by (score, published, id); sorted in reverse for the page order. The score is scaled to an integer so it survives the keyset cursor exactly. */
const compare = (a: Key, b: readonly number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/**
 * One page of matching notes ordered by S = wT·T + wE·E + wV·V (D48): T is ts_rank_cd relative to the best match, E and V are
 * the feed's engagement and lecturer validation. No recency or interest, so every viewer gets the same order. Every match is
 * scored on each page (as the feed scores its candidates) and the keyset cursor is the last note's (score, published, id).
 */
export async function searchNotes(
  viewerId: number, q: string, filters: NoteFilters, { cursor, limit }: KeysetPage,
): Promise<{ items: NoteWithEngagement[]; nextCursor: string | null }> {
  const matches = await matchNotes(viewerId, q, filters);
  const best = matches.reduce((max, m) => Math.max(max, m.textRank), 0);
  const w = RANKING.searchWeights;
  const ranked = matches
    .map((m): Key => {
      const T = best > 0 ? m.textRank / best : 0;
      const S = w.textRank * T + w.engagement * engagement(m.counts.likes, m.counts.comments) + w.lecturerValidation * validation(m);
      return [Math.round(S * 1e12), m.publishedAt.getTime(), m.id];
    })
    .sort((a, b) => compare(b, a));
  const after = cursor?.map(Number);
  const start = after ? ranked.findIndex((k) => compare(k, after) < 0) : 0;
  const page = start < 0 ? [] : ranked.slice(start, start + limit);
  const notes = new Map((page.length ? await getNotesByIds(viewerId, page.map((k) => k[2])) : []).map((n) => [n.id, n]));
  return {
    items: page.flatMap(([, , id]) => notes.get(id) ?? []),
    nextCursor: start >= 0 && ranked.length > start + limit ? page[page.length - 1].join('_') : null,
  };
}
