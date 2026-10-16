import { ArrowLeft, Pencil } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedPill } from '@/components/VerifiedPill';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { LecturerBadge } from '../../components/LecturerBadge';
import { NoteActions } from '../../components/NoteActions';
import { SlideViewer } from '../../components/SlideViewer';
import { timeAgo, visibilityLabel } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Note } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { CommentPanel } from './CommentPanel';

function BackBar() {
  const navigate = useNavigate();
  const back = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/'));
  return (
    <div className="flex h-topbar items-center gap-3 px-2 md:px-6">
      <Button variant="ghost" size="icon" onClick={back} aria-label="Back">
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Button>
      <p className="text-title-sm font-bold">Note</p>
    </div>
  );
}

/** A note on its own page (wireframes 05, 15): slides and action rail on the left, details and comments on the right. */
export default function NoteDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, setData, error, loading } = useFetch<{ note: Note }>(`/notes/${id}`);
  const desktop = useMediaQuery(DESKTOP);

  if (loading)
    return (
      <div className="min-h-dvh">
        <BackBar />
        <p role="status" className="px-6 py-10 text-center text-body-sm text-muted-foreground">
          Loading note…
        </p>
      </div>
    );
  if (error || !data) {
    return (
      <div className="min-h-dvh">
        <BackBar />
        <div className="mx-auto max-w-sm px-6 py-16 text-center">
          <p role="alert" className="text-title-sm font-bold">
            {error ?? 'Note not found'}
          </p>
          <Button asChild variant="secondary" className="mt-5">
            <Link to="/">Back to Feed</Link>
          </Button>
        </div>
      </div>
    );
  }
  const n = data.note;
  const published = n.status === 'published';
  const actions = (
    <NoteActions
      note={n}
      layout={desktop ? 'rail' : 'bar'}
      showAuthor={false}
      commentsLink={false}
      onVerify={(v) => setData((d) => d && { note: { ...d.note, ...v } })}
    />
  );

  return (
    <article
      aria-labelledby="note-title"
      className="lg:grid lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] max-lg:pb-[calc(var(--spacing-tabbar)+1rem)]"
    >
      <div className="min-w-0 lg:overflow-y-auto">
        <BackBar />
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-8 md:px-8">
          <header className="flex items-center gap-3">
            <UserAvatar name={n.author.displayName} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center text-body font-bold">
                <Link to={`/users/${n.author.id}`} className="truncate hover:underline">
                  {n.author.displayName}
                </Link>
                {n.author.isVerifiedLecturer && <LecturerBadge />}
              </p>
              <p className="text-body-sm text-muted-foreground">
                {timeAgo(n.publishedAt ?? n.updatedAt)}, {visibilityLabel(n.visibility)}
              </p>
            </div>
            {n.author.id === user?.id && (
              <Button asChild variant="secondary">
                <Link to={`/notes/${n.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            )}
          </header>

          <div className="flex items-end gap-4">
            <div className="min-w-0 flex-1 rounded-2xl border bg-card p-4 shadow-(--shadow-card) md:p-6 [&_.slide-content]:rounded-lg md:[&_.slide-content]:h-[min(32rem,58dvh)]">
              {n.module && <p className="mb-3 text-caption font-semibold text-muted-foreground">{n.module.code}</p>}
              <SlideViewer slides={n.slides} />
            </div>
            {published && desktop && <div className="relative">{actions}</div>}
          </div>
          {published && !desktop && actions}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col border-t bg-background lg:border-t-0 lg:border-l">
        <div className="flex flex-col gap-3 px-5 pt-6 pb-4">
          <h1 id="note-title" className="text-title font-bold text-balance">
            {n.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {n.module && (
              <span className="rounded-full bg-surface px-3 py-1 text-caption font-semibold">
                {n.module.code} {n.module.name}
              </span>
            )}
            {n.hashtags.map((h) => (
              <span key={h} className="rounded-full bg-surface px-3 py-1 text-caption font-semibold">
                #{h}
              </span>
            ))}
          </div>
          {n.verified && <VerifiedPill by={n.verifiedBy} className="self-start" />}
        </div>
        {published && (
          <CommentPanel
            noteId={n.id}
            slideCount={n.slides.length}
            noteAuthorId={n.author.id}
            className="flex-1 border-t lg:min-h-0"
          />
        )}
      </aside>
    </article>
  );
}
