import { type FormEvent, useState } from 'react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { api, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Comment, CommentReply } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { LecturerBadge } from '../../components/LecturerBadge';

const MAX = 1000;

function Composer({ noteId, slideCount, parentId, onDone, onCancel }: {
  noteId: number; slideCount: number; parentId?: number; onDone(): void; onCancel?(): void;
}) {
  const [body, setBody] = useState('');
  const [slideNo, setSlideNo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idp = `c-${parentId ?? 'new'}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError('Comment is required');
    if (body.length > MAX) return setError(`Comment must be at most ${MAX} characters`);
    setBusy(true);
    setError(null);
    try {
      await api(`/notes/${noteId}/comments`, {
        method: 'POST',
        body: { body, ...(slideNo ? { slideNo: Number(slideNo) } : {}), ...(parentId ? { parentId } : {}) },
      });
      setBody('');
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={`${idp}-body`} className="text-sm font-medium">
        {parentId ? 'Your reply' : 'Add a comment'}
      </label>
      <textarea id={`${idp}-body`} value={body} onChange={(e) => setBody(e.target.value)} rows={parentId ? 2 : 3} className="rounded-md border border-slate-300 px-3 py-2" />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className={body.length > MAX ? 'text-red-600' : 'text-slate-500'}>
          {body.length}/{MAX}
        </span>
        {!parentId && slideCount > 0 && (
          <label className="flex items-center gap-1">
            Slide
            <select value={slideNo} onChange={(e) => setSlideNo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1">
              <option value="">Whole note</option>
              {Array.from({ length: slideCount }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-1.5 text-white disabled:opacity-60">
          {busy ? 'Posting…' : parentId ? 'Reply' : 'Post comment'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border border-slate-300 px-4 py-1.5">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function CommentRow({ c, pinned, canReply, replying, onReply, onChanged, onError }: {
  c: CommentReply; pinned?: boolean; canReply: boolean; replying: boolean; onReply(): void; onChanged(): void; onError(m: string): void;
}) {
  const { user } = useAuth();
  const deleted = c.author === null;
  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      onChanged();
    } catch (e) {
      onError(errorText(e));
    }
  }
  return (
    <div className={pinned ? 'rounded-md bg-indigo-50 p-2' : ''}>
      {!deleted && <p className="text-sm text-slate-600">
        <span className="font-medium text-slate-900">{c.author!.displayName}</span>
        {c.author!.isVerifiedLecturer && <LecturerBadge />}{' '}
        · {timeAgo(c.createdAt)}
        {pinned && <span className="ml-2 rounded bg-indigo-600 px-1.5 text-xs text-white">Pinned lecturer comment</span>}
        {c.slideNo && <span className="ml-2 rounded bg-slate-200 px-1.5 text-xs">Slide {c.slideNo}</span>}
      </p>}
      <p className={`whitespace-pre-wrap ${deleted ? 'italic text-slate-500' : ''}`}>{c.body}</p>
      {!deleted && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={c.likedByMe}
            aria-label={`Like comment, ${c.likes} likes`}
            onClick={() => act(() => api(`/comments/${c.id}/like`, { method: c.likedByMe ? 'DELETE' : 'POST' }))}
            className={`rounded-md border px-2 py-0.5 text-sm ${c.likedByMe ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'}`}
          >
            {c.likedByMe ? 'Liked' : 'Like'} ({c.likes})
          </button>
          {canReply && !replying && (
            <button type="button" onClick={onReply} className="rounded-md border border-slate-300 px-2 py-0.5 text-sm">
              Reply
            </button>
          )}
          {c.author!.id === user?.id && <ConfirmButton label="Delete" onConfirm={() => act(() => api(`/comments/${c.id}`, { method: 'DELETE' }))} />}
        </div>
      )}
    </div>
  );
}

export function CommentPanel({ noteId, slideCount }: { noteId: number; slideCount: number }) {
  // shortcut: first 100 top-level comments only (the API maximum); "load more" with nextCursor comes with the redesign
  const { data, error, loading, reload } = useFetch<{ comments: Comment[] }>(`/notes/${noteId}/comments?limit=100`);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const common = { onChanged: () => (setActionError(null), reload()), onError: setActionError };

  return (
    <section aria-labelledby="comments-h" className="mt-6">
      <h2 id="comments-h" className="mb-3 text-lg font-semibold">
        Comments
      </h2>
      {loading && <p>Loading…</p>}
      {(error || actionError) && (
        <p role="alert" className="mb-2 text-red-600">
          {error ?? actionError}
        </p>
      )}
      {data?.comments.length === 0 && <p className="mb-3 text-slate-600">No comments yet.</p>}
      <ul className="mb-4 flex flex-col gap-4">
        {data?.comments.map((c) => (
          <li key={c.id}>
            <CommentRow c={c} pinned={c.pinned} canReply replying={replyTo === c.id} onReply={() => setReplyTo(c.id)} {...common} />
            {(c.replies.length > 0 || replyTo === c.id) && (
              <ul className="ml-5 mt-2 flex flex-col gap-3 border-l-2 border-slate-200 pl-3">
                {c.replies.map((r) => (
                  <li key={r.id}>
                    <CommentRow c={r} canReply={false} replying={false} onReply={() => {}} {...common} />
                  </li>
                ))}
                {replyTo === c.id && (
                  <li>
                    <Composer noteId={noteId} slideCount={slideCount} parentId={c.id} onCancel={() => setReplyTo(null)} onDone={() => (setReplyTo(null), reload())} />
                  </li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <Composer noteId={noteId} slideCount={slideCount} onDone={reload} />
    </section>
  );
}
