export const SEARCH_TABS = ['top', 'notes', 'people', 'hashtags', 'modules'] as const;
export type SearchTab = (typeof SEARCH_TABS)[number];

export const TAB_LABELS: Record<SearchTab, string> = {
  top: 'Top',
  notes: 'Notes',
  people: 'People',
  hashtags: 'Hashtags',
  modules: 'Modules',
};

const MAX_QUERY = 100;

/** Everything the search screen shows is a function of this, and it lives in the URL (so results can be shared). */
export interface SearchState {
  q: string;
  tab: SearchTab;
  /** 'any' = lecturer content, otherwise one lecturer's user id. */
  lecturer: string | null;
  term: string | null;
  from: string | null;
  to: string | null;
  module: string | null;
}

export const emptySearch: SearchState = {
  q: '',
  tab: 'top',
  lecturer: null,
  term: null,
  from: null,
  to: null,
  module: null,
};

const ID = /^[1-9]\d{0,9}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const id = (v: string | null) => (v && ID.test(v) && Number(v) <= 2147483647 ? v : null);
const date = (v: string | null) => {
  if (!v || !DATE.test(v)) return null;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
};

/** Reads the URL leniently: anything the API would refuse is dropped, and a term wins over a date range (D48). */
export function parseSearch(params: URLSearchParams): SearchState {
  const tab = params.get('tab');
  const lecturer = params.get('lecturer');
  const term = id(params.get('term'));
  return {
    q: (params.get('q') ?? '').slice(0, MAX_QUERY),
    tab: SEARCH_TABS.find((t) => t === tab) ?? 'top',
    lecturer: lecturer === 'any' ? 'any' : id(lecturer),
    term,
    from: term ? null : date(params.get('from')),
    to: term ? null : date(params.get('to')),
    module: id(params.get('module')),
  };
}

/** The URL for a state: defaults and blanks are left out. */
export function toSearchParams(s: SearchState): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string | null) => v && p.set(k, v);
  set('q', s.q.trim() ? s.q : null);
  set('tab', s.tab === 'top' ? null : s.tab);
  set('lecturer', s.lecturer);
  set('term', s.term);
  set('from', s.from);
  set('to', s.to);
  set('module', s.module);
  return p;
}

export const searchHref = (s: Partial<SearchState>) => {
  const qs = toSearchParams({ ...emptySearch, ...s }).toString();
  return qs ? `/search?${qs}` : '/search';
};

/** Only the Top and Notes tabs apply the note filters; people, hashtags and modules ignore them (D48). */
export const filtersApply = (tab: SearchTab) => tab === 'top' || tab === 'notes';

export function activeFilterCount(s: SearchState): number {
  if (!filtersApply(s.tab)) return 0;
  return [s.lecturer, s.term, s.from || s.to, s.module].filter(Boolean).length;
}

/** Setting a term clears the dates and setting a date clears the term, since the API refuses both together. */
export function withFilters(s: SearchState, patch: Partial<SearchState>): SearchState {
  const next = { ...s, ...patch };
  if (patch.term) return { ...next, from: null, to: null };
  if (patch.from || patch.to) return { ...next, term: null };
  return next;
}

export const dateRangeError = (s: Pick<SearchState, 'from' | 'to'>): string | null =>
  s.from && s.to && s.from > s.to ? 'The start date must be on or before the end date.' : null;

/** Page request for the API, or null while the query is blank. `asOf` and `cursor` come from earlier pages. */
export function searchApiPath(
  s: SearchState,
  page: { cursor?: string | null; asOf?: string | null } = {},
): string | null {
  const q = s.q.trim();
  if (!q) return null;
  const p = new URLSearchParams({ q, tab: s.tab });
  if (filtersApply(s.tab)) {
    const set = (k: string, v: string | null) => v && p.set(k, v);
    set('lecturer', s.lecturer);
    set('term', s.term);
    set('from', s.from);
    set('to', s.to);
    set('module', s.module);
  }
  if (page.cursor) p.set('cursor', page.cursor);
  if (page.asOf) p.set('asOf', page.asOf);
  return `/search?${p.toString()}`;
}
