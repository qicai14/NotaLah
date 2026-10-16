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
        <p className="text-sm text-muted-foreground">
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
            className="rounded-md border border-input bg-background px-3 py-2 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
          <span className={`text-xs ${remark.length > 300 ? 'text-destructive' : 'text-muted-foreground'}`}>
            {remark.length}/300
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
            className="h-10 rounded-full bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? 'Verifying…' : 'Super Like'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
