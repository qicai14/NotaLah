import { type FormEvent, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api, errorText } from '../lib/api';
import { isApprovedLecturer } from '../lib/roles';
import { Dialog } from './Dialog';

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

export function ReportDialog({ noteId, onClose }: { noteId: number; onClose(): void }) {
  const { user } = useAuth();
  const approved = isApprovedLecturer(user);
  const reasons = approved ? [...COMMON, ...LECTURER] : COMMON;
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason) return setError('Choose a reason');
    if (details.length > 500) return setError('Details must be at most 500 characters');
    setBusy(true);
    setError(null);
    try {
      await api(`/notes/${noteId}/report`, { method: 'POST', body: { reason, details: details.trim() || null } });
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Report this note" onClose={onClose}>
      {done ? (
        <div>
          <p role="status">Thanks. Your report was sent to the moderators.</p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="mt-4 h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground"
          >
            Close
          </button>
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
            <button type="button" onClick={onClose} className="h-10 rounded-full px-5 font-semibold hover:bg-accent">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-full bg-destructive px-5 font-semibold text-destructive-foreground disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
