import { BOARD_WIDTH, boardHeight } from '@parp/shared';
import { ArrowLeft, Ban, MoreHorizontal, Pencil } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
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
import { usePaged } from '@/lib/usePaged';
import type { BlockedProfile, FollowState, Profile as ProfileData, ProfileNote } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { useGuestPrompt } from '../auth/GuestPrompt';
import { SavedNotes } from '../feed/SavedNotes';
import { BlockDialog } from './BlockDialog';
import { PeopleDialog } from './PeopleDialog';

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

const isBlocked = (u: ProfileData | BlockedProfile): u is BlockedProfile => u.blockedByMe === true;

/** One component serves /users/:id and /profile (own: Edit and drafts; other: Follow, Message, More; blocked: Unblock). */
export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const uid = id ?? String(user?.id);
  const afterUnblock = useRef(false);
  const { data, setData, error, errorStatus, loading, reload } = useFetch<{ user: ProfileData | BlockedProfile }>(
    `/users/${uid}`,
  );

  if (loading) return <ProfileSkeleton />;
  if (errorStatus === 404) return <Unavailable />;
  if (error || !data) {
    return (
      <p role="alert" className="py-16 text-center text-body-sm font-medium text-destructive">
        {error ?? 'Could not load this profile.'}
      </p>
    );
  }
  const p = data.user;
  if (isBlocked(p))
    return (
      <BlockedView
        profile={p}
        onUnblocked={() => {
          afterUnblock.current = true;
          reload();
        }}
      />
    );
  return (
    <Loaded
      key={p.id}
      p={p}
      own={p.id === user?.id}
      focusName={afterUnblock.current}
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
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
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
      <Button ref={button} variant="outline" onClick={unblock} disabled={pending}>
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
    <button type="button" onClick={onClick} className="cursor-pointer rounded-sm hover:underline">
      {inner}
    </button>
  );
}

function Loaded({
  p,
  own,
  focusName,
  onFollowState,
  onBlocked,
  reload,
}: {
  p: ProfileData;
  own: boolean;
  focusName: boolean;
  onFollowState(s: FollowState): void;
  onBlocked(): void;
  reload(): void;
}) {
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const navigate = useNavigate();
  const [people, setPeople] = useState<'followers' | 'following' | null>(null);
  const [blocking, setBlocking] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusName) heading.current?.focus();
  }, [focusName]);
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

  const [tab, setTab] = useState<'notes' | 'saved'>('notes');
  const notes = usePaged<ProfileNote>(`/users/${p.id}/notes`, 'notes', {
    items: p.notes,
    next: p.notesNextCursor,
  });
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
          <h1 id="profile-name" ref={heading} tabIndex={-1} className="text-title font-bold outline-none">
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
                {/* shortcut: Message button hidden until the messaging UI lands; it must read ?to=<id> */}
                {user && p.role !== 'admin' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="More options">
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

      {own ? <ProfileTabs tab={tab} onTab={setTab} /> : <h2 className="mt-8 mb-3 text-title-sm font-bold">Notes</h2>}
      {own && tab === 'saved' ? (
        <div role="tabpanel" id="profile-panel-saved" aria-labelledby="profile-tab-saved">
          <SavedNotes />
        </div>
      ) : (
        <div
          role={own ? 'tabpanel' : undefined}
          id={own ? 'profile-panel-notes' : undefined}
          aria-labelledby={own ? 'profile-tab-notes' : undefined}
        >
          {notes.items.length === 0 && !notes.loading && (
            <div className="py-12 text-center">
              <p className="text-title font-bold">No notes yet</p>
              <p className="mt-1 text-body text-muted-foreground">
                {own ? 'Notes you publish will show up here.' : `${p.displayName} has not published a note yet.`}
              </p>
            </div>
          )}
          <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
            {notes.items.map((n) => (
              <li key={n.id}>
                <NoteTile note={n} />
              </li>
            ))}
          </ul>
          {notes.error && (
            <p role="alert" className="mt-3 text-center text-body-sm font-medium text-destructive">
              {notes.error}
            </p>
          )}
          {notes.hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" disabled={notes.loadingMore} onClick={notes.loadMore}>
                Show more notes
              </Button>
            </div>
          )}
        </div>
      )}

      {people && <PeopleDialog userId={p.id} side={people} name={p.displayName} onClose={() => setPeople(null)} />}
      {blocking && (
        <BlockDialog userId={p.id} name={p.displayName} onClose={() => setBlocking(false)} onBlocked={onBlocked} />
      )}
    </section>
  );
}

const TABS = [
  { id: 'notes', label: 'Notes' },
  { id: 'saved', label: 'Saved' },
] as const;

/** Notes / Saved switch on your own profile: a tablist with arrow-key movement. */
function ProfileTabs({ tab, onTab }: { tab: 'notes' | 'saved'; onTab(t: 'notes' | 'saved'): void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = tab === 'notes' ? 'saved' : 'notes';
    onTab(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Your notes" onKeyDown={onKey} className="mt-8 mb-4 flex gap-6 border-b">
      {TABS.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          type="button"
          role="tab"
          id={`profile-tab-${t.id}`}
          aria-selected={tab === t.id}
          aria-controls={`profile-panel-${t.id}`}
          tabIndex={tab === t.id ? 0 : -1}
          onClick={() => onTab(t.id)}
          className={`-mb-px h-11 cursor-pointer border-b-2 text-title-sm font-bold ${
            tab === t.id
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
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
          <div inert aria-hidden="true" className="size-full">
            <SlideBoard slide={n.cover} aspect={n.aspect} assets={n.assets} label={`First slide of ${n.title}`} />
          </div>
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
