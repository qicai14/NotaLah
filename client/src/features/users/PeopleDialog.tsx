import { Link } from 'react-router-dom';
import { LecturerBadge } from '@/components/LecturerBadge';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { usePaged } from '@/lib/usePaged';
import type { PersonRow } from '@/types';

type Side = 'followers' | 'following';

/** Followers or following of a user, 20 at a time (D40); each row links to that profile. */
export function PeopleDialog({
  userId,
  side,
  name,
  onClose,
}: {
  userId: number;
  side: Side;
  name: string;
  onClose(): void;
}) {
  const {
    items: rows,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
  } = usePaged<PersonRow>(`/users/${userId}/${side}`, 'items');

  const title = side === 'followers' ? 'Followers' : 'Following';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[80dvh] grid-rows-[auto_auto_1fr] sm:max-w-md">
        <DialogTitle className="text-title font-bold">{title}</DialogTitle>
        <DialogDescription className="text-body-sm text-muted-foreground">
          {side === 'followers' ? `People who follow ${name}.` : `People ${name} follows.`}
        </DialogDescription>
        <div className="min-h-0 overflow-y-auto">
          {!loading && !error && rows.length === 0 && (
            <p className="py-8 text-center text-body text-muted-foreground">Nobody here yet.</p>
          )}
          <ul className="flex flex-col">
            {rows.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/users/${p.id}`}
                  onClick={onClose}
                  className="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <UserAvatar name={p.displayName} />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">
                    {p.displayName}
                    {p.isVerifiedLecturer && <LecturerBadge />}
                  </span>
                  {p.isFriend && (
                    <span className="rounded-sm bg-surface-strong px-2 text-caption font-semibold">Friends</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {(loading || loadingMore) && (
            <p role="status" className="py-4 text-center text-body-sm text-muted-foreground">
              Loading…
            </p>
          )}
          {error && (
            <p role="alert" className="py-2 text-body-sm font-medium text-destructive">
              {error}
            </p>
          )}
          {hasMore && !loading && !loadingMore && (
            <Button variant="secondary" className="mt-2 w-full" onClick={loadMore}>
              Show more
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
