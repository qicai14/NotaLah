import { Eye, LogIn, MessageSquareQuote, Pencil } from 'lucide-react';
import { type RefObject, useCallback, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageMessage } from '@/components/PageMessage';
import { Coauthors } from '@/components/Coauthors';
import { MusicChip } from '@/components/MusicChip';
import { SlideCarousel } from '@/components/board/SlideCarousel';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { Annotation, CollabRole, Note } from '../../types';
import { AnnotationSheet, useHighlights } from '../annotations/Annotations';

const NO_ANNOTATIONS: Annotation[] = [];

/** The note's annotations for a link holder (R10): highlighted on the slide and listed in a sheet, never created, deleted or reported here. */
function SharedAnnotations({
  token,
  note,
  deck,
  slide,
}: {
  token: string;
  note: Note;
  deck: RefObject<HTMLElement | null>;
  slide: number;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useFetch<{ annotations: Annotation[] }>(`/share/${encodeURIComponent(token)}/annotations`);
  const list = data?.annotations ?? NO_ANNOTATIONS;
  const show = useHighlights(deck, note.slides, list, slide + 1);
  if (list.length === 0) return null;
  return (
    <>
      <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
        <MessageSquareQuote aria-hidden="true" />
        Annotations ({list.length})
      </Button>
      <AnnotationSheet
        open={open}
        onOpenChange={setOpen}
        noteId={note.id}
        slides={note.slides}
        slideNo={slide + 1}
        annotations={list}
        draft={null}
        readOnly
        onShow={show}
      />
    </>
  );
}

/**
 * The page behind a share link (R30, D46). A view link opens the note read-only, guests included. An edit link needs
 * an account (guests are sent to log in and return here); "Join as editor" is the write, so it is a button, not a side
 * effect of opening the link.
 */
export default function SharedNote() {
  const { token = '' } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, error, errorStatus, loading } = useFetch<{ role: CollabRole; note: Note | null }>(
    `/share/${encodeURIComponent(token)}`,
  );
  const join = useAction();
  const deck = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const onSlideChange = useCallback((i: number) => setSlide(i), []);

  if (loading)
    return (
      <p role="status" className="py-16 text-center text-body-sm text-muted-foreground">
        Opening shared note…
      </p>
    );

  if (errorStatus === 401) {
    return (
      <PageMessage
        title="Log in to edit this note"
        body="This link lets you join as an editor, which needs an account."
        action={
          <>
            <Button size="lg" onClick={() => navigate('/login', { state: { from: location.pathname } })}>
              <LogIn aria-hidden="true" />
              Log in
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => navigate('/register', { state: { from: location.pathname } })}
            >
              Register
            </Button>
          </>
        }
      />
    );
  }
  if (error || !data?.note) {
    return (
      <PageMessage
        title="This link does not work"
        body={error ?? 'The link was revoked, or the note is no longer available.'}
        action={
          <Button asChild variant="secondary">
            <Link to="/">Back to Feed</Link>
          </Button>
        }
      />
    );
  }

  const { role, note: n } = data;
  const own = user?.id === n.author.id;
  const joinAsEditor = async () => {
    const r = await join.run(() => api<{ noteId: number }>(`/share/${encodeURIComponent(token)}`, { method: 'POST' }));
    if (r) void navigate(`/notes/${r.noteId}`, { replace: true });
  };

  return (
    <article aria-labelledby="shared-title" className="mx-auto flex max-w-3xl flex-col gap-4">
      <meta name="referrer" content="no-referrer" />
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-4 py-3">
        {role === 'edit' ? (
          <Pencil className="size-5 shrink-0" aria-hidden="true" />
        ) : (
          <Eye className="size-5 shrink-0" aria-hidden="true" />
        )}
        <p className="min-w-0 flex-1 basis-56 text-body-sm">
          {own ? (
            <>This is your note.</>
          ) : role === 'edit' ? (
            <>
              <strong className="font-bold">{n.author.displayName}</strong> invited you to edit this note.
            </>
          ) : (
            <>
              You are reading a shared copy. <span className="text-muted-foreground">It is view only.</span>
            </>
          )}
        </p>
        {own && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/notes/${n.id}`}>Open note</Link>
          </Button>
        )}
        {role === 'edit' && !own && (
          <Button onClick={joinAsEditor} disabled={join.pending}>
            {join.pending ? 'Joining…' : 'Join as editor'}
          </Button>
        )}
        {role === 'view' && !user && (
          <Button asChild variant="outline" size="sm">
            <Link to="/login" state={{ from: location.pathname }}>
              Log in
            </Link>
          </Button>
        )}
      </div>
      {join.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
          {join.error}
        </p>
      )}

      <header className="flex items-center gap-3">
        <UserAvatar name={n.author.displayName} className="size-11" />
        <p className="min-w-0 text-body-sm">
          <span className="font-bold">{n.author.displayName}</span> <Coauthors people={n.coauthors} />
        </p>
      </header>

      <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-card) md:p-6">
        {n.module && <p className="mb-3 text-caption font-semibold text-muted-foreground">{n.module.code}</p>}
        {n.music && <MusicChip music={n.music} className="mb-3" />}
        <div ref={deck} className="h-[min(36rem,64dvh)]">
          <SlideCarousel
            slides={n.slides}
            aspect={n.aspect}
            assets={n.assets}
            videoStatus={n.videoStatus}
            onSlideChange={onSlideChange}
          />
        </div>
      </div>
      <SharedAnnotations token={token} note={n} deck={deck} slide={slide} />

      <h1 id="shared-title" className="text-title font-bold text-balance">
        {n.title}
      </h1>
      {(n.module || n.hashtags.length > 0) && (
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
      )}
    </article>
  );
}
