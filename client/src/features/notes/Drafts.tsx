import { BOARD_WIDTH, boardHeight } from '@parp/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlideBoard } from '@/components/board/SlideBoard';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { api, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { DraftSummary } from '../../types';

/** Wireframe 30: drafts as tiles with their first slide, last edited first. */
export default function Drafts() {
  // shortcut: first 50 drafts only (API default page); "load more" with nextCursor comes with the redesign
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
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title font-bold">
          Drafts
          {data && data.notes.length > 0 && (
            <span className="ml-2 text-body font-semibold text-muted-foreground tabular-nums">{data.notes.length}</span>
          )}
        </h1>
        <Button asChild size="sm">
          <Link to="/notes/new">
            <Plus aria-hidden="true" />
            New note
          </Link>
        </Button>
      </div>
      {loading && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-surface motion-reduce:animate-none" />
          ))}
        </ul>
      )}
      {(error || actionError) && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
          {error ?? actionError}
        </p>
      )}
      {data?.notes.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-title font-bold">No drafts yet</p>
          <p className="text-body text-muted-foreground">Notes you start are saved here as you work.</p>
          <Button asChild>
            <Link to="/notes/new">Start a note</Link>
          </Button>
        </div>
      )}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data?.notes.map((n) => (
          <li
            key={n.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-card)"
          >
            <Link
              to={`/notes/${n.id}/edit`}
              className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="bg-surface-strong" style={{ aspectRatio: BOARD_WIDTH / boardHeight(n.aspect ?? '4:5') }}>
                {n.cover && (
                  <div inert aria-hidden="true" className="size-full">
                    <SlideBoard
                      slide={n.cover}
                      aspect={n.aspect}
                      assets={n.assets}
                      label={`First slide of ${n.title}`}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3 pb-2">
                <p className="line-clamp-2 text-body-sm font-semibold group-hover:underline">{n.title}</p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted-foreground">
                  {n.module && (
                    <span className="rounded-sm bg-surface-strong px-2 font-semibold text-foreground">
                      {n.module.code}
                    </span>
                  )}
                  <span>
                    Edited {timeAgo(n.updatedAt)} · {n.slideCount} {n.slideCount === 1 ? 'slide' : 'slides'}
                  </span>
                </p>
              </div>
            </Link>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 pb-3">
              <Button asChild variant="secondary" size="xs">
                <Link to={`/notes/${n.id}/edit`} aria-label={`Continue editing ${n.title}`}>
                  Continue editing
                </Link>
              </Button>
              <ConfirmButton label="Delete" onConfirm={() => remove(n.id)} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
