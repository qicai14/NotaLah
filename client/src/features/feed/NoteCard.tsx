import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { LecturerBadge } from '../../components/LecturerBadge';
import { NoteActions } from '../../components/NoteActions';
import { SlideViewer } from '../../components/SlideViewer';
import { api } from '../../lib/api';
import { timeAgo, visibilityLabel } from '../../lib/format';
import type { FeedItem } from '../../types';

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
  const ref = useViewLogger(item.id);
  return (
    <article
      ref={ref}
      aria-label={item.title}
      className={`snap-start rounded-lg bg-white p-4 shadow-sm max-md:min-h-[calc(100svh-8rem)] ${item.verified ? 'border-4 border-double border-indigo-500' : 'border border-slate-200'}`}
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
      <NoteActions note={item} />
    </article>
  );
}
