import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from '@/lib/api';
import { type SearchState, searchApiPath } from './searchParams';

export interface PersonResult {
  id: number;
  displayName: string;
  role: string;
  programme: string | null;
  avatarUrl: string | null;
  isVerifiedLecturer: boolean;
}
export interface HashtagResult {
  id: number;
  name: string;
  noteCount: number;
}
export interface ModuleResult {
  id: number;
  code: string;
  name: string;
  programme: string;
  noteCount: number;
}

interface Page {
  items: { id: number }[];
  nextCursor: string | null;
  asOf?: string;
  people?: PersonResult[];
  hashtags?: HashtagResult[];
  modules?: ModuleResult[];
}

export interface Results {
  key: string;
  items: { id: number }[];
  extras: Pick<Page, 'people' | 'hashtags' | 'modules'>;
  next: string | null;
  asOf: string | null;
  error: string | null;
  loading: boolean;
  loaded: boolean;
}

/**
 * Keyset-paged results for one query. A new query or filter starts from page 1 and drops any answer still in flight
 * for the old one; "load more" sends the cursor and the `asOf` that page 1 returned, so ranked notes neither skip
 * nor repeat (D48).
 */
export function useSearchResults(state: SearchState) {
  const key = searchApiPath(state);
  const [res, setRes] = useState<Results | null>(null);
  const live = useRef<string | null>(null);
  const busy = useRef(false);
  const latest = useRef<Results | null>(null);
  const stateRef = useRef(state);
  latest.current = res;
  stateRef.current = state;

  const fetchPage = useCallback(async (k: string, cursor: string | null, asOf: string | null) => {
    busy.current = true;
    setRes((r) => (r && r.key === k ? { ...r, loading: true, error: null } : r));
    try {
      const page = await api<Page>(searchApiPath(stateRef.current, { cursor, asOf })!);
      if (live.current !== k) return;
      setRes((r) => {
        const prev = r && r.key === k ? r : null;
        const seen = new Set(prev?.items.map((i) => i.id));
        return {
          key: k,
          items: [...(prev?.items ?? []), ...page.items.filter((i) => !seen.has(i.id))],
          extras: prev?.loaded ? prev.extras : { people: page.people, hashtags: page.hashtags, modules: page.modules },
          next: page.nextCursor,
          asOf: prev?.asOf ?? page.asOf ?? null,
          error: null,
          loading: false,
          loaded: true,
        };
      });
    } catch (e) {
      if (live.current !== k) return;
      setRes((r) => (r && r.key === k ? { ...r, loading: false, error: errorText(e) } : r));
    } finally {
      if (live.current === k) busy.current = false;
    }
  }, []);

  useEffect(() => {
    live.current = key;
    busy.current = false;
    if (key === null) return setRes(null);
    setRes({ key, items: [], extras: {}, next: null, asOf: null, error: null, loading: true, loaded: false });
    void fetchPage(key, null, null);
  }, [key, fetchPage]);

  const loadMore = useCallback(() => {
    const r = latest.current;
    if (!r || busy.current || r.next === null || r.key !== live.current) return;
    void fetchPage(r.key, r.next, r.asOf);
  }, [fetchPage]);

  const retry = useCallback(() => {
    const r = latest.current;
    if (!r || busy.current) return;
    void fetchPage(r.key, r.loaded ? r.next : null, r.asOf);
  }, [fetchPage]);

  return { results: res && res.key === key ? res : null, loadMore, retry };
}
