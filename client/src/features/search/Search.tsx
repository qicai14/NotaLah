import { PageMessage } from '@/components/PageMessage';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { inputClass } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useFetch } from '@/lib/useFetch';
import { cn } from '@/lib/utils';
import type { ModuleRef, Note } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { FilterSheet, type TermOption } from './FilterSheet';
import {
  activeFilterCount,
  filtersApply,
  parseSearch,
  searchHref,
  SEARCH_TABS,
  type SearchState,
  type SearchTab,
  TAB_LABELS,
  toSearchParams,
  withFilters,
} from './searchParams';
import { HashtagRow, ModuleRow, NoteResult, PersonRow, Section } from './SearchResults';
import { type HashtagResult, type ModuleResult, type PersonResult, useSearchResults } from './useSearchResults';

const DEBOUNCE_MS = 300;

function Tabs({ tab, onChange }: { tab: SearchTab; onChange(tab: SearchTab): void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (e: KeyboardEvent, i: number) => {
    const to =
      e.key === 'ArrowRight'
        ? i + 1
        : e.key === 'ArrowLeft'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? -1
              : null;
    if (to === null) return;
    e.preventDefault();
    const next = SEARCH_TABS[(to + SEARCH_TABS.length) % SEARCH_TABS.length]!;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label="Result type"
      className="scrollbar-none -mx-4 flex border-b gap-1 overflow-x-auto px-4 md:mx-0 md:px-0"
    >
      {SEARCH_TABS.map((t, i) => (
        <button
          key={t}
          ref={(el) => {
            refs.current[t] = el;
          }}
          id={`search-tab-${t}`}
          role="tab"
          type="button"
          aria-selected={tab === t}
          aria-controls="search-panel"
          tabIndex={tab === t ? 0 : -1}
          onClick={() => onChange(t)}
          onKeyDown={(e) => move(e, i)}
          className={cn(
            'relative h-11 shrink-0 rounded-sm px-2.5 text-body-sm font-bold md:px-3.5 md:text-body transition-colors duration-(--duration-fast)',
            tab === t
              ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:bg-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {TAB_LABELS[t]}
        </button>
      ))}
    </div>
  );
}

function Chip({ children, onRemove, name }: { children: string; onRemove(): void; name: string }) {
  return (
    <li className="inline-flex h-8 items-center gap-1 rounded-full bg-surface-strong pl-3 text-body-sm font-semibold">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${name}`}
        className="mr-1 relative grid size-6 place-items-center rounded-full hover:bg-accent after:absolute after:-inset-2 after:content-['']"
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-60 animate-pulse rounded-xl bg-surface" />
      ))}
    </div>
  );
}

/** Search (UC10, wireframes 07, 37, 38, 39): query, result tabs, filters, all kept in the URL. Open to guests (D44). */
export default function Search() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => parseSearch(params), [params]);
  const [text, setText] = useState(state.q);
  const debounced = useDebouncedValue(text, DEBOUNCE_MS);
  const pushed = useRef(state.q);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const go = (next: SearchState, replace = false) => setParams(toSearchParams(next), { replace });

  // Typing updates the URL after a pause (replacing the history entry, so Back skips the keystrokes)...
  useEffect(() => {
    if (debounced === stateRef.current.q) return;
    pushed.current = debounced;
    setParams(toSearchParams({ ...stateRef.current, q: debounced }), { replace: true });
  }, [debounced, setParams]);
  // ...and a query that arrives by link or Back button is shown in the box.
  useEffect(() => {
    if (state.q !== pushed.current) {
      pushed.current = state.q;
      setText(state.q);
    }
  }, [state.q]);

  const terms = useFetch<{ terms: TermOption[] }>('/terms');
  const modules = useFetch<{ modules: ModuleRef[] }>(user ? '/modules' : null);
  const { results, loadMore, retry } = useSearchResults(state);

  const blank = !state.q.trim();
  const filterCount = activeFilterCount(state);
  const termName = terms.data?.terms.find((t) => String(t.id) === state.term)?.name;
  const moduleRef = modules.data?.modules.find((m) => String(m.id) === state.module);
  const chips: [string, string, Partial<SearchState>][] = [];
  if (filtersApply(state.tab)) {
    if (state.lecturer === 'any') chips.push(['Lecturer content', 'lecturer content only', { lecturer: null }]);
    else if (state.lecturer) chips.push(['One lecturer', 'one lecturer', { lecturer: null }]);
    if (state.term) chips.push([termName ?? 'Term', 'academic term', { term: null }]);
    if (state.from || state.to)
      chips.push([`${state.from ?? 'Any'} to ${state.to ?? 'today'}`, 'date range', { from: null, to: null }]);
    if (state.module) chips.push([moduleRef?.code ?? 'One module', 'module', { module: null }]);
  }

  const submit = () => {
    pushed.current = text;
    go({ ...state, q: text });
  };
  const setTab = (tab: SearchTab) => go({ ...state, tab }, true);
  const items = results?.items ?? [];
  const extras = results?.extras ?? {};

  const topSections =
    state.tab === 'top' && results?.loaded
      ? ([
          ['People', extras.people ?? [], 'people'],
          ['Hashtags', extras.hashtags ?? [], 'hashtags'],
          ['Modules', extras.modules ?? [], 'modules'],
        ] as const)
      : [];
  const nothing =
    !!results?.loaded &&
    items.length === 0 &&
    (state.tab !== 'top' || topSections.every(([, rows]) => rows.length === 0));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">Search</h1>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
      >
        <label htmlFor="search-q" className="sr-only">
          Search notes, people, hashtags and modules
        </label>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={input}
          id="search-q"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={100}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search notes, people, #hashtags, modules"
          className={cn(inputClass, 'rounded-full pr-12 pl-12 [&::-webkit-search-cancel-button]:hidden')}
        />
        {text && (
          <button
            type="button"
            onClick={() => {
              setText('');
              input.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </form>

      <Tabs tab={state.tab} onChange={setTab} />

      {filtersApply(state.tab) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setFiltersOpen(true)}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal aria-hidden="true" />
            Filters
            {filterCount > 0 && (
              <span className="grid size-5 place-items-center rounded-full bg-foreground text-caption text-background tabular-nums">
                {filterCount}
                <span className="sr-only"> active</span>
              </span>
            )}
          </Button>
          {chips.length > 0 && (
            <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
              {chips.map(([label, name, patch]) => (
                <Chip key={name} name={name} onRemove={() => go(withFilters(state, patch))}>
                  {label}
                </Chip>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        id="search-panel"
        role="tabpanel"
        aria-labelledby={`search-tab-${state.tab}`}
        aria-busy={results?.loading ?? false}
        className="flex flex-col gap-6"
      >
        <p role="status" className="sr-only">
          {results?.loading && !results.loaded ? 'Searching' : results?.loaded ? `${items.length} results shown` : ''}
        </p>

        {blank && (
          <PageMessage
            title="Find notes, people and modules"
            body="Type a subject, module code, lecturer name or #hashtag. Quote a phrase to match it exactly."
          />
        )}

        {results && !results.loaded && results.loading && <Skeleton />}

        {results?.error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
          >
            {results.error}{' '}
            {results.status === 400 && filterCount > 0 ? (
              <button
                type="button"
                onClick={() => go({ ...state, lecturer: null, term: null, from: null, to: null, module: null })}
                className="font-semibold underline underline-offset-2"
              >
                Clear filters
              </button>
            ) : (
              <button type="button" onClick={retry} className="font-semibold underline underline-offset-2">
                Try again
              </button>
            )}
          </div>
        )}

        {nothing && (
          <PageMessage
            title={`No results for "${state.q.trim()}"`}
            body={
              filterCount > 0
                ? 'Try removing a filter, or check the spelling.'
                : 'Check the spelling, or try a module code or a shorter word.'
            }
            action={
              filterCount > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => go({ ...state, lecturer: null, term: null, from: null, to: null, module: null })}
                >
                  Clear filters
                </Button>
              ) : state.tab !== 'top' ? (
                <Button asChild variant="secondary">
                  <Link to={searchHref({ ...state, tab: 'top' })}>Search everything</Link>
                </Button>
              ) : undefined
            }
          />
        )}

        {topSections.map(([title, rows, tab]) =>
          rows.length === 0 ? null : (
            <Section key={title} title={title} onSeeAll={() => setTab(tab)}>
              <Rows tab={tab} items={rows} onLecturer={lecturerNotes} />
            </Section>
          ),
        )}

        {items.length > 0 &&
          (state.tab === 'top' ? (
            <Section title="Notes">
              <Rows tab="notes" items={items} onLecturer={lecturerNotes} />
            </Section>
          ) : (
            <Rows tab={state.tab} items={items} onLecturer={lecturerNotes} />
          ))}

        {results?.loaded && results.next !== null && (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" size="lg" onClick={loadMore} disabled={results.loading}>
              {results.loading ? 'Loading…' : 'Load more'}
            </Button>
          </div>
        )}
        {results?.loaded && results.next === null && items.length > 0 && (
          <p className="text-center text-body-sm text-muted-foreground">That is everything for this search.</p>
        )}
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        state={state}
        terms={terms.data?.terms ?? []}
        modules={user ? (modules.data?.modules ?? []) : null}
        onApply={(next) => {
          go(next);
          setFiltersOpen(false);
        }}
      />
    </div>
  );

  function lecturerNotes(id: string) {
    go({ ...state, tab: 'notes', lecturer: id });
  }
}

function Rows({ tab, items, onLecturer }: { tab: SearchTab; items: { id: number }[]; onLecturer(id: string): void }) {
  if (tab === 'notes' || tab === 'top')
    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {(items as Note[]).map((n) => (
          <NoteResult key={n.id} note={n} />
        ))}
      </ul>
    );
  return (
    <ul className="flex flex-col gap-2">
      {tab === 'people' &&
        (items as PersonResult[]).map((p) => <PersonRow key={p.id} person={p} onLecturer={onLecturer} />)}
      {tab === 'hashtags' && (items as HashtagResult[]).map((h) => <HashtagRow key={h.id} tag={h} />)}
      {tab === 'modules' && (items as ModuleResult[]).map((m) => <ModuleRow key={m.id} module={m} />)}
    </ul>
  );
}
