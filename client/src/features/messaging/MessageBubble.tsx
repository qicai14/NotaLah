import { CornerUpLeft, FileText, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { shortTime } from './helpers';
import type { Message } from './types';

/** One message: a bubble (mine right in the brand colour, theirs left on surface), quoted reply, note card and actions. */
export function MessageBubble({
  message: m,
  mine,
  showName,
  showTime,
  quotedName,
  seen,
  onReply,
  onDelete,
}: {
  message: Message;
  mine: boolean;
  showName: boolean;
  showTime: boolean;
  quotedName: string | null;
  seen: string | null;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [actions, setActions] = useState(false);
  const bubble = cn(
    'max-w-full rounded-xl px-3.5 py-2 text-body wrap-anywhere whitespace-pre-wrap',
    mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-surface text-foreground',
  );

  return (
    <li id={`message-${m.id}`} className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
      {showName && !mine && (
        <p className="mb-0.5 px-1 text-caption font-semibold text-muted-foreground">{m.sender.displayName}</p>
      )}
      <div className={cn('flex max-w-[85%] items-end gap-1', mine && 'flex-row-reverse')}>
        <div className="min-w-0">
          {m.deleted ? (
            <p className="rounded-xl border border-dashed px-3.5 py-2 text-body-sm text-muted-foreground italic">
              Message deleted
            </p>
          ) : (
            <div className={bubble}>
              {m.replyTo && (
                <a
                  href={`#message-${m.replyTo.id}`}
                  className={cn(
                    'mb-1.5 block rounded-sm border-l-2 px-2 py-1 text-caption no-underline',
                    mine ? 'border-primary-foreground/70 bg-primary-foreground/15' : 'border-primary bg-background/60',
                  )}
                >
                  <span className="block font-semibold">{quotedName ?? 'Message'}</span>
                  <span className="line-clamp-2">{m.replyTo.body ?? 'Message deleted'}</span>
                </a>
              )}
              {m.note && (
                <Link
                  to={`/notes/${m.note.id}`}
                  className="mb-1 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-card-foreground no-underline hover:bg-accent"
                >
                  <FileText aria-hidden="true" className="size-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block text-caption text-muted-foreground">Shared note</span>
                    <span className="line-clamp-2 text-body-sm font-semibold">{m.note.title}</span>
                  </span>
                </Link>
              )}
              {m.noteUnavailable && (
                <p className="mb-1 rounded-md border border-dashed border-border bg-card px-3 py-2 text-body-sm text-muted-foreground">
                  This note is no longer available to you.
                </p>
              )}
              {m.body}
            </div>
          )}
        </div>
        {!m.deleted && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Message actions"
            aria-expanded={actions}
            onClick={() => setActions((a) => !a)}
            className={cn(
              'shrink-0 text-muted-foreground focus-visible:opacity-100',
              !actions && 'md:opacity-0 md:group-hover:opacity-100',
            )}
          >
            <MoreHorizontal aria-hidden="true" />
          </Button>
        )}
      </div>
      {actions && !m.deleted && (
        <div className="mt-1 flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => {
              setActions(false);
              onReply();
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-body-sm font-semibold hover:bg-accent"
          >
            <CornerUpLeft aria-hidden="true" className="size-4" />
            Reply
          </button>
          {mine && <ConfirmButton label="Delete" onConfirm={onDelete} />}
        </div>
      )}
      {(showTime || seen) && (
        <p className="mt-0.5 px-1 text-caption text-muted-foreground">
          {showTime && <time dateTime={m.createdAt}>{shortTime(m.createdAt)}</time>}
          {showTime && seen && ' · '}
          {seen && <span className="font-semibold">{seen}</span>}
        </p>
      )}
    </li>
  );
}
