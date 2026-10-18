import { MessageSquarePlus, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/AuthContext';
import { conversationTitle, previewText, shortTime } from './helpers';
import { useMessaging } from './MessagingContext';
import { timeAgo } from '@/lib/format';
import type { Conversation, MessageRequest } from './types';

export type InboxTab = 'chats' | 'requests';

const TABS: { id: InboxTab; label: string }[] = [
  { id: 'chats', label: 'Chats' },
  { id: 'requests', label: 'Requests' },
];

/** Wireframes 45 and 46: the inbox pane. Chats (newest activity first, unread counts) and message requests. */
export function ConversationList({ activeId, tab }: { activeId: number | null; tab: InboxTab }) {
  const { inbox, error, loadMoreConversations, loadMoreRequests } = useMessaging();
  const more = useAction();
  const requests = inbox.requests.items.length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-topbar shrink-0 items-center justify-between gap-2 px-4">
        <h1 className="text-title font-bold">Messages</h1>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" title="New group">
            <Link to="/messages/new-group" aria-label="New group">
              <UsersRound aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" title="New chat">
            <Link to="/messages/new" aria-label="New chat">
              <MessageSquarePlus aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </header>

      <nav aria-label="Inbox" className="flex shrink-0 gap-6 border-b px-4">
        {TABS.map((t) => (
          <Link
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            to={t.id === 'chats' ? '/messages' : '/messages?tab=requests'}
            className={cn(
              '-mb-px flex h-11 items-center gap-1.5 border-b-2 text-body-sm font-bold',
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.id === 'requests' && requests > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-foreground px-1.5 text-caption text-background tabular-nums">
                {requests}
              </span>
            )}
          </Link>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(var(--spacing-tabbar)+0.5rem)] md:pb-2">
        {error && (
          <p role="alert" className="px-4 py-3 text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}
        {tab === 'chats' ? (
          <Chats
            activeId={activeId}
            loaded={inbox.conversationsLoaded}
            items={inbox.conversations.items}
            hasMore={inbox.conversations.next !== null}
            pending={more.pending}
            onMore={() => more.run(loadMoreConversations)}
          />
        ) : (
          <Requests
            loaded={inbox.requestsLoaded}
            items={inbox.requests.items}
            hasMore={inbox.requests.next !== null}
            pending={more.pending}
            onMore={() => more.run(loadMoreRequests)}
          />
        )}
        {more.error && (
          <p role="alert" className="px-4 py-2 text-body-sm font-medium text-destructive">
            {more.error}
          </p>
        )}
      </div>
    </div>
  );
}

function Chats({
  activeId,
  loaded,
  items,
  hasMore,
  pending,
  onMore,
}: {
  activeId: number | null;
  loaded: boolean;
  items: Conversation[];
  hasMore: boolean;
  pending: boolean;
  onMore(): void;
}) {
  const { user } = useAuth();
  const me = user!.id;
  if (!loaded)
    return (
      <p role="status" className="px-4 py-6 text-body-sm text-muted-foreground">
        Loading conversations…
      </p>
    );
  if (items.length === 0)
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-title font-bold">No conversations yet</p>
        <p className="mt-1 text-body text-muted-foreground">Message a friend to start a chat, or make a group.</p>
        <Button asChild className="mt-4">
          <Link to="/messages/new">New chat</Link>
        </Button>
      </div>
    );
  return (
    <>
      <ul>
        {items.map((c) => {
          const title = conversationTitle(c, me);
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <Link
                to={`/messages/${c.id}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-[4.5rem] items-center gap-3 px-4 py-2 transition-colors duration-(--duration-fast)',
                  active ? 'bg-surface-strong' : 'hover:bg-accent',
                )}
              >
                <UserAvatar name={title} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate text-body', c.unreadCount ? 'font-bold' : 'font-semibold')}>
                      {title}
                    </span>
                    {c.lastMessage && (
                      <time dateTime={c.lastMessage.createdAt} className="shrink-0 text-caption text-muted-foreground">
                        {shortTime(c.lastMessage.createdAt)}
                      </time>
                    )}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'truncate text-body-sm',
                        c.unreadCount ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        c.lastMessage?.deleted && 'italic',
                      )}
                    >
                      {previewText(c, me)}
                    </span>
                    {c.unreadCount > 0 && (
                      <span
                        role="img"
                        aria-label={`${c.unreadCount} unread`}
                        className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-caption font-bold text-primary-foreground tabular-nums"
                      >
                        {c.unreadCount > 99 ? '99+' : c.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <div className="flex justify-center py-3">
          <Button variant="secondary" size="sm" disabled={pending} onClick={onMore}>
            Show more conversations
          </Button>
        </div>
      )}
    </>
  );
}

function Requests({
  loaded,
  items,
  hasMore,
  pending,
  onMore,
}: {
  loaded: boolean;
  items: MessageRequest[];
  hasMore: boolean;
  pending: boolean;
  onMore(): void;
}) {
  if (!loaded)
    return (
      <p role="status" className="px-4 py-6 text-body-sm text-muted-foreground">
        Loading requests…
      </p>
    );
  if (items.length === 0)
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-title font-bold">No message requests</p>
        <p className="mt-1 text-body text-muted-foreground">
          When someone who is not your friend messages you, it waits here until you accept.
        </p>
      </div>
    );
  return (
    <>
      <ul>
        {items.map((r) => (
          <RequestRow key={r.id} request={r} />
        ))}
      </ul>
      {hasMore && (
        <div className="flex justify-center py-3">
          <Button variant="secondary" size="sm" disabled={pending} onClick={onMore}>
            Show more requests
          </Button>
        </div>
      )}
    </>
  );
}

/** Wireframe 48: a non-friend's first message waits for Accept or Decline. Accepting opens the chat and makes no follow. */
function RequestRow({ request: r }: { request: MessageRequest }) {
  const { dispatch, fetchConversation } = useMessaging();
  const navigate = useNavigate();
  const accept = useAction();
  const decline = useAction();
  const busy = accept.pending || decline.pending;

  const onAccept = async () => {
    const out = await accept.run(() =>
      api<{ conversationId: number }>(`/message-requests/${r.id}/accept`, { method: 'POST' }),
    );
    if (!out) return;
    dispatch({ type: 'requestGone', id: r.id });
    await fetchConversation(out.conversationId);
    navigate(`/messages/${out.conversationId}`);
  };
  const onDecline = async () => {
    const out = await decline.run(() => api(`/message-requests/${r.id}/decline`, { method: 'POST' }));
    if (out !== undefined) dispatch({ type: 'requestGone', id: r.id });
  };

  return (
    <li className="border-b px-4 py-3">
      <div className="flex items-center gap-3">
        <UserAvatar name={r.sender.displayName} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-semibold">
            <Link to={`/users/${r.sender.id}`} className="hover:underline">
              {r.sender.displayName}
            </Link>
          </p>
          <p className="text-caption text-muted-foreground">Not your friend · {timeAgo(r.createdAt)}</p>
        </div>
      </div>
      <p className="mt-2 rounded-md bg-surface px-3 py-2 text-body wrap-anywhere whitespace-pre-wrap">{r.body}</p>
      {r.note && (
        <Link
          to={`/notes/${r.note.id}`}
          className="mt-2 block rounded-md border border-border px-3 py-2 text-body-sm hover:bg-accent"
        >
          <span className="block text-caption text-muted-foreground">Shared note</span>
          <span className="font-semibold">{r.note.title}</span>
        </Link>
      )}
      {r.noteUnavailable && (
        <p className="mt-2 text-body-sm text-muted-foreground">A note was shared that you cannot open.</p>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={onDecline}>
          Decline
        </Button>
        <Button size="sm" disabled={busy} onClick={onAccept}>
          {accept.pending ? 'Accepting…' : 'Accept'}
        </Button>
      </div>
      {(accept.error || decline.error) && (
        <p role="alert" className="mt-2 text-body-sm font-medium text-destructive">
          {accept.error ?? decline.error}
        </p>
      )}
    </li>
  );
}
