import { BOARD_WIDTH, boardHeight } from '@parp/shared';
import { ArrowLeft, Ban, MessageCircle, MoreHorizontal, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SlideBoard } from '@/components/board/SlideBoard';
import { LecturerBadge } from '@/components/LecturerBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useAction } from '@/lib/useAction';
import { useFetch } from '@/lib/useFetch';
import type { BlockedProfile, FollowState, Profile as ProfileData, ProfileNote } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { useGuestPrompt } from '../auth/GuestPrompt';
import { BlockDialog } from './BlockDialog';
import { PeopleDialog } from './PeopleDialog';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const NOT_AVAILABLE = 'User not found';

const isBlocked = (u: ProfileData | BlockedProfile): u is BlockedProfile => 'blockedByMe' in u;

/** One component serves /users/:id and /profile (own: Edit and drafts; other: Follow, Message, More; blocked: Unblock). */
export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const uid = id ?? String(user?.id);
  const { data, setData, error, loading, reload } = useFetch<{ user: ProfileData | BlockedProfile }>(`/users/${uid}`);

  if (loading) return <ProfileSkeleton />;
  if (error === NOT_AVAILABLE) return <Unavailable />;
  if (error || !data) {
    return (
      <p role="alert" className="py-16 text-center text-body-sm font-medium text-destructive">
        {error ?? 'Could not load this profile.'}
      </p>
    );
  }
  const p = data.user;
  if (isBlocked(p)) return <BlockedView profile={p} onUnblocked={reload} />;
  return (
    <Loaded
      key={p.id}
      p={p}
      own={p.id === user?.id}
      onFollowState={(s) => setData((d) => d && { user: { ...(d.user as ProfileData), ...s } })}
      onBlocked={() => setData((d) => d && { user: { id: p.id, displayName: p.displayName, blockedByMe: true } })}
      reload={reload}
    />
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="flex animate-pulse items-center gap-5">
      <div className="size-24 rounded-full bg-surface" />
      <div className="flex-1 space-y-3">
        <div className="h-6 w-48 rounded-sm bg-surface" />
        <div className="h-4 w-64 rounded-sm bg-surface" />
      </div>
    </div>
  );
}

/** Wireframe 34 minus the profile: blocked from the other side, or no such person, look the same (D49). */
function Unavailable() {
  return (
    <div className="flex flex-col items-center gap-2 py-20 text-center">
      <h1 className="text-title font-bold">This profile is not available</h1>
      <p className="max-w-sm text-body text-muted-foreground">
        The account may not exist or may have been removed. Try going back to the feed.
      </p>
      <Button asChild className="mt-3">
        <Link to="/">Back to feed</Link>
      </Button>
    </div>
  );
}

/** Wireframe 34: the blocker sees only the name and Unblock. */
function BlockedView({ profile, onUnblocked }: { profile: BlockedProfile; onUnblocked(): void }) {
  const { run, pending, error } = useAction();
  const unblock = async () => {
    if ((await run(() => api(`/users/${profile.id}/block`, { method: 'DELETE' }))) !== undefined) onUnblocked();
  };
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <UserAvatar name={profile.displayName} className="size-24 text-title" />
      <h1 className="text-title font-bold">{profile.displayName}</h1>
      <p className="max-w-sm text-body text-muted-foreground">
        You blocked this account. Their notes and profile are hidden from you, and yours from them.
      </p>
      <Button variant="outline" onClick={unblock} disabled={pending}>
        {pending ? 'Unblocking…' : 'Unblock'}
      </Button>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Stat({ value, label, onClick }: { value: number; label: string; onClick?(): void }) {
  const inner = (
    <>
      <span className="text-title-sm font-bold tabular-nums">{compact.format(value)}</span>{' '}
      <span className="text-body-sm text-muted-foreground">{label}</span>
    </>
  );
  if (!onClick) return <div>{inner}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${value} ${label}`}
      className="cursor-pointer rounded-sm hover:underline"
    >
      {inner}
    </button>
  );
}

function Loaded({
  p,
  own,
  onFollowState,
  onBlocked,
  reload,
}: {
  p: ProfileData;
  own: boolean;
  onFollowState(s: FollowState): void;
  onBlocked(): void;
  reload(): void;
}) {
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const navigate = useNavigate();
  const [people, setPeople] = useState<'followers' | 'following' | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [more, setMore] = useState<{ notes: ProfileNote[]; next: string | null } | null>(null);
  const moreTrigger = useRef<HTMLButtonElement>(null);
  const { run, pending, error } = useAction();
  const returnTo = `/users/${p.id}`;

  const toggleFollow = () => {
    if (!user) return askToLogIn({ action: 'follow', returnTo });
    return run(async () => {
      const r = await api<FollowState | undefined>(`/users/${p.id}/follow`, {
        method: p.followedByMe ? 'DELETE' : 'POST',
      });
      if (r) onFollowState(r);
      else reload();
    });
  };

  const loadMore = () =>
    run(async () => {
      const cursor = more ? more.next : p.notesNextCursor;
      const r = await api<{ notes: ProfileNote[]; nextCursor: string | null }>(`/users/${p.id}/notes?cursor=${cursor}`);
      setMore((m) => ({ notes: [...(m?.notes ?? []), ...r.notes], next: r.nextCursor }));
    });

  const notes = [...p.notes, ...(more?.notes ?? [])];
  const nextCursor = more ? more.next : p.notesNextCursor;
  const followLabel = p.isFriend ? 'Friends' : p.followedByMe ? 'Following' : p.followsMe ? 'Follow back' : 'Follow';
  const subtitle = [p.role === 'lecturer' ? 'Lecturer' : p.role === 'admin' ? 'Admin' : 'Student', p.programme]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-labelledby="profile-name">
      {!own && (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onClick={() => navigate(-1)}
          className="-ml-2 mb-2 md:hidden"
        >
          <ArrowLeft aria-hidden="true" />
        </Button>
      )}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <UserAvatar name={p.displayName} src={p.avatarUrl} className="size-24 text-title sm:size-28" />
        <div className="min-w-0 flex-1">
          <h1 id="profile-name" className="text-title font-bold">
            {p.displayName}
            {p.isVerifiedLecturer && <LecturerBadge />}
          </h1>
          <p className="text-body-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
            <Stat
              value={p.followingCount}
              label="Following"
              onClick={user ? () => setPeople('following') : undefined}
            />
            <Stat
              value={p.followerCount}
              label={p.followerCount === 1 ? 'Follower' : 'Followers'}
              onClick={user ? () => setPeople('followers') : undefined}
            />
            <Stat value={p.likeCount} label={p.likeCount === 1 ? 'Like' : 'Likes'} />
          </div>
          {p.bio && <p className="mt-3 whitespace-pre-wrap text-body">{p.bio}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {own ? (
              <>
                <Button asChild variant="secondary">
                  <Link to="/profile/edit">
                    <Pencil aria-hidden="true" />
                    Edit profile
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/drafts">
                    {p.draftCount ?? 0} {p.draftCount === 1 ? 'draft' : 'drafts'}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={p.followedByMe ? 'secondary' : 'default'}
                  aria-pressed={user ? p.followedByMe : undefined}
                  disabled={pending}
                  onClick={toggleFollow}
                >
                  {followLabel}
                </Button>
                {user ? (
                  <Button asChild variant="outline">
                    <Link to={`/messages?to=${p.id}`}>
                      <MessageCircle aria-hidden="true" />
                      Message
                    </Link>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => askToLogIn({ action: 'message', returnTo })}>
                    <MessageCircle aria-hidden="true" />
                    Message
                  </Button>
                )}
                {user && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button ref={moreTrigger} variant="outline" size="icon" aria-label="More options">
                        <MoreHorizontal aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem className="h-10" variant="destructive" onSelect={() => setBlocking(true)}>
                        <Ban aria-hidden="true" />
                        Block {p.displayName}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-body-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      </header>

      <h2 className="mt-8 mb-3 text-title-sm font-bold">Notes</h2>
      {notes.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-title font-bold">No notes yet</p>
          <p className="mt-1 text-body text-muted-foreground">
            {own ? 'Notes you publish will show up here.' : `${p.displayName} has not published a note yet.`}
          </p>
        </div>
      )}
      <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
        {notes.map((n) => (
          <li key={n.id}>
            <NoteTile note={n} />
          </li>
        ))}
      </ul>
      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" disabled={pending} onClick={loadMore}>
            Show more notes
          </Button>
        </div>
      )}

      {people && <PeopleDialog userId={p.id} side={people} name={p.displayName} onClose={() => setPeople(null)} />}
      {blocking && (
        <BlockDialog
          userId={p.id}
          name={p.displayName}
          onClose={() => setBlocking(false)}
          onBlocked={onBlocked}
          returnFocus={moreTrigger}
        />
      )}
    </section>
  );
}

function NoteTile({ note: n }: { note: ProfileNote }) {
  return (
    <Link
      to={`/notes/${n.id}`}
      className="group block overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card) transition-transform duration-(--duration-fast) ease-(--ease-out-soft) active:scale-[0.98]"
    >
      <div className="bg-surface-strong" style={{ aspectRatio: BOARD_WIDTH / boardHeight(n.aspect) }}>
        {n.cover && (
          <SlideBoard slide={n.cover} aspect={n.aspect} assets={n.assets} label={`First slide of ${n.title}`} />
        )}
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-body-sm font-semibold group-hover:underline">{n.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
          {n.moduleCode && (
            <span className="rounded-sm bg-surface-strong px-2 font-semibold text-foreground">{n.moduleCode}</span>
          )}
          <span>{timeAgo(n.publishedAt)}</span>
          <span className="tabular-nums">{compact.format(n.likes)} likes</span>
        </p>
        {n.verifiedBy && <p className="mt-1 text-caption font-semibold">Verified by {n.verifiedBy}</p>}
      </div>
    </Link>
  );
}
