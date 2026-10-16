import { type FormEvent, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { api, errorText } from '../../lib/api';

/** Confirmation with an optional review remark before a lecturer verifies a note (UC19, wireframe 17). */
export function SuperLikeDialog({
  noteId,
  onDone,
  onClose,
}: {
  noteId: number;
  onDone(verifiedBy: string): void;
  onClose(): void;
}) {
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (remark.length > 300) return setError('Remark must be at most 300 characters');
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ verifiedBy: string }>(`/notes/${noteId}/verify`, {
        method: 'POST',
        body: { remark: remark.trim() || null },
      });
      onDone(r.verifiedBy);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <Dialog title="Super Like this note?" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-slate-700">
          The note gets a verified frame with your name, and ranks higher in every feed. You can remove it later.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="superlike-remark" className="text-sm font-medium">
            Review remark (optional)
          </label>
          <textarea
            id="superlike-remark"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            rows={3}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          <span className={`text-xs ${remark.length > 300 ? 'text-red-600' : 'text-slate-500'}`}>
            {remark.length}/300
          </span>
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
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? 'Verifying…' : 'Super Like'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
