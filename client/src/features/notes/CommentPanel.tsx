import { Heart, Pin } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAction } from '@/lib/useAction';
import { cn } from '@/lib/utils';
import { ConfirmButton } from '../../components/ConfirmButton';
import { LecturerBadge } from '../../components/LecturerBadge';
import { api, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Comment, CommentReply } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useFriends } from '../messaging/helpers';
import { findMention, insertMention, mentionIds, type Person, suggest } from './mentions';
import { useGuestPrompt } from '../auth/GuestPrompt';

const MAX = 1000;

function Composer({
  noteId,
  slideCount,
  parentId,
  people,
  onDone,
  onCancel,
}: {
  noteId: number;
  slideCount: number;
  parentId?: number;
  /** Thread participants; friends are added here. Together they are who the server lets a comment mention. */
  people: Person[];
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [body, setBody] = useState('');
  const [slideNo, setSlideNo] = useState('');
  const { run, pending, error, setError } = useAction();
  const idp = `c-${parentId ?? 'new'}`;
  const { friends } = useFriends();
  const [picked, setPicked] = useState<Map<number, string>>(new Map());
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const nextCaret = useRef<number | null>(null);
  const mention = dismissed ? null : findMention(body, caret);
  const options = mention ? suggest([...people, ...friends], mention.query) : [];
  const open = options.length > 0;

  useEffect(() => {
    if (nextCaret.current === null) return;
    field.current?.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [body]);

  const choose = (p: Person) => {
    if (!mention) return;
    const r = insertMention(body, mention.start, caret, p.displayName);
    setBody(r.text);
    setCaret(r.caret);
    nextCaret.current = r.caret;
    setPicked((m) => new Map(m).set(p.id, p.displayName));
    setActive(0);
    field.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      choose(options[active] ?? options[0]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDismissed(true);
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError('Comment is required');
    if (body.length > MAX) return setError(`Comment must be at most ${MAX} characters`);
    const ids = mentionIds(body, picked);
    const ok = await run(async () => {
      await api(`/notes/${noteId}/comments`, {
        method: 'POST',
        body: {
          body,
          ...(slideNo ? { slideNo: Number(slideNo) } : {}),
          ...(parentId ? { parentId } : {}),
          ...(ids.length ? { mentions: ids } : {}),
        },
      });
      return true;
    });
    if (ok) {
      setBody('');
      setPicked(new Map());
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor={`${idp}-body`} className="sr-only">
        {parentId ? 'Your reply' : 'Add a comment'}
      </label>
      <div className="relative flex items-end gap-2">
        {open && (
          <ul
            id={`${idp}-people`}
            role="listbox"
            aria-label="Mention someone"
            className="absolute right-0 bottom-full left-0 z-10 mb-1 max-h-56 overflow-y-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-(--shadow-float)"
          >
            {options.map((p, i) => (
              <li
                key={p.id}
                id={`${idp}-person-${p.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => (e.preventDefault(), choose(p))}
                className={cn(
                  'flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-body-sm font-semibold',
                  i === active && 'bg-accent',
                )}
              >
                <UserAvatar name={p.displayName} className="size-6" />
                {p.displayName}
              </li>
            ))}
          </ul>
        )}
        <textarea
          id={`${idp}-body`}
          ref={field}
          value={body}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? `${idp}-people` : undefined}
          aria-activedescendant={open && options[active] ? `${idp}-person-${options[active].id}` : undefined}
          aria-autocomplete="list"
          onKeyDown={onKeyDown}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onChange={(e) => {
            setBody(e.target.value);
            setCaret(e.target.selectionStart);
            setActive(0);
            setDismissed(false);
          }}
          rows={parentId ? 2 : 1}
          placeholder={parentId ? 'Write a reply' : 'Add a comment'}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${idp}-count`}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-[1.375rem] border border-input bg-background px-4 py-2.5 text-body outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? 'Posting…' : parentId ? 'Reply' : 'Post'}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-caption">
        <span
          id={`${idp}-count`}
          className={body.length > MAX ? 'font-semibold text-destructive' : 'text-muted-foreground'}
        >
          {body.length}/{MAX}
        </span>
        <div className="flex items-center gap-3">
          {!parentId && slideCount > 0 && (
            <label className="flex items-center gap-1.5 font-semibold">
              Slide
              <select
                value={slideNo}
                onChange={(e) => setSlideNo(e.target.value)}
                className="h-8 cursor-pointer rounded-full border border-input bg-background px-2.5 text-caption"
              >
                <option value="">Whole note</option>
                {Array.from({ length: slideCount }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="px-1 text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function CommentRow({
  c,
  pinned,
  noteAuthorId,
  canReply,
  replying,
  onReply,
  onChanged,
  onError,
}: {
  c: CommentReply;
  pinned?: boolean;
  noteAuthorId?: number;
  canReply: boolean;
  replying: boolean;
  onReply: () => void;
  onChanged: () => void;
  onError: (m: string) => void;
}) {
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const { run } = useAction();
  const deleted = c.author === null;
  const act = async (fn: () => Promise<unknown>) => {
    const ok = await run(
      async () => (await fn(), true),
      (e) => (onError(errorText(e)), null),
    );
    if (ok) onChanged();
  };

  if (deleted) return <p className="py-1 pl-13 text-body-sm text-muted-foreground italic">{c.body}</p>;
  const author = c.author!;
  return (
    <div className={cn('flex gap-3', pinned && '-mx-3 rounded-lg bg-surface p-3')}>
      <UserAvatar name={author.displayName} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        {pinned && (
          <p className="mb-0.5 flex items-center gap-1 text-caption font-semibold text-muted-foreground">
            <Pin className="size-3" aria-hidden="true" /> Pinned lecturer comment
          </p>
        )}
        <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
          <span className="font-bold">{author.displayName}</span>
          {author.isVerifiedLecturer && <LecturerBadge />}
          {author.id === noteAuthorId && (
            <span className="rounded-sm bg-surface-strong px-1.5 text-caption font-semibold">Author</span>
          )}
        </p>
        <p className="mt-0.5 text-body break-words whitespace-pre-wrap">{c.body}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-caption text-muted-foreground">
          <span>{timeAgo(c.createdAt)}</span>
          {c.slideNo && <span className="rounded-sm bg-surface-strong px-1.5 font-semibold">Slide {c.slideNo}</span>}
          {canReply && !replying && (
            <button
              type="button"
              onClick={() => (user ? onReply() : askToLogIn({ action: 'comment' }))}
              className="font-semibold hover:text-foreground"
            >
              Reply
            </button>
          )}
          {author.id === user?.id && (
            <ConfirmButton label="Delete" onConfirm={() => act(() => api(`/comments/${c.id}`, { method: 'DELETE' }))} />
          )}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={user ? c.likedByMe : undefined}
        aria-label={`Like comment, ${c.likes} likes`}
        onClick={() =>
          user
            ? act(() => api(`/comments/${c.id}/like`, { method: c.likedByMe ? 'DELETE' : 'POST' }))
            : askToLogIn({ action: 'like' })
        }
        className="flex w-8 shrink-0 cursor-pointer flex-col items-center gap-0.5 self-start pt-1 text-caption text-muted-foreground hover:text-foreground"
      >
        <Heart aria-hidden="true" className={cn('size-5', c.likedByMe && 'fill-like text-like')} />
        <span className="tabular-nums">{c.likes}</span>
      </button>
    </div>
  );
}

/**
 * Comments for one note (FR16, wireframes 11, 14): pinned lecturer comment first, one reply level, composer at the
 * bottom. Fills its parent's height and scrolls the list. Guests read comments; writing opens the R31 sheet.
 */
export function CommentPanel({
  noteId,
  slideCount,
  noteAuthorId,
  heading = true,
  className,
}: {
  noteId: number;
  slideCount: number;
  noteAuthorId?: number;
  heading?: boolean;
  className?: string;
}) {
  // shortcut: first 100 top-level comments only (the API maximum); "load more" with nextCursor is still to come
  const { data, error, loading, reload } = useFetch<{ comments: Comment[] }>(`/notes/${noteId}/comments?limit=100`);
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const headingId = useId();
  const people: Person[] = (data?.comments ?? [])
    .flatMap((c) => [c, ...c.replies])
    .flatMap((c) => (c.author && c.author.id !== user?.id ? [c.author] : []));
  const common = { onChanged: () => (setActionError(null), reload()), onError: setActionError, noteAuthorId };

  return (
    <section
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : 'Comments'}
      className={cn('flex min-h-0 flex-col', className)}
    >
      {heading && (
        <h2 id={headingId} className="px-5 pt-5 pb-3 text-title-sm font-bold">
          Comments
        </h2>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {loading && <p className="py-6 text-center text-body-sm text-muted-foreground">Loading comments…</p>}
        {(error || actionError) && (
          <p
            role="alert"
            className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
          >
            {error ?? actionError}
          </p>
        )}
        {data?.comments.length === 0 && (
          <p className="py-10 text-center text-body-sm text-muted-foreground">No comments yet. Start the discussion.</p>
        )}
        <ul className="flex flex-col gap-5">
          {data?.comments.map((c) => (
            <li key={c.id}>
              <CommentRow
                c={c}
                pinned={c.pinned}
                canReply
                replying={replyTo === c.id}
                onReply={() => setReplyTo(c.id)}
                {...common}
              />
              {(c.replies.length > 0 || replyTo === c.id) && (
                <ul className="mt-4 ml-13 flex flex-col gap-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentRow c={r} canReply={false} replying={false} onReply={() => {}} {...common} />
                    </li>
                  ))}
                  {replyTo === c.id && (
                    <li>
                      <Composer
                        noteId={noteId}
                        slideCount={slideCount}
                        parentId={c.id}
                        people={people}
                        onCancel={() => setReplyTo(null)}
                        onDone={() => (setReplyTo(null), reload())}
                      />
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t bg-background px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {user ? (
          <Composer noteId={noteId} slideCount={slideCount} people={people} onDone={reload} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-body-sm text-muted-foreground">Log in to comment.</p>
            <Button onClick={() => askToLogIn({ action: 'comment', returnTo: `/notes/${noteId}` })}>Log in</Button>
          </div>
        )}
      </div>
    </section>
  );
}
