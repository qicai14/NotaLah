import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '@/components/Field';
import { UserAvatar } from '@/components/UserAvatar';
import { LecturerBadge } from '@/components/LecturerBadge';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { cn } from '@/lib/utils';
import type { PersonRow } from '@/types';
import { GROUP_MAX, GROUP_MIN_OTHERS, useFriends } from './helpers';
import { useMessaging } from './MessagingContext';
import type { Conversation } from './types';

function PaneHeader({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-2 border-b px-2 md:px-4">
      <Button variant="ghost" size="icon" aria-label="Back to messages" onClick={onBack} className="md:hidden">
        <ArrowLeft aria-hidden="true" />
      </Button>
      <h2 className="text-title-sm font-bold">{title}</h2>
    </header>
  );
}

function FriendStatus({
  loading,
  error,
  empty,
  hasMore,
  loadingMore,
  loadMore,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore(): void;
}) {
  return (
    <>
      {(loading || loadingMore) && (
        <p role="status" className="py-4 text-center text-body-sm text-muted-foreground">
          Loading friends…
        </p>
      )}
      {error && (
        <p role="alert" className="py-2 text-center text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {empty && !loading && !loadingMore && !hasMore && !error && (
        <div className="px-6 py-12 text-center">
          <p className="text-title font-bold">No friends yet</p>
          <p className="mt-1 text-body text-muted-foreground">
            Friends are people you follow who follow you back. You can still message anyone from their profile; if you
            are not friends it goes to them as a request.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link to="/search">Find people</Link>
          </Button>
        </div>
      )}
      {hasMore && !loading && !loadingMore && (
        <Button variant="secondary" className="mt-2 w-full" onClick={loadMore}>
          Show more friends
        </Button>
      )}
    </>
  );
}

/** Wireframe 45 (New chat): pick a friend; the chat opens through /messages?to=<id>. */
export function NewChat({ onBack }: { onBack(): void }) {
  const f = useFriends();
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PaneHeader title="New chat" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-6">
        <p className="mb-2 px-2 text-body-sm text-muted-foreground">Choose a friend to message.</p>
        <ul>
          {f.friends.map((p) => (
            <li key={p.id}>
              <Link
                to={`/messages?to=${p.id}`}
                className="flex min-h-14 items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
              >
                <UserAvatar name={p.displayName} className="size-11" />
                <span className="min-w-0 flex-1 truncate text-body font-semibold">
                  {p.displayName}
                  {p.isVerifiedLecturer && <LecturerBadge />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <FriendStatus {...f} empty={f.friends.length === 0} />
      </div>
    </div>
  );
}

/** Wireframe 49: name a group and pick friends (2 to 29 besides you; 30 members at most). */
export function NewGroup({ onBack }: { onBack(): void }) {
  const f = useFriends();
  const navigate = useNavigate();
  const { dispatch } = useMessaging();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<PersonRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const create = useAction();
  const full = picked.length >= GROUP_MAX - 1;

  const toggle = (p: PersonRow) =>
    setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    const r = await create.run(
      () =>
        api<{ conversation: Conversation }>('/conversations', {
          method: 'POST',
          body: { name: name.trim(), memberIds: picked.map((p) => p.id) },
        }),
      (err) => {
        if (err instanceof ApiError && Object.keys(err.errors).length) {
          setFieldErrors(err.errors);
          return null;
        }
        return err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.';
      },
    );
    if (!r) return;
    dispatch({ type: 'upsert', conversation: r.conversation });
    navigate(`/messages/${r.conversation.id}`, { replace: true });
  };

  const needed = GROUP_MIN_OTHERS - picked.length;
  return (
    <form onSubmit={submit} className="flex h-full min-h-0 flex-col bg-background">
      <PaneHeader title="New group" onBack={onBack} />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <Field
          label="Group name"
          name="group-name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="off"
        />
        <fieldset className="mt-5">
          <legend className="text-body-sm font-semibold">Add friends</legend>
          <p id="pick-hint" className="mb-2 text-caption text-muted-foreground">
            Pick at least {GROUP_MIN_OTHERS}. A group holds {GROUP_MAX} people including you.
          </p>
          <ul>
            {f.friends.map((p) => {
              const on = picked.some((x) => x.id === p.id);
              return (
                <li key={p.id}>
                  <label
                    className={cn(
                      'flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
                      on && 'bg-surface',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!on && full}
                      onChange={() => toggle(p)}
                      aria-describedby="pick-hint"
                      className="size-5 accent-primary"
                    />
                    <UserAvatar name={p.displayName} className="size-10" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.displayName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {fieldErrors.memberIds && (
            <p role="alert" className="mt-2 text-body-sm font-medium text-destructive">
              {fieldErrors.memberIds}
            </p>
          )}
          <FriendStatus {...f} empty={f.friends.length === 0} />
        </fieldset>
        {create.error && (
          <p
            role="alert"
            className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
          >
            {create.error}
          </p>
        )}
      </div>
      <div className="shrink-0 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={create.pending || !name.trim() || picked.length < GROUP_MIN_OTHERS}
        >
          {create.pending
            ? 'Creating…'
            : needed > 0
              ? `Pick ${needed} more ${needed === 1 ? 'friend' : 'friends'}`
              : `Create group (${picked.length + 1})`}
        </Button>
      </div>
    </form>
  );
}
