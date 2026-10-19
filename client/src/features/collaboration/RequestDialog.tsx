import { type FormEvent, type RefObject, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { COLLAB_REQUEST_MESSAGE_MAX as MAX } from '@notalah/shared';
import { useAction } from '@/lib/useAction';
import { api } from '../../lib/api';

/** Ask the owner to collaborate (wireframe 17); the message is optional. */
export function RequestDialog({
  noteId,
  title,
  ownerName,
  onClose,
  returnFocus,
}: {
  noteId: number;
  title: string;
  ownerName: string;
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const { run, pending, error, setError } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (message.trim().length > MAX) {
      return setError(`Message must be at most ${MAX} characters`);
    }
    const ok = await run(async () => {
      await api(`/notes/${noteId}/requests`, { method: 'POST', body: { message: message.trim() || null } });
      return true;
    });
    if (ok) setDone(true);
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
        <DialogTitle className="pr-8 text-title font-bold">Request to collaborate</DialogTitle>
        <DialogDescription className="text-body-sm text-muted-foreground">
          {title} by {ownerName}. They decide whether you can edit.
        </DialogDescription>
        {done ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="text-body">
              Request sent. {ownerName} will see it and can approve or decline.
            </p>
            <Button autoFocus onClick={onClose} className="self-end">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="request-message" className="text-body-sm font-semibold">
                Message to the owner <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="request-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                aria-describedby="request-count"
                className="rounded-md border border-transparent bg-surface px-4 py-3 text-body outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25"
                placeholder="Say what you would like to add or fix"
              />
              <span
                id="request-count"
                className={`self-end text-caption tabular-nums ${message.trim().length > MAX ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
              >
                {message.trim().length} / {MAX}
              </span>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
