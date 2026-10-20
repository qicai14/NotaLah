import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { Coauthors } from '../../components/Coauthors';
import { EditedBadge } from '../../components/EditedBadge';
import { LecturerBadge } from '../../components/LecturerBadge';
import { NoteActions } from '../../components/NoteActions';
import { SlideCarousel } from '../../components/board/SlideCarousel';
import { VerifiedPill } from '../../components/VerifiedPill';
import { api } from '../../lib/api';
import { timeAgo, visibilityLabel } from '../../lib/format';
import type { FeedNote, Note, RankingWeights } from '../../types';
import { WhyThisNote } from './WhyThisNote';

/** Logs one view when at least half the card has been visible for a second. Guests log none (D45). */
function useViewLogger(noteId: number, guest: boolean) {
  const el = useRef<HTMLElement>(null);
  const logged = useRef(false); // a ref survives StrictMode's second effect run, so a card is logged once
  useEffect(() => {
    const node = el.current;
    if (guest || !node || logged.current || typeof IntersectionObserver === 'undefined') return;
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
  }, [noteId, guest]);
  return el;
}

/**
 * One full-height feed card (wireframes 09, 13): verified mark and "Why this note?" on top, the slides, then the
 * caption; the action rail sits to its right. Memoised: a card re-renders only when its own note changes.
 */
export const NoteCard = memo(function NoteCard({
  item: initial,
  guest,
  weights,
  onOpenComments,
}: {
  item: FeedNote;
  guest: boolean;
  weights: RankingWeights | null;
  onOpenComments: (note: Note) => void;
}) {
  const [item, setItem] = useState(initial);
  const fetching = useRef(false);
  /** The feed sends only the first slides; the rest come from the note endpoint when the reader reaches them, kept on this card (D71). */
  const loadRest = useCallback(() => {
    if (fetching.current) return;
    fetching.current = true;
    api<{ note: Note }>(`/notes/${initial.id}`)
      .then(({ note }) =>
        setItem((n) => ({
          ...n,
          slides: note.slides,
          slideCount: note.slideCount,
          assets: note.assets,
          videoStatus: note.videoStatus,
        })),
      )
      .catch(() => (fetching.current = false));
  }, [initial.id]);
  const ref = useViewLogger(item.id, guest);
  const titleId = `note-${item.id}-title`;
  const desktop = useMediaQuery(DESKTOP);
  const actions = (
    <NoteActions
      note={item}
      onOpenComments={() => onOpenComments(item)}
      onChange={(v) => setItem((n) => ({ ...n, ...v }))}
    />
  );

  return (
    <article
      ref={ref}
      aria-labelledby={titleId}
      className="flex h-full snap-start snap-always items-end justify-center gap-2 px-2 pt-topbar pb-3 md:gap-5 md:px-6 md:pb-6"
    >
      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-(--shadow-card) md:aspect-[9/16] md:max-w-[34rem] md:flex-none md:rounded-2xl">
        {(item.verified || item.editedSinceVerification || (item.components && weights)) && (
          <div className="flex min-h-14 items-center justify-between gap-2 px-3 pt-3">
            {item.verified ? (
              <VerifiedPill by={item.verifiedBy} />
            ) : item.editedSinceVerification ? (
              <EditedBadge />
            ) : (
              <span />
            )}
            {item.components && weights && item.score !== undefined && (
              <WhyThisNote
                score={item.score}
                components={item.components}
                weights={weights}
                guest={guest}
                className="bg-surface"
              />
            )}
          </div>
        )}

        <div className="relative flex min-h-0 flex-1 flex-col justify-center py-2 max-md:bg-media-backdrop md:px-6">
          {item.module && (
            <p className="mb-2 text-caption font-semibold text-muted-foreground max-md:hidden">
              {item.module.code}
              <span className="sr-only">, {item.module.name}</span>
            </p>
          )}
          <div className="min-h-0 flex-1">
            <SlideCarousel
              slides={item.slides}
              aspect={item.aspect}
              assets={item.assets}
              videoStatus={item.videoStatus}
              slideCount={item.slideCount}
              onNeedMore={loadRest}
            />
          </div>
          {!desktop && <div className="absolute right-0.5 bottom-2 z-10">{actions}</div>}
        </div>

        <footer className="border-t bg-surface px-4 py-3.5 md:px-5 md:py-4">
          <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
            <Link to={`/users/${item.author.id}`} className="font-bold text-foreground hover:underline">
              {item.author.displayName}
            </Link>
            {item.author.isVerifiedLecturer && <LecturerBadge />}
            <span className="text-muted-foreground">
              {timeAgo(item.publishedAt)}
              {item.visibility === 'contacts' && `, ${visibilityLabel(item.visibility)}`}
            </span>
            <Coauthors people={item.coauthors} />
          </p>
          <h2 id={titleId} className="mt-1 line-clamp-2 text-title-sm font-semibold">
            <Link to={`/notes/${item.id}`} className="hover:underline">
              {item.title}
            </Link>
          </h2>
          {(item.hashtags.length > 0 || item.module) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {item.module && (
                <span className="rounded-sm bg-surface-strong px-2 py-0.5 text-caption font-semibold">
                  {item.module.code} {item.module.name}
                </span>
              )}
              {item.hashtags.map((h) => (
                <span key={h} className="text-body-sm font-bold text-foreground">
                  #{h}
                </span>
              ))}
            </div>
          )}
        </footer>
      </div>

      {desktop && <div className="relative shrink-0 pb-1">{actions}</div>}
    </article>
  );
});
