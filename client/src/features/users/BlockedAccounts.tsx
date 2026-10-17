import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { api } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { usePaged } from '@/lib/usePaged';
import type { BlockedUser } from '@/types';

/** The people the user blocked, each with Unblock (D49). Lives in Edit profile. */
export function BlockedAccounts() {
  const {
    items: users,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    remove,
  } = usePaged<BlockedUser>('/users/me/blocks', 'users');
  const { run, pending, error: actionError } = useAction();

  const unblock = (id: number) =>
    run(async () => {
      await api(`/users/${id}/block`, { method: 'DELETE' });
      remove((u) => u.id === id);
    });

  return (
    <section aria-labelledby="blocked-heading" className="mt-10 border-t border-border pt-6">
      <h2 id="blocked-heading" className="text-title-sm font-bold">
        Blocked accounts
      </h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        Blocked people cannot see your notes or profile, and you cannot see theirs.
      </p>
      {loading && (
        <p role="status" className="mt-3 text-body-sm text-muted-foreground">
          Loading…
        </p>
      )}
      {(error || actionError) && (
        <p role="alert" className="mt-3 text-body-sm font-medium text-destructive">
          {error ?? actionError}
        </p>
      )}
      {!loading && !error && users.length === 0 && (
        <p className="mt-3 text-body text-muted-foreground">You have not blocked anyone.</p>
      )}
      <ul className="mt-3 flex flex-col gap-1">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-md px-2 py-2">
            <UserAvatar name={u.displayName} />
            <Link to={`/users/${u.id}`} className="min-w-0 flex-1 truncate text-body font-semibold hover:underline">
              {u.displayName}
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => unblock(u.id)}
              aria-label={`Unblock ${u.displayName}`}
            >
              Unblock
            </Button>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button variant="secondary" className="mt-2" disabled={loadingMore} onClick={loadMore}>
          Show more
        </Button>
      )}
    </section>
  );
}
