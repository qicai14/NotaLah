import { LogOut, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { ConfirmButton } from '@/components/ConfirmButton';
import { inputClass } from '@/components/Field';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { useMediaQuery, DESKTOP } from '@/hooks/useMediaQuery';
import { useAuth } from '../auth/AuthContext';
import { GROUP_MAX, GROUP_NAME_MAX, useFriends } from './helpers';
import { useMessaging } from './MessagingContext';
import type { Conversation } from './types';

/** Wireframe 50: members, rename (owner), add friends, remove (owner) and leave. */
export function GroupDetails({
  conversation: c,
  onClose,
  onLeft,
}: {
  conversation: Conversation;
  onClose(): void;
  onLeft(): void;
}) {
  const { user } = useAuth();
  const me = user!.id;
  const { dispatch } = useMessaging();
  const desktop = useMediaQuery(DESKTOP);
  const owner = c.ownerId === me;
  const [name, setName] = useState(c.name ?? '');
  const [adding, setAdding] = useState(false);
  const rename = useAction();
  const change = useAction();
  const leave = useAction();

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const r = await rename.run(() =>
      api<{ conversation: Conversation }>(`/conversations/${c.id}`, { method: 'PATCH', body: { name } }),
    );
    if (r) dispatch({ type: 'upsert', conversation: r.conversation });
  };
  const addMember = async (userId: number) => {
    const r = await change.run(() =>
      api<{ conversation: Conversation }>(`/conversations/${c.id}/members`, { method: 'POST', body: { userId } }),
    );
    if (r) dispatch({ type: 'upsert', conversation: r.conversation });
  };
  const removeMember = async (userId: number) => {
    const r = await change.run(() => api(`/conversations/${c.id}/members/${userId}`, { method: 'DELETE' }));
    if (r !== undefined) {
      dispatch({
        type: 'upsert',
        conversation: { ...c, members: c.members.filter((m) => m.id !== userId) },
      });
    }
  };
  const leaveGroup = async () => {
    const r = await leave.run(() => api(`/conversations/${c.id}/members/${me}`, { method: 'DELETE' }));
    if (r === undefined) return;
    dispatch({ type: 'removed', conversationId: c.id });
    onLeft();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className={desktop ? 'w-[26rem] gap-0' : 'max-h-[85dvh] gap-0 rounded-t-2xl border-t-0'}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <SheetTitle className="text-title font-bold">Group details</SheetTitle>
          <SheetDescription className="sr-only">
            Members of {c.name ?? 'this group'}, with options to rename it, add friends and leave.
          </SheetDescription>

          {owner ? (
            <form onSubmit={saveName} className="flex flex-col gap-1.5">
              <label htmlFor="group-name" className="text-body-sm font-semibold">
                Group name
              </label>
              <div className="flex gap-2">
                <input
                  id="group-name"
                  value={name}
                  maxLength={GROUP_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
                <Button type="submit" disabled={rename.pending || !name.trim() || name.trim() === c.name}>
                  Save
                </Button>
              </div>
              {rename.error && (
                <p role="alert" className="text-body-sm font-medium text-destructive">
                  {rename.error}
                </p>
              )}
            </form>
          ) : (
            <p className="text-body">
              <span className="font-semibold">{c.name}</span>
              <span className="block text-body-sm text-muted-foreground">Only the owner can rename this group.</span>
            </p>
          )}

          <section aria-labelledby="members-heading">
            <div className="mb-1 flex items-center justify-between">
              <h3 id="members-heading" className="text-title-sm font-bold">
                {c.members.length} of {GROUP_MAX} members
              </h3>
              {c.members.length < GROUP_MAX && (
                <Button variant="secondary" size="sm" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
                  <Plus aria-hidden="true" />
                  Add friends
                </Button>
              )}
            </div>
            {adding && <AddFriends conversation={c} pending={change.pending} onAdd={addMember} />}
            <ul className="flex flex-col">
              {c.members.map((m) => (
                <li key={m.id} className="flex min-h-12 items-center gap-3 py-1">
                  <UserAvatar name={m.displayName} />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">
                    {m.displayName}
                    {m.id === me && <span className="font-normal text-muted-foreground"> (you)</span>}
                  </span>
                  {m.id === c.ownerId && (
                    <span className="rounded-sm bg-surface-strong px-2 text-caption font-semibold">Owner</span>
                  )}
                  {owner && m.id !== me && (
                    <ConfirmButton label="Remove" onConfirm={() => void removeMember(m.id)} disabled={change.pending} />
                  )}
                </li>
              ))}
            </ul>
            {change.error && (
              <p role="alert" className="mt-2 text-body-sm font-medium text-destructive">
                {change.error}
              </p>
            )}
          </section>

          <div className="mt-auto border-t pt-4">
            <div className="flex items-center gap-2">
              <LogOut aria-hidden="true" className="size-4 text-destructive" />
              <ConfirmButton label="Leave group" onConfirm={() => void leaveGroup()} disabled={leave.pending} />
            </div>
            {leave.error && (
              <p role="alert" className="mt-2 text-body-sm font-medium text-destructive">
                {leave.error}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddFriends({
  conversation: c,
  pending,
  onAdd,
}: {
  conversation: Conversation;
  pending: boolean;
  onAdd(userId: number): void;
}) {
  const { friends, loading, error, hasMore, loadingMore, loadMore } = useFriends();
  const inGroup = new Set(c.members.map((m) => m.id));
  const rows = friends.filter((f) => !inGroup.has(f.id));
  return (
    <div className="mb-3 rounded-md bg-surface p-2">
      {!loading && rows.length === 0 && !hasMore && (
        <p className="px-2 py-3 text-body-sm text-muted-foreground">None of your friends are left to add.</p>
      )}
      <ul>
        {rows.map((f) => (
          <li key={f.id} className="flex min-h-12 items-center gap-3 px-1">
            <UserAvatar name={f.displayName} />
            <span className="min-w-0 flex-1 truncate text-body font-semibold">{f.displayName}</span>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onAdd(f.id)}>
              Add
            </Button>
          </li>
        ))}
      </ul>
      {(loading || loadingMore) && (
        <p role="status" className="px-2 py-2 text-body-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {error && (
        <p role="alert" className="px-2 py-2 text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {hasMore && !loading && !loadingMore && (
        <Button variant="ghost" size="sm" className="w-full" onClick={loadMore}>
          Show more
        </Button>
      )}
    </div>
  );
}
