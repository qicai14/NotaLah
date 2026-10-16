import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { NoteSummary } from '../../types';

export default function Saved() {
  // shortcut: first 50 saved notes only (API default page); "load more" with nextCursor comes with the redesign
  const { data, setData, error, loading } = useFetch<{ notes: NoteSummary[] }>('/bookmarks');
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(id: number) {
    setActionError(null);
    try {
      await api(`/notes/${id}/bookmark`, { method: 'DELETE' });
      setData((d) => d && { notes: d.notes.filter((n) => n.id !== id) });
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Saved notes</h1>
      {loading && <p>Loading…</p>}
      {(error || actionError) && (
        <p role="alert" className="text-destructive">
          {error ?? actionError}
        </p>
      )}
      {data?.notes.length === 0 && <p className="text-muted-foreground">Nothing saved yet. Use Save on a note in the feed.</p>}
      <ul className="flex flex-col gap-3">
        {data?.notes.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div>
              <Link to={`/notes/${n.id}`} className="font-medium text-primary">
                {n.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                {[
                  n.moduleCode,
                  `saved ${timeAgo(n.savedAt ?? null)}`,
                  n.verifiedBy && `Verified by ${n.verifiedBy}`,
                  n.hashtags.map((h) => `#${h}`).join(' '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(n.id)}
              aria-label={`Remove ${n.title} from saved`}
              className="rounded-md border border-input px-2 py-1 text-sm"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
