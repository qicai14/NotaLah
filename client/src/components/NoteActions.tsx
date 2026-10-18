import {
  Bookmark,
  Flag,
  Heart,
  Highlighter,
  MessageCircle,
  MessageSquareText,
  MoreHorizontal,
  Share2,
  UserPlus,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useGuestPrompt } from '@/features/auth/GuestPrompt';
import { useAction } from '@/lib/useAction';
import { cn } from '@/lib/utils';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import { isApprovedLecturer } from '../lib/roles';
import type { Note } from '../types';
import { RequestDialog } from '../features/collaboration/RequestDialog';
import { ShareDialog } from '../features/collaboration/ShareDialog';
import { SuperLikeDialog } from '../features/verification/SuperLikeDialog';
import { ReportDialog } from './ReportDialog';
import { UserAvatar } from './UserAvatar';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const circle =
  'grid size-action place-items-center rounded-full bg-surface text-foreground transition-[background-color,transform] duration-(--duration-fast) ease-(--ease-out-soft) group-hover:bg-surface-strong group-active:scale-90';
/** On phones the feed rail floats over the slide, so its icons go bare and white with a halo (md: and up keep the circle). */
const overlayCircle =
  'max-md:size-11 max-md:bg-transparent max-md:text-media max-md:media-shadow max-md:group-hover:bg-transparent';

const circleFor = (bar: boolean) => cn(circle, !bar && overlayCircle);

/** One rail control: a round icon button with its count or label underneath. */
function RailButton({
  icon,
  label,
  caption,
  pressed,
  disabled,
  onClick,
  to,
  bar,
}: {
  icon: ReactNode;
  label: string;
  caption?: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick?(): void;
  to?: string;
  bar: boolean;
}) {
  const inner = (
    <>
      <span className={circleFor(bar)}>{icon}</span>
      {caption !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            'text-caption font-bold tabular-nums',
            bar ? 'text-foreground/90' : 'text-foreground/90 max-md:text-media max-md:media-shadow',
          )}
        >
          {caption}
        </span>
      )}
    </>
  );
  const cls = cn(
    'group flex cursor-pointer items-center gap-1 rounded-full disabled:cursor-not-allowed disabled:opacity-50',
    bar ? 'flex-row pr-2' : 'flex-col',
  );
  if (to)
    return (
      <Link to={to} aria-label={label} className={cls}>
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cls}
    >
      {inner}
    </button>
  );
}

/**
 * The action rail beside a note: author, like, comments, save, Super Like (approved lecturers) and More. `bar` lays it
 * out in a row (note detail on phones). `onOpenComments` opens the comments panel; without it the button links to
 * the note. Guests get the R31 log-in sheet instead of a write. `onChange` hands the parent every change (like, save, Super Like) so it can keep the note current; the parent remounts this component when the layout changes.
 */
export function NoteActions({
  note,
  layout = 'rail',
  showAuthor = true,
  commentsLink = true,
  onOpenComments,
  onChange,
}: {
  note: Note;
  layout?: 'rail' | 'bar';
  showAuthor?: boolean;
  commentsLink?: boolean;
  onOpenComments?(): void;
  onChange(patch: Partial<Note>): void;
}) {
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const bar = layout === 'bar';
  const canSuperLike = isApprovedLecturer(user) && note.author.id !== user.id;
  const [superLiking, setSuperLiking] = useState(false);
  const [liked, setLiked] = useState(note.liked);
  const [likes, setLikes] = useState(note.counts.likes);
  const [saved, setSaved] = useState(note.bookmarked);
  const [reporting, setReporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const { run, pending, error } = useAction();
  const returnTo = `/notes/${note.id}`;

  const toggle = (kind: 'like' | 'bookmark') => {
    if (!user) return askToLogIn({ action: kind === 'like' ? 'like' : 'save', returnTo });
    const on = kind === 'like' ? liked : saved;
    return run(async () => {
      const r = await api<{ liked?: boolean; likes?: number; bookmarked?: boolean }>(`/notes/${note.id}/${kind}`, {
        method: on ? 'DELETE' : 'POST',
      });
      if (kind === 'like') {
        const nextLikes = r.likes ?? likes;
        setLiked(!!r.liked);
        setLikes(nextLikes);
        onChange({ liked: !!r.liked, counts: { ...note.counts, likes: nextLikes } });
      } else {
        setSaved(!!r.bookmarked);
        onChange({ bookmarked: !!r.bookmarked });
      }
    });
  };

  const removeSuperLike = () =>
    run(async () => {
      const r = await api<{ verified: boolean; verifiedBy: string | null }>(`/notes/${note.id}/verify`, {
        method: 'DELETE',
      });
      onChange({ ...r, verifiedByMe: false });
    });

  const report = () => (user ? setReporting(true) : askToLogIn({ action: 'report', returnTo }));
  const comments = note.counts.comments;
  const owner = note.author.id === user?.id;
  const canRequest = !owner && note.myRole !== 'edit';
  const requestAccess = () => (user ? setRequesting(true) : askToLogIn({ action: 'collaborate', returnTo }));

  return (
    <>
      <div
        role="group"
        aria-label="Note actions"
        className={cn('flex items-center', bar ? 'flex-row flex-wrap gap-2' : 'flex-col gap-4 max-md:gap-1')}
      >
        {showAuthor && !bar && (
          <Link
            to={`/users/${note.author.id}`}
            aria-label={`${note.author.displayName}'s profile`}
            className="mb-1 rounded-full ring-2 ring-background max-md:ring-media max-md:shadow-(--shadow-float) max-md:[@media(max-height:720px)]:hidden"
          >
            <UserAvatar name={note.author.displayName} className="size-action" />
          </Link>
        )}
        <RailButton
          bar={bar}
          label={`Like, ${likes} likes`}
          pressed={user ? liked : undefined}
          disabled={pending}
          onClick={() => toggle('like')}
          caption={compact.format(likes)}
          icon={
            <Heart
              key={String(liked)}
              aria-hidden="true"
              className={cn('size-6', liked && 'animate-pop fill-like text-like')}
            />
          }
        />
        {(onOpenComments || commentsLink) && (
          <RailButton
            bar={bar}
            label={`Comments, ${comments}`}
            onClick={onOpenComments}
            to={onOpenComments ? undefined : `/notes/${note.id}`}
            caption={compact.format(comments)}
            icon={<MessageCircle aria-hidden="true" className="size-6" />}
          />
        )}
        <RailButton
          bar={bar}
          label="Save"
          pressed={user ? saved : undefined}
          disabled={pending}
          onClick={() => toggle('bookmark')}
          caption={saved ? 'Saved' : 'Save'}
          icon={<Bookmark aria-hidden="true" className={cn('size-6', saved && 'fill-current')} />}
        />
        {canSuperLike &&
          (note.verifiedByMe ? (
            <RailButton
              bar={bar}
              label="Remove Super Like"
              pressed
              disabled={pending}
              onClick={removeSuperLike}
              caption="Verified"
              icon={
                <span className="grid size-full place-items-center rounded-full bg-highlight text-highlight-foreground">
                  <Highlighter aria-hidden="true" className="size-6" />
                </span>
              }
            />
          ) : user.status === 'active' ? ( // a restricted lecturer may only withdraw (D26)
            <RailButton
              bar={bar}
              label="Super Like"
              onClick={() => setSuperLiking(true)}
              caption="Verify"
              icon={<Highlighter aria-hidden="true" className="size-6" />}
            />
          ) : null)}
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={moreTrigger}
            aria-label="More actions"
            className={cn('group flex cursor-pointer rounded-full', bar ? 'flex-row' : 'flex-col')}
          >
            <span className={circleFor(bar)}>
              <MoreHorizontal aria-hidden="true" className="size-6" />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={bar ? 'bottom' : 'left'} align="end" className="w-56 rounded-lg p-1.5">
            {owner && (
              <DropdownMenuItem className="h-10 rounded-sm" onSelect={() => setSharing(true)}>
                <Share2 className="size-4" aria-hidden="true" />
                Share
              </DropdownMenuItem>
            )}
            {canRequest && (
              <DropdownMenuItem className="h-10 rounded-sm" onSelect={requestAccess}>
                <UserPlus className="size-4" aria-hidden="true" />
                Request to collaborate
              </DropdownMenuItem>
            )}
            {!owner && (
              <DropdownMenuItem className="h-10 rounded-sm" onSelect={report}>
                <Flag className="size-4" aria-hidden="true" />
                Report
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="h-10 rounded-sm" disabled>
              <MessageSquareText className="size-4" aria-hidden="true" />
              Message author (coming soon)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && (
        <p
          role="alert"
          className={cn(
            'rounded-md bg-popover px-3 py-2 text-body-sm font-medium text-destructive shadow-(--shadow-float)',
            bar ? 'mt-2' : 'absolute right-0 bottom-full mb-2 w-48',
          )}
        >
          {error}
        </p>
      )}
      {reporting && <ReportDialog noteId={note.id} onClose={() => setReporting(false)} returnFocus={moreTrigger} />}
      {sharing && user && (
        <ShareDialog
          noteId={note.id}
          title={note.title}
          ownerId={user.id}
          ownerName={user.displayName}
          onClose={() => setSharing(false)}
          returnFocus={moreTrigger}
        />
      )}
      {requesting && (
        <RequestDialog
          noteId={note.id}
          title={note.title}
          ownerName={note.author.displayName}
          onClose={() => setRequesting(false)}
          returnFocus={moreTrigger}
        />
      )}
      {superLiking && (
        <SuperLikeDialog
          noteId={note.id}
          onClose={() => setSuperLiking(false)}
          onDone={(me) => {
            setSuperLiking(false);
            onChange({ verified: true, verifiedBy: note.verifiedBy ?? me, verifiedByMe: true }); // the earliest verifier keeps the label
          }}
        />
      )}
    </>
  );
}
