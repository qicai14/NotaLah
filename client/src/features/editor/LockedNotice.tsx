import { LockKeyhole } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import type { LockHolder } from './lock';

/**
 * Wireframes 28 and 29: someone else is editing, so this editor is read-only. It says who, what still works, and
 * that editing opens by itself once they finish (the lock is retried in the background and taken over when it lapses).
 */
export function LockedNotice({ holder, owner, onRetry }: { holder: LockHolder; owner: boolean; onRetry(): void }) {
  return (
    <div
      role="status"
      className="mx-3 mt-3 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border bg-popover px-4 py-3 text-popover-foreground shadow-(--shadow-card) md:mx-auto md:mt-4 md:w-full md:max-w-2xl"
    >
      <UserAvatar name={holder.displayName} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm font-semibold">{holder.displayName} is editing</p>
        <p className="text-body-sm text-muted-foreground">
          You can look through the slides. Editing opens here when they finish, or two minutes after they leave.
          {owner && ' You can still publish the last saved version.'}
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** The header's stand-in for the save status while read-only. */
export function ViewOnly() {
  return (
    <span className="flex items-center gap-1 rounded-sm bg-surface px-2 py-0.5 text-caption font-semibold whitespace-nowrap text-muted-foreground">
      <LockKeyhole className="size-3.5" aria-hidden="true" />
      View only
    </span>
  );
}
