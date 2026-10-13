import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmButton } from '../../components/ConfirmButton';
import { api, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { DraftSummary } from '../../types';

export default function Drafts() {
  const { data, setData, error, loading } = useFetch<{ notes: DraftSummary[] }>('/notes/drafts');
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(id: number) {
    setActionError(null);
    try {
      await api(`/notes/${id}`, { method: 'DELETE' });
      setData((d) => d && { notes: d.notes.filter((n) => n.id !== id) });
    } catch (e) {
      setActionError(errorText(e));
    }
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Drafts</h1>
        <Link to="/notes/new" className="rounded-md bg-indigo-600 px-3 py-1.5 text-white">
          New note
        </Link>
      </div>
      {loading && <p>Loading…</p>}
      {(error || actionError) && (
        <p role="alert" className="text-red-600">
          {error ?? actionError}
        </p>
      )}
      {data?.notes.length === 0 && <p className="text-slate-600">No drafts. Start a note and use Save Draft to keep it here.</p>}
      <ul className="flex flex-col gap-3">
        {data?.notes.map((n) => (
          <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div>
              <p className="font-medium">{n.title}</p>
              <p className="text-sm text-slate-600">
                {n.module?.code ?? 'No module'} · edited {timeAgo(n.updatedAt)}
                {n.hashtags.length > 0 && ` · ${n.hashtags.map((h) => `#${h}`).join(' ')}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/notes/${n.id}/edit`} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
                Edit
              </Link>
              <ConfirmButton label="Delete" onConfirm={() => remove(n.id)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
