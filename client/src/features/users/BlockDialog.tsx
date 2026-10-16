import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useAction } from '@/lib/useAction';

/** Confirm a block (D49, wireframe 33): says what changes, and shows the server's reason when it is refused (admins). */
export function BlockDialog({
  userId,
  name,
  onClose,
  onBlocked,
  returnFocus,
}: {
  userId: number;
  name: string;
  onClose(): void;
  onBlocked(): void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const { run, pending, error } = useAction();

  async function confirm() {
    const ok = await run(async () => {
      await api(`/users/${userId}/block`, { method: 'POST' });
      return true;
    });
    if (ok) {
      onBlocked();
      onClose();
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(e) => {
          if (!returnFocus?.current) return;
          e.preventDefault();
          returnFocus.current.focus();
        }}
      >
        <DialogTitle className="text-title font-bold">Block {name}?</DialogTitle>
        <DialogDescription className="text-body-sm text-muted-foreground">
          They will not be told. You can unblock them any time from their profile or from Edit profile.
        </DialogDescription>
        <ul className="list-disc space-y-1.5 pl-5 text-body-sm">
          <li>You will no longer see each other&apos;s notes, comments or profile.</li>
          <li>You will stop following each other.</li>
          <li>Neither of you can message, like or comment on the other.</li>
        </ul>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={confirm}>
            {pending ? 'Blocking…' : 'Block'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
