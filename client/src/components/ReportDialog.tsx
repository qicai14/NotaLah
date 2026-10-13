import { type FormEvent, useState } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { api, ApiError } from '../lib/api';
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
  const approved = user?.role === 'lecturer' && user.lecturerStatus === 'approved';
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
      setError(err instanceof ApiError ? (err.errors && Object.values(err.errors)[0]) || err.message : 'Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Report this note" onClose={onClose}>
      {done ? (
        <div>
          <p role="status">Thanks. Your report was sent to the moderators.</p>
          <button type="button" onClick={onClose} className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-white">
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
            <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} className="rounded-md border border-slate-300 px-3 py-2" />
            <span className={`text-xs ${details.length > 500 ? 'text-red-600' : 'text-slate-500'}`}>{details.length}/500</span>
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-white disabled:opacity-60">
              {busy ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
