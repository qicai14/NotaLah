import { ArrowLeft, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { api, ApiError, errorText } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { useFetch } from '@/lib/useFetch';
import type { BlockedProfile, Profile } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { LIST_PAGE } from './helpers';
import { Composer, type Attachment } from './Composer';
import { Gone } from './Chat';
import { useMessaging } from './MessagingContext';
import type { Message } from './types';

const MAX_PAGES = 10;

/** The first message to a person: `/messages?to=<id>`. Opens the existing direct chat, or starts one; a non-friend gets a request. */
export function StartChat({ toId, note, onBack }: { toId: number; note: Attachment | null; onBack(): void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { inbox, loadMoreConversations } = useMessaging();
  const { data, errorStatus, error, loading } = useFetch<{ user: Profile | BlockedProfile }>(`/users/${toId}`);
  const [attached, setAttached] = useState(note);
  const [sent, setSent] = useState<{ body: string; note: Attachment | null } | null>(null);
  const send = useAction();

  // The person may already have a chat with this user on a page of the inbox that is not loaded yet.
  const { items, next } = inbox.conversations;
  const existing = items.find((c) => c.type === 'direct' && c.members.some((m) => m.id === toId));
  const capped = items.length >= MAX_PAGES * LIST_PAGE;
  // If paging fails, fall through to the composer: sending still opens or creates the right chat.
  const [searchFailed, setSearchFailed] = useState(false);
  const searching = !existing && !searchFailed && (!inbox.conversationsLoaded || (next !== null && !capped));
  useEffect(() => {
    if (!existing && !searchFailed && inbox.conversationsLoaded && next !== null && !capped)
      loadMoreConversations().catch(() => setSearchFailed(true));
  }, [existing, searchFailed, inbox.conversationsLoaded, next, capped, loadMoreConversations]);

  const suffix = attached ? `?note=${attached.id}` : '';
  if (toId === user?.id) return <Navigate to="/messages" replace />;
  if (existing) return <Navigate to={`/messages/${existing.id}${suffix}`} replace />;
  if (loading || searching)
    return (
      <p role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground">
        Opening chat…
      </p>
    );
  if (errorStatus === 404) return <Gone onBack={onBack} />;
  if (error || !data)
    return (
      <p
        role="alert"
        className="grid h-full place-items-center px-6 text-center text-body-sm font-medium text-destructive"
      >
        {error ?? 'Could not open this chat.'}
      </p>
    );
  const p = data.user;
  if ('blockedByMe' in p && p.blockedByMe === true)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <h2 className="text-title font-bold">You blocked {p.displayName}</h2>
        <p className="max-w-sm text-body text-muted-foreground">Unblock them from their profile to send a message.</p>
        <Button asChild className="mt-3">
          <Link to={`/users/${p.id}`}>Open profile</Link>
        </Button>
      </div>
    );
  const profile = p as Profile;
  const friend = profile.isFriend;

  const onSend = async (body: string) => {
    const r = await send.run(
      () =>
        api<{ conversationId: number; message: Message } | { request: { id: number } }>('/messages', {
          method: 'POST',
          body: { toUserId: toId, body, noteId: attached?.id },
        }),
      (e) => {
        if (e instanceof ApiError && e.status === 409) return 'You already have a request waiting with this person.';
        if (e instanceof ApiError && e.status === 403) return 'You cannot message this person.';
        return errorText(e);
      },
    );
    if (!r) return false;
    if ('request' in r) {
      setSent({ body, note: attached });
      setAttached(null);
      return true;
    }
    navigate(`/messages/${r.conversationId}`, { replace: true });
    return true;
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-topbar shrink-0 items-center gap-2 border-b px-2 md:px-4">
        <Button variant="ghost" size="icon" aria-label="Back to messages" onClick={onBack} className="md:hidden">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <UserAvatar name={profile.displayName} />
        <h2 className="min-w-0 flex-1 truncate text-title-sm font-bold">
          <Link to={`/users/${profile.id}`} className="hover:underline">
            {profile.displayName}
          </Link>
        </h2>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {sent ? (
          <div className="mx-auto max-w-md">
            <div role="status" className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-body font-semibold">Request sent</p>
                <p className="text-body-sm text-muted-foreground">
                  {profile.displayName} will see your message in their requests. You can keep chatting once they accept.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col items-end gap-1">
              <p className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-3.5 py-2 text-body wrap-anywhere whitespace-pre-wrap text-primary-foreground">
                {sent.body}
              </p>
              {sent.note && (
                <p className="text-caption text-muted-foreground">Shared note: {sent.note.title ?? 'Note attached'}</p>
              )}
              <p className="text-caption text-muted-foreground">Waiting for {profile.displayName}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md text-center">
            <UserAvatar name={profile.displayName} className="mx-auto size-16 text-title" />
            <p className="mt-2 text-title font-bold">{profile.displayName}</p>
            <p className="mt-1 text-body text-muted-foreground">
              {friend
                ? 'You are friends. Say hello.'
                : `You are not friends yet, so your first message goes to ${profile.displayName} as a request. They can accept or decline it.`}
            </p>
          </div>
        )}
      </div>
      {send.error && (
        <p role="alert" className="shrink-0 px-4 pb-1 text-body-sm font-medium text-destructive">
          {send.error}
        </p>
      )}
      {!sent && (
        <Composer
          onSend={onSend}
          note={attached}
          onRemoveNote={() => setAttached(null)}
          pending={send.pending}
          placeholder={friend ? 'Write a message' : 'Write your request'}
          autoFocus
        />
      )}
    </div>
  );
}
