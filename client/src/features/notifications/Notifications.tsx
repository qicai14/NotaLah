import { Bell, Flag, GraduationCap, TriangleAlert } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMessage } from '@/components/PageMessage';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { timeAgo } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { cn } from '@/lib/utils';
import { CollabRequestActions } from '../collaboration/CollabRequestActions';
import { describe, FILTERS, isRead, liveItems, section } from './helpers';
import { useNotifications } from './NotificationsContext';
import type { Notification } from './types';

type Decided = 'approve' | 'decline';

/** Lead for rows with no actor: moderation and system outcomes get an icon instead of an avatar. */
function SystemIcon({ type }: { type: Notification['type'] }) {
  const Icon =
    type === 'note_hidden'
      ? Flag
      : type === 'edited_since_verification'
        ? TriangleAlert
        : type === 'lecturer_approved' || type === 'lecturer_rejected'
          ? GraduationCap
          : Bell;
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-strong">
      <Icon className="size-5" />
    </span>
  );
}

function Row({
  n,
  read,
  decided,
  onOpen,
  onDecided,
}: {
  n: Notification;
  read: boolean;
  decided?: Decided;
  onOpen: () => void;
  onDecided: (d: Decided) => void;
}) {
  const { text, to } = describe(n);
  const name = n.actor?.displayName;
  const pending = n.type === 'collab_request' && n.requestStatus === 'pending' && !decided;
  const body: ReactNode = (
    <>
      {n.actor ? <UserAvatar name={n.actor.displayName} className="size-10 shrink-0" /> : <SystemIcon type={n.type} />}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-body break-words', !read && 'font-medium')}>
          {name && <span className="font-bold">{name} </span>}
          {text}
        </span>
        <span className="block text-body-sm text-muted-foreground">{timeAgo(n.createdAt)}</span>
      </span>
    </>
  );
  const status = decided ?? (n.type === 'collab_request' && n.requestStatus !== 'pending' ? n.requestStatus : null);
  return (
    <li className={cn('rounded-md px-2 py-3', !read && 'bg-surface')}>
      <div className="flex items-start gap-3">
        {to ? (
          <Link
            to={to}
            onClick={onOpen}
            className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {body}
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{body}</div>
        )}
        {!read && (
          <span className="mt-2 flex shrink-0 items-center gap-1 text-caption font-semibold text-primary">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
            <span className="sr-only">Unread</span>
          </span>
        )}
      </div>
      {pending && n.note && n.requestId && (
        <div className="mt-2 pl-13">
          <CollabRequestActions
            noteId={n.note.id}
            requestId={n.requestId}
            name={name ?? 'this person'}
            onDecided={onDecided}
          />
        </div>
      )}
      {status && (
        <p className="mt-1 pl-13 text-body-sm font-semibold text-muted-foreground">
          {status.startsWith('approve') ? 'Approved' : 'Declined'}
        </p>
      )}
    </li>
  );
}

/** The notifications inbox (R8, wireframes 43 and 44): filter chips, rows by day, mark read, live rows, paging. */
export default function Notifications() {
  const [filter, setFilter] = useState(0);
  const types = FILTERS[filter].types;
  const path = types ? `/notifications?type=${types.join(',')}` : '/notifications';
  const list = usePaged<Notification>(path, 'notifications');
  const { unread, fresh, markRead } = useNotifications();
  const [readIds, setReadIds] = useState<ReadonlySet<number>>(new Set());
  const [readUpTo, setReadUpTo] = useState(0);
  const [decided, setDecided] = useState<Record<number, Decided>>({});
  const [failed, setFailed] = useState(false);

  const items = [...liveItems(fresh, list.items, types), ...list.items];
  const reading = (n: Notification) => isRead(n, readIds, readUpTo);

  const open = (n: Notification) => {
    if (reading(n)) return;
    setReadIds((s) => new Set(s).add(n.id));
    void markRead([n.id]);
  };
  const markAll = async () => {
    const top = Math.max(0, ...items.map((n) => n.id));
    const ok = await markRead();
    setFailed(!ok);
    if (ok) setReadUpTo(top);
  };

  let last = '';
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={markAll} disabled={unread === 0}>
          Mark all read
        </Button>
      </div>

      <div role="group" aria-label="Filter notifications" className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f, i) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={i === filter}
            onClick={() => setFilter(i)}
            className={cn(
              'h-9 cursor-pointer rounded-full px-4 text-body-sm font-semibold transition-colors duration-(--duration-fast) outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              i === filter ? 'bg-foreground text-background' : 'bg-surface text-foreground hover:bg-surface-strong',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(list.error || failed) && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
        >
          {list.error ?? 'Could not mark notifications read. Try again.'}
        </p>
      )}
      {list.loading && (
        <p role="status" className="py-10 text-center text-body-sm text-muted-foreground">
          Loading notifications…
        </p>
      )}
      {!list.loading && !list.error && items.length === 0 && (
        <PageMessage
          title="Nothing here yet"
          body="Mentions, Super Likes, follows and requests will show up here as they happen."
        />
      )}

      <ul className="mt-4 flex flex-col">
        {items.map((n) => {
          const s = section(n.createdAt);
          const heading = s !== last ? s : null;
          last = s;
          return (
            <li key={n.id} className="list-none">
              {heading && <h2 className="px-2 pt-4 pb-1 text-body-sm font-bold text-muted-foreground">{heading}</h2>}
              <ul>
                <Row
                  n={n}
                  read={reading(n)}
                  decided={decided[n.id]}
                  onOpen={() => open(n)}
                  onDecided={(d) => {
                    setDecided((m) => ({ ...m, [n.id]: d }));
                    open(n);
                  }}
                />
              </ul>
            </li>
          );
        })}
      </ul>

      {list.hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={list.loadMore} disabled={list.loadingMore}>
            {list.loadingMore ? 'Loading…' : 'Show more'}
          </Button>
        </div>
      )}
    </div>
  );
}
