import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useAction } from '../../lib/useAction';
import { usePaged } from '../../lib/usePaged';
import type { NoteSummary } from '../../types';

/** The signed-in user's bookmarks, newest first, with Remove and a keyset "Show more". Used by /saved and the Saved tab on Profile. */
export function SavedNotes() {
  const saved = usePaged<NoteSummary>('/bookmarks', 'notes');
  const removal = useAction();

  const remove = async (id: number) => {
    if ((await removal.run(() => api(`/notes/${id}/bookmark`, { method: 'DELETE' }))) !== undefined)
      saved.remove((n) => n.id === id);
  };

  const error = saved.error ?? removal.error;
  return (
    <div>
      {saved.loading && (
        <p role="status" className="text-body-sm text-muted-foreground">
          Loading saved notes…
        </p>
      )}
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {saved.items.length === 0 && !saved.loading && !saved.error && (
        <div className="py-12 text-center">
          <p className="text-title font-bold">Nothing saved yet</p>
          <p className="mt-1 text-body text-muted-foreground">
            Use Save on a note in the feed and it will show up here.
          </p>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {saved.items.map((n) => (
          <li
            key={n.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-(--shadow-card)"
          >
            <div className="min-w-0">
              <Link to={`/notes/${n.id}`} className="text-title-sm font-semibold hover:underline">
                {n.title}
              </Link>
              <p className="text-body-sm text-muted-foreground">
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="max-md:min-h-11"
              disabled={removal.pending}
              onClick={() => remove(n.id)}
              aria-label={`Remove ${n.title} from saved`}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {saved.hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" disabled={saved.loadingMore} onClick={saved.loadMore}>
            Show more saved notes
          </Button>
        </div>
      )}
    </div>
  );
}
