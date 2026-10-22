import { ArrowLeft, Pencil, UserPlus } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedPill } from '@/components/VerifiedPill';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { Coauthors } from '../../components/Coauthors';
import { EditedBadge } from '../../components/EditedBadge';
import { LecturerBadge } from '../../components/LecturerBadge';
import { NoteActions } from '../../components/NoteActions';
import { MusicChip } from '../../components/MusicChip';
import { SlideCarousel } from '../../components/board/SlideCarousel';
import { timeAgo, visibilityLabel } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Annotation, Note } from '../../types';
import { AnnotationPanel, type Draft, SelectionAnnotate, useHighlights } from '../annotations/Annotations';
import type { Anchor } from '../annotations/anchors';
import { useAuth } from '../auth/AuthContext';
import { useGuestPrompt } from '../auth/GuestPrompt';
import { RequestDialog } from '../collaboration/RequestDialog';
import { CommentPanel } from './CommentPanel';

const NO_SLIDES: Note['slides'] = [];
const NO_ANNOTATIONS: Annotation[] = [];

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
  const [requesting, setRequesting] = useState(false);
  const askToLogIn = useGuestPrompt();
  const ann = useFetch<{ annotationsOn: boolean; annotations: Annotation[] }>(
    data?.note.status === 'published' ? `/notes/${id}/annotations` : null,
  );
  const annotations = ann.data?.annotations ?? NO_ANNOTATIONS;
  const annotationsOn = ann.data?.annotationsOn ?? false;
  const deck = useRef<HTMLDivElement>(null);
  const [slide, setSlide] = useState(0);
  const onSlideChange = useCallback((i: number) => setSlide(i), []);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const show = useHighlights(deck, data?.note.slides ?? NO_SLIDES, annotations, slide + 1);
  const setList = (fn: (list: Annotation[]) => Annotation[]) =>
    ann.setData((d) => d && { ...d, annotations: fn(d.annotations) });
  const turnedOff = () => {
    ann.setData(() => ({ annotationsOn: false, annotations: [] }));
    setPanel(false);
    setDraft(null);
  };
  const annotate = (anchor: Anchor) => {
    if (!user) return askToLogIn({ action: 'annotate', returnTo: `/notes/${id}` });
    setDraft({ ...anchor, slideId: slide + 1 });
    setPanel(true);
  };

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
      annotations={
        ann.data
          ? {
              count: annotations.length,
              on: annotationsOn,
              onOpen: () => setPanel(true),
              onToggled: (on) => (on ? ann.reload() : turnedOff()),
            }
          : undefined
      }
      onChange={(v) => setData((d) => d && { note: { ...d.note, ...v } })}
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
              {n.coauthors?.length ? (
                <p className="text-body-sm">
                  <Coauthors people={n.coauthors} />
                </p>
              ) : null}
            </div>
            {n.myRole === 'view' && (
              <Button variant="secondary" onClick={() => setRequesting(true)}>
                <UserPlus aria-hidden="true" />
                Request to collaborate
              </Button>
            )}
            {(n.author.id === user?.id || n.myRole === 'edit') && (
              <Button asChild variant="secondary">
                <Link to={`/notes/${n.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Edit
                </Link>
              </Button>
            )}
          </header>

          <div className="flex items-end gap-4">
            <div className="min-w-0 flex-1 rounded-2xl border bg-card p-4 shadow-(--shadow-card) md:p-6">
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
          {!n.verified && n.editedSinceVerification && (
            <div className="flex flex-col gap-1.5 self-start">
              <EditedBadge />
              <p className="text-body-sm text-muted-foreground">
                This note was changed after a lecturer verified it, so the verification no longer counts until a
                lecturer confirms it again.
              </p>
            </div>
          )}
        </div>
        {published && (
          <CommentPanel
            noteId={n.id}
            slideCount={n.slides.length}
            noteAuthorId={n.author.id}
            noteAuthor={n.author}
            className="flex-1 border-t lg:min-h-0"
          />
        )}
      </aside>
      <SelectionAnnotate root={deck} enabled={annotationsOn} onAnnotate={annotate} />
      {annotationsOn && (
        // Non-modal beside the slide on desktop, so text can still be selected and highlights flash in view.
        <Sheet open={panel} onOpenChange={setPanel} modal={!desktop}>
          <SheetContent
            side={desktop ? 'right' : 'bottom'}
            onInteractOutside={desktop ? (e) => e.preventDefault() : undefined}
            className={
              desktop ? 'w-[26rem] gap-0 sm:max-w-none' : 'max-h-[75dvh] min-h-[40dvh] gap-0 rounded-t-2xl border-t-0'
            }
          >
            <div className="px-5 pt-5 pb-3">
              <SheetTitle className="text-title-sm font-bold">Annotations</SheetTitle>
              <SheetDescription className="text-body-sm text-muted-foreground">
                Slide {slide + 1} of {n.slides.length}
              </SheetDescription>
            </div>
            <AnnotationPanel
              noteId={n.id}
              slides={n.slides}
              slideNo={slide + 1}
              annotations={annotations}
              draft={draft}
              onPick={annotate}
              onDraftDone={() => setDraft(null)}
              onPosted={(a) => setList((l) => [...l, a])}
              onRemoved={(gone) => setList((l) => l.filter((a) => a.id !== gone))}
              onShow={(a) => {
                if (!desktop) setPanel(false);
                show(a);
              }}
              onOff={turnedOff}
            />
          </SheetContent>
        </Sheet>
      )}
      {requesting && (
        <RequestDialog
          noteId={n.id}
          title={n.title}
          ownerName={n.author.displayName}
          onClose={() => setRequesting(false)}
        />
      )}
    </article>
  );
}
