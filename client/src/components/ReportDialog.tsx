import { type FormEvent, type RefObject, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAction } from '@/lib/useAction';
import { useAuth } from '../features/auth/AuthContext';
import { api } from '../lib/api';
import { isApprovedLecturer } from '../lib/roles';

const COMMON = [
  ['inaccurate', 'Inaccurate content'],
  ['inappropriate', 'Inappropriate content'],
  ['spam', 'Spam'],
  ['other', 'Other'],
];
const LECTURER = [
  ['plagiarism', 'Plagiarism'],
  ['copyright', 'Copyright infringement'],
];

/** Report a note (UC12, wireframe 41). `returnFocus` gets focus back when the dialog closes (the opener may be gone). */
export function ReportDialog({
  noteId,
  onClose,
  returnFocus,
}: {
  noteId: number;
  onClose: () => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const { user } = useAuth();
  const approved = isApprovedLecturer(user);
  const reasons = approved ? [...COMMON, ...LECTURER] : COMMON;
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  const { run, pending: busy, error, setError } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return setError('Choose a reason');
    if (details.length > 500) return setError('Details must be at most 500 characters');
    const ok = await run(async () => {
      await api(`/notes/${noteId}/report`, { method: 'POST', body: { reason, details: details.trim() || null } });
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
        <DialogTitle className="text-title font-bold">Report this note</DialogTitle>
        <DialogDescription className="text-body-sm text-muted-foreground">
          Moderators review every report. The author is not told who reported it.
        </DialogDescription>
        {done ? (
          <div>
            <p role="status">Thanks. Your report was sent to the moderators.</p>
            <Button autoFocus onClick={onClose} className="mt-4">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">Reason</legend>
              {reasons.map(([v, l]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="reason" value={v} checked={reason === v} onChange={() => setReason(v)} />
                  {l}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-col gap-1">
              <label htmlFor="report-details" className="text-sm font-medium">
                Details (optional)
              </label>
              <textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
              />
              <span className={`text-xs ${details.length > 500 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {details.length}/500
              </span>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy ? 'Sending…' : 'Send report'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
