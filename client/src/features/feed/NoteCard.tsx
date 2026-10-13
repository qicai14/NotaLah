import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReportDialog } from '../../components/ReportDialog';
import { SlideViewer } from '../../components/SlideViewer';
import { api } from '../../lib/api';
import { timeAgo, visibilityLabel } from '../../lib/format';
import type { FeedItem } from '../../types';
import { useAuth } from '../auth/AuthContext';

export function LecturerBadge() {
  return (
    <span title="Verified lecturer" className="ml-1 rounded-full bg-indigo-600 px-1.5 text-xs text-white">
      ✓<span className="sr-only"> verified lecturer</span>
    </span>
  );
}

/** Logs one view when at least half the card has been visible for a second. */
function useViewLogger(noteId: number) {
  const el = useRef<HTMLElement>(null);
  const logged = useRef(false); // a ref survives StrictMode's second effect run, so a card is logged once
  useEffect(() => {
    const node = el.current;
    if (!node || logged.current || typeof IntersectionObserver === 'undefined') return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (!entry.isIntersecting || logged.current) return;
        timer = window.setTimeout(() => {
          if (logged.current) return;
          logged.current = true;
          io.disconnect();
          api(`/notes/${noteId}/view`, { method: 'POST' }).catch(() => {});
        }, 1000);
      },
      { threshold: 0.5 },
    );
    io.observe(node);
    return () => {
      window.clearTimeout(timer);
      io.disconnect();
    };
  }, [noteId]);
  return el;
}

export function NoteCard({ item }: { item: FeedItem }) {
  const { user } = useAuth();
  const ref = useViewLogger(item.id);
  const [liked, setLiked] = useState(item.liked);
  const [likes, setLikes] = useState(item.counts.likes);
  const [saved, setSaved] = useState(item.bookmarked);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(kind: 'like' | 'bookmark') {
    if (busy) return;
    setBusy(true);
    setError(null);
    const on = kind === 'like' ? liked : saved;
    try {
      const r = await api<{ liked?: boolean; likes?: number; bookmarked?: boolean }>(`/notes/${item.id}/${kind}`, { method: on ? 'DELETE' : 'POST' });
      if (kind === 'like') (setLiked(!!r.liked), setLikes(r.likes ?? likes));
      else setSaved(!!r.bookmarked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const btn = 'rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50';
  return (
    <article
      ref={ref}
      aria-label={item.title}
      className={`rounded-lg bg-white p-4 shadow-sm ${item.verified ? 'border-4 border-double border-indigo-500' : 'border border-slate-200'}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
        <Link to={`/users/${item.author.id}`} className="font-medium text-slate-900">
          {item.author.displayName}
        </Link>
        {item.author.isVerifiedLecturer && <LecturerBadge />}
        {item.module && <span className="rounded bg-slate-100 px-1.5">{item.module.code}</span>}
        <span>{timeAgo(item.publishedAt)}</span>
        <span>· {visibilityLabel(item.visibility)}</span>
      </header>
      <h2 className="mb-2 text-lg font-semibold">
        <Link to={`/notes/${item.id}`}>{item.title}</Link>
      </h2>
      {item.verified && <p className="mb-2 text-sm font-medium text-indigo-700">Verified by a lecturer</p>}
      <SlideViewer slides={item.slides} />
      {item.hashtags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-sm text-indigo-700">
          {item.hashtags.map((h) => (
            <li key={h}>#{h}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => toggle('like')} disabled={busy} aria-pressed={liked} aria-label={`Like, ${likes} likes`} className={`${btn} ${liked ? 'bg-indigo-600 text-white' : ''}`}>
          {liked ? 'Liked' : 'Like'} ({likes})
        </button>
        <Link to={`/notes/${item.id}`} className={btn} aria-label={`Comments, ${item.counts.comments}`}>
          Comments ({item.counts.comments})
        </Link>
        <button type="button" onClick={() => toggle('bookmark')} disabled={busy} aria-pressed={saved} className={`${btn} ${saved ? 'bg-slate-800 text-white' : ''}`}>
          {saved ? 'Saved' : 'Save'}
        </button>
        {item.author.id !== user?.id && (
          <button type="button" onClick={() => setReporting(true)} className={btn}>
            Report
          </button>
        )}
        <button type="button" disabled title="Coming in Sprint 4" className={btn}>
          Message author — coming soon
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {reporting && <ReportDialog noteId={item.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
