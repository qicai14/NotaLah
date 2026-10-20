import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MoreMenu } from '@/components/shell/MoreMenu';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { api, errorText } from '../../lib/api';
import type { FeedNote, FeedPage, FollowingPage, Note, RankingWeights } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { CommentPanel } from '../notes/CommentPanel';
import { NoteCard } from './NoteCard';

type Tab = 'feed' | 'following';

/**
 * Pages of one tab. Feed is ranked and paged by number with a frozen asOf (D24); Following is chronological with a
 * keyset cursor (D38). Items already shown are never repeated.
 */
function usePagedFeed(tab: Tab) {
  const [items, setItems] = useState<FeedNote[]>([]);
  const [next, setNext] = useState<string | null>('1'); // page number or cursor to fetch; null = finished
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [weights, setWeights] = useState<RankingWeights | null>(null);
  const asOf = useRef<string | null>(null);
  const busy = useRef(false);
  const first = useRef(true);

  const loadMore = useCallback(async () => {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const q = asOf.current ? `&asOf=${encodeURIComponent(asOf.current)}` : '';
      let page: { items: FeedNote[]; asOf: string };
      let after: string | null;
      if (tab === 'feed') {
        const p = await api<FeedPage>(`/feed?page=${next}${q}`);
        page = p;
        setWeights((w) => w ?? p.weights);
        after = p.nextPage === null ? null : String(p.nextPage);
      } else {
        const cursor = first.current ? '' : `&cursor=${encodeURIComponent(next)}`;
        const p = await api<FollowingPage>(`/feed?tab=following&limit=10${cursor}${q}`);
        page = p;
        after = p.nextCursor;
      }
      first.current = false;
      asOf.current ??= page.asOf;
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.id));
        return [...cur, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setNext(after);
      setLoadedOnce(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [next, tab]);

  return { items, next, loading, error, loadedOnce, loadMore, weights };
}

function FeedTabs({ tab, guest }: { tab: Tab; guest: boolean }) {
  const tabs: [Tab, string, string][] = guest
    ? [['feed', 'Feed', '/']]
    : [
        ['feed', 'Feed', '/'],
        ['following', 'Following', '/?tab=following'],
      ];
  return (
    <nav aria-label="Feed tabs" className="flex items-center gap-6">
      {tabs.map(([key, label, to]) => (
        <Link
          key={key}
          to={to}
          aria-current={tab === key ? 'page' : undefined}
          className={cn(
            'relative py-2 text-title-sm font-bold transition-colors duration-(--duration-fast)',
            tab === key
              ? 'text-foreground after:absolute after:inset-x-1/4 after:bottom-0 after:h-[3px] after:rounded-full after:bg-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

function EmptyState({ tab, guest }: { tab: Tab; guest: boolean }) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="max-w-sm">
        <p className="text-title font-bold">
          {tab === 'following' ? 'Nothing from people you follow yet' : 'No notes in your feed yet'}
        </p>
        <p className="mt-2 text-body text-muted-foreground">
          {tab === 'following'
            ? 'Notes from people you follow appear here, newest first.'
            : guest
              ? 'Public notes appear here as students share them.'
              : 'Share what you know: a note you post can reach everyone taking the module.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {tab === 'following' ? (
            <Button asChild variant="secondary">
              <Link to="/">Back to Feed</Link>
            </Button>
          ) : (
            !guest && (
              <Button asChild>
                <Link to="/notes/new">Create a note</Link>
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function FeedList({ tab, guest }: { tab: Tab; guest: boolean }) {
  const { items, next, loading, error, loadedOnce, loadMore, weights } = usePagedFeed(tab);
  const scroller = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [commentsFor, setCommentsFor] = useState<Note | null>(null);
  const desktop = useMediaQuery(DESKTOP);
  const openComments = useCallback((n: Note) => setCommentsFor(n), []);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || error || next === null) return;
    if (typeof IntersectionObserver === 'undefined') return void loadMore();
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore, error, next, items.length]);

  const step = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ top: dir * el.clientHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  return (
    <>
      <div
        ref={scroller}
        className={cn(
          'h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scrollbar-none',
          !guest && 'max-md:h-[calc(100%-var(--spacing-tabbar)-env(safe-area-inset-bottom))]',
        )}
      >
        {loadedOnce && items.length === 0 && <EmptyState tab={tab} guest={guest} />}
        {!loadedOnce && loading && (
          <div className="flex h-full items-end justify-center gap-5 px-3 pt-topbar pb-6" aria-hidden="true">
            <div className="h-full flex-1 animate-pulse rounded-2xl bg-surface md:aspect-[9/16] md:max-w-[34rem] md:flex-none" />
          </div>
        )}
        {items.map((i) => (
          <NoteCard key={i.id} item={i} guest={guest} weights={weights} onOpenComments={openComments} />
        ))}
        {(error || (loading && loadedOnce) || (next === null && items.length > 0)) && (
          <div className="flex snap-end flex-col items-center gap-2 px-4 py-8 text-center text-body-sm text-muted-foreground">
            {error && (
              <p role="alert" className="font-medium text-destructive">
                {error}{' '}
                <button type="button" onClick={loadMore} className="font-semibold underline underline-offset-2">
                  Try again
                </button>
              </p>
            )}
            {loading && loadedOnce && <p role="status">Loading more notes…</p>}
            {next === null && items.length > 0 && <p>You are all caught up.</p>}
          </div>
        )}
        <div ref={sentinel} className="h-px" />
      </div>

      {items.length > 1 && (
        <div className="absolute top-1/2 right-6 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
          <Button variant="secondary" size="icon-lg" aria-label="Previous note" onClick={() => step(-1)}>
            <ChevronUp aria-hidden="true" />
          </Button>
          <Button variant="secondary" size="icon-lg" aria-label="Next note" onClick={() => step(1)}>
            <ChevronDown aria-hidden="true" />
          </Button>
        </div>
      )}

      <Sheet open={commentsFor !== null} onOpenChange={(o) => !o && setCommentsFor(null)}>
        <SheetContent
          side={desktop ? 'right' : 'bottom'}
          className={cn('gap-0 p-0', desktop ? 'w-[26rem] sm:max-w-[26rem]' : 'h-[78dvh] rounded-t-2xl border-t-0')}
        >
          <div className="flex items-center justify-between border-b px-5 py-4 pr-14">
            <SheetTitle className="text-title-sm font-bold">
              Comments {commentsFor ? commentsFor.counts.comments : ''}
            </SheetTitle>
            <SheetDescription className="sr-only">Comments on {commentsFor?.title}</SheetDescription>
          </div>
          {commentsFor && (
            <CommentPanel
              noteId={commentsFor.id}
              slideCount={commentsFor.slideCount}
              noteAuthorId={commentsFor.author.id}
              noteAuthor={commentsFor.author}
              heading={false}
              className="flex-1 pt-4"
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Home: the ranked Feed and the Following tab as a full-height snap feed (UC09, wireframes 04, 09, 13). */
export default function Feed() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const guest = !user;
  const tab: Tab = !guest && params.get('tab') === 'following' ? 'following' : 'feed';

  return (
    <section aria-label={tab === 'feed' ? 'Feed' : 'Following'} className="relative h-dvh">
      <h1 className="sr-only">{tab === 'feed' ? 'Feed' : 'Following'}</h1>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-topbar items-center justify-between px-2 md:justify-center md:px-6">
        <div className="pointer-events-auto md:hidden">
          <MoreMenu variant="icon" />
        </div>
        <div className="pointer-events-auto">
          <FeedTabs tab={tab} guest={guest} />
        </div>
        <div className="pointer-events-auto md:absolute md:right-6">
          {guest ? (
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" className="md:hidden">
                <Link to="/search" aria-label="Search">
                  <Search aria-hidden="true" className="size-5" />
                </Link>
              </Button>
              <Button asChild size="sm" className="md:h-10 md:px-5">
                <Link to="/login">Log in</Link>
              </Button>
            </div>
          ) : (
            <span className="block size-10 md:hidden" aria-hidden="true" />
          )}
        </div>
      </header>
      <FeedList key={tab} tab={tab} guest={guest} />
    </section>
  );
}
