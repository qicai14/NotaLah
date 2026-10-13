import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { errorText } from '../../lib/useFetch';
import type { FeedItem, FeedPage } from '../../types';
import { NoteCard } from './NoteCard';

export default function Feed() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [next, setNext] = useState<number | null>(1); // page to fetch; null = finished
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const asOf = useRef<string | null>(null);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busy.current || next === null) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const q = asOf.current ? `&asOf=${encodeURIComponent(asOf.current)}` : '';
      const page = await api<FeedPage>(`/feed?page=${next}${q}`);
      asOf.current ??= page.asOf;
      setItems((cur) => {
        const seen = new Set(cur.map((i) => i.id));
        return [...cur, ...page.items.filter((i) => !seen.has(i.id))];
      });
      setNext(page.nextPage);
      setLoadedOnce(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [next]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || error || next === null || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '400px' });
    io.observe(node);
    return () => io.disconnect();
  }, [loadMore, error, next, items.length]);

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Feed</h1>
      {loadedOnce && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="font-medium">No notes in your feed yet.</p>
          <p className="mt-1 text-sm text-slate-600">Share what you know, or look for notes by module.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link to="/notes/new" className="rounded-md bg-indigo-600 px-4 py-2 text-white">
              Create Note
            </Link>
            <span aria-disabled="true" title="Search arrives in Sprint 4" className="cursor-not-allowed rounded-md border border-slate-300 px-4 py-2 text-slate-400">
              Search (coming soon)
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6">
        {items.map((i) => (
          <NoteCard key={i.id} item={i} />
        ))}
      </div>
      {error && (
        <div role="alert" className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}{' '}
          <button type="button" onClick={loadMore} className="underline">
            Try again
          </button>
        </div>
      )}
      {loading && <p className="mt-4 text-center text-sm text-slate-500">Loading…</p>}
      {next === null && items.length > 0 && <p className="mt-6 text-center text-sm text-slate-500">You are all caught up.</p>}
      <div ref={sentinel} className="h-4" />
    </section>
  );
}
