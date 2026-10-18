import { ArrowLeft, Info } from 'lucide-react';
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { api, ApiError, errorText } from '@/lib/api';
import { useAction } from '@/lib/useAction';
import { useAuth } from '../auth/AuthContext';
import { chatReducer, emptyChat, seenBy, typingThrottle } from './chatReducer';
import { Composer, type Attachment } from './Composer';
import { GroupDetails } from './GroupDetails';
import { conversationTitle, otherMember, TYPING_MS } from './helpers';
import { MessageBubble } from './MessageBubble';
import { useMessaging, useSocketEvent } from './MessagingContext';
import type { Message } from './types';

const TYPING_SHOWN_MS = 3500;
const GAP_MS = 5 * 60 * 1000;

export function Gone({ onBack }: { onBack(): void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <h2 className="text-title font-bold">This conversation is not available</h2>
      <p className="max-w-sm text-body text-muted-foreground">
        It may have been removed, or you can no longer see it. Go back to your messages.
      </p>
      <Button className="mt-3" onClick={onBack}>
        Back to messages
      </Button>
    </div>
  );
}

/** Wireframes 46, 47, 50 and 51: history (newest at the bottom, older on request), Seen, typing, reply, delete, note card. */
export function Chat({
  id,
  onBack,
  onLeft,
  initialNote,
}: {
  id: number;
  onBack(): void;
  onLeft(): void;
  initialNote: Attachment | null;
}) {
  const { user } = useAuth();
  const me = user!.id;
  const { socket, connections, inbox, dispatch: inboxDispatch, fetchConversation, setOpen } = useMessaging();
  const conversation = inbox.conversations.items.find((c) => c.id === id);
  const [chat, dispatch] = useReducer(chatReducer, emptyChat);
  const [gone, setGone] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reply, setReply] = useState<Message | null>(null);
  const [note, setNote] = useState<Attachment | null>(initialNote);
  const [cannotSend, setCannotSend] = useState(false);
  const [typers, setTypers] = useState<Record<number, number>>({});
  const [details, setDetails] = useState(false);
  const send = useAction();
  const older = useAction();
  const remove = useAction();
  const list = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const heightBefore = useRef(0);
  const readSent = useRef(0);

  useEffect(() => {
    setOpen(id);
    return () => setOpen(null);
  }, [id, setOpen]);

  useEffect(() => {
    if (conversation) return;
    let live = true;
    void fetchConversation(id).then((c) => live && !c && setGone(true));
    return () => {
      live = false;
    };
  }, [id, conversation, fetchConversation]);

  useEffect(() => {
    let live = true;
    api<{ messages: Message[]; nextCursor: string | null }>(`/conversations/${id}/messages`)
      .then((r) => {
        if (!live) return;
        setLoadError(null);
        dispatch({ type: 'first', items: r.messages, next: r.nextCursor });
      })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setGone(true);
        else setLoadError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [id, connections]);

  useSocketEvent<{ conversationId: number; message: Message }>('message:new', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    dispatch({ type: 'new', message });
    setTypers((t) => Object.fromEntries(Object.entries(t).filter(([k]) => Number(k) !== message.sender.id)));
  });
  useSocketEvent<{ conversationId: number; messageId: number }>('message:deleted', (p) => {
    if (p.conversationId === id) dispatch({ type: 'deleted', messageId: p.messageId });
  });
  useSocketEvent<{ conversationId: number; userId: number }>('typing', (p) => {
    if (p.conversationId !== id || p.userId === me) return;
    setTypers((t) => ({ ...t, [p.userId]: Date.now() + TYPING_SHOWN_MS }));
  });
  useSocketEvent<{ conversationId: number }>('conversation:removed', (p) => {
    if (p.conversationId === id) setGone(true);
  });

  // Typing expires on its own: no "stopped typing" event exists (D50).
  useEffect(() => {
    const until = Object.values(typers);
    if (!until.length) return;
    const t = setTimeout(
      () => setTypers((cur) => Object.fromEntries(Object.entries(cur).filter(([, u]) => u > Date.now()))),
      Math.max(100, Math.min(...until) - Date.now()),
    );
    return () => clearTimeout(t);
  }, [typers]);

  const latestIncoming = [...chat.messages].reverse().find((m) => m.sender.id !== me)?.id ?? 0;
  const myRead = conversation?.members.find((m) => m.id === me)?.lastReadMessageId ?? 0;
  useEffect(() => {
    if (!latestIncoming || latestIncoming <= myRead || readSent.current >= latestIncoming) return;
    readSent.current = latestIncoming;
    api(`/conversations/${id}/read`, { method: 'POST', body: { messageId: latestIncoming } }).catch(() => {
      readSent.current = 0;
    });
  }, [id, latestIncoming, myRead]);

  const newest = chat.messages.at(-1);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (heightBefore.current) {
      el.scrollTop += el.scrollHeight - heightBefore.current;
      heightBefore.current = 0;
    } else if (stick.current || newest?.sender.id === me) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages.length, newest?.id, newest?.sender.id, me, chat.loaded]);

  const typing = useRef(typingThrottle(() => {}, TYPING_MS));
  useEffect(() => {
    typing.current = typingThrottle(() => socket?.emit('typing', { conversationId: id }), TYPING_MS);
  }, [socket, id]);

  const onSend = async (body: string) => {
    const r = await send.run(
      () =>
        api<{ message: Message }>(`/conversations/${id}/messages`, {
          method: 'POST',
          body: { body, noteId: note?.id, replyToId: reply?.id },
        }),
      (e) => {
        if (e instanceof ApiError && e.status === 403) {
          setCannotSend(true);
          return 'You can no longer message this person.';
        }
        if (e instanceof ApiError && e.status === 404) {
          setGone(true);
          return 'This conversation is not available.';
        }
        return errorText(e);
      },
    );
    if (!r) return false;
    stick.current = true;
    dispatch({ type: 'new', message: r.message });
    inboxDispatch({ type: 'message', message: r.message, me, open: true });
    setReply(null);
    setNote(null);
    return true;
  };

  const onDelete = (m: Message) =>
    remove.run(async () => {
      await api(`/messages/${m.id}`, { method: 'DELETE' });
      dispatch({ type: 'deleted', messageId: m.id });
      inboxDispatch({ type: 'deleted', conversationId: id, messageId: m.id });
    });

  const loadOlder = () =>
    older.run(async () => {
      if (!chat.older) return;
      heightBefore.current = list.current?.scrollHeight ?? 0;
      const r = await api<{ messages: Message[]; nextCursor: string | null }>(
        `/conversations/${id}/messages?cursor=${chat.older}`,
      );
      dispatch({ type: 'older', items: r.messages, next: r.nextCursor });
    });

  if (gone) return <Gone onBack={onBack} />;
  if (!conversation) {
    return (
      <p role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground">
        Loading conversation…
      </p>
    );
  }

  const title = conversationTitle(conversation, me);
  const other = otherMember(conversation, me);
  const group = conversation.type === 'group';
  const seen = seenBy(chat.messages, conversation.members, me);
  const nameOf = (userId: number) =>
    userId === me ? 'You' : (conversation.members.find((m) => m.id === userId)?.displayName ?? 'Deleted user');
  const typingNames = Object.keys(typers).map((k) => nameOf(Number(k)).split(' ')[0]);
  const typingText =
    typingNames.length === 0
      ? ''
      : typingNames.length === 1
        ? `${typingNames[0]} is typing…`
        : typingNames.length === 2
          ? `${typingNames[0]} and ${typingNames[1]} are typing…`
          : 'Several people are typing…';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-topbar shrink-0 items-center gap-2 border-b px-2 md:px-4">
        <Button variant="ghost" size="icon" aria-label="Back to messages" onClick={onBack} className="md:hidden">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <UserAvatar name={title} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-title-sm font-bold">
            {!group && other ? (
              <Link to={`/users/${other.id}`} className="hover:underline">
                {title}
              </Link>
            ) : (
              title
            )}
          </h2>
          {group && <p className="text-caption text-muted-foreground">{conversation.members.length} members</p>}
        </div>
        {group && (
          <Button variant="ghost" size="icon" aria-label="Group details" onClick={() => setDetails(true)}>
            <Info aria-hidden="true" />
          </Button>
        )}
      </header>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
      >
        {chat.older && (
          <div className="mb-4 flex justify-center">
            <Button variant="secondary" size="sm" disabled={older.pending} onClick={loadOlder}>
              {older.pending ? 'Loading…' : 'Show earlier messages'}
            </Button>
          </div>
        )}
        {older.error && (
          <p role="alert" className="mb-3 text-center text-body-sm font-medium text-destructive">
            {older.error}
          </p>
        )}
        {!chat.loaded && !loadError && (
          <p role="status" className="py-10 text-center text-body-sm text-muted-foreground">
            Loading messages…
          </p>
        )}
        {loadError && (
          <p role="alert" className="py-10 text-center text-body-sm font-medium text-destructive">
            {loadError}
          </p>
        )}
        {chat.loaded && chat.messages.length === 0 && (
          <p className="py-10 text-center text-body text-muted-foreground">No messages yet. Say hello.</p>
        )}
        <ul role="log" aria-label={`Messages with ${title}`} className="flex flex-col gap-1.5">
          {chat.messages.map((m, i) => {
            const prev = chat.messages[i - 1];
            const nxt = chat.messages[i + 1];
            const names = seen.get(m.id);
            const lastOfRun =
              !nxt || nxt.sender.id !== m.sender.id || +new Date(nxt.createdAt) - +new Date(m.createdAt) > GAP_MS;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.sender.id === me}
                showName={group && (!prev || prev.sender.id !== m.sender.id)}
                showTime={lastOfRun}
                quotedName={m.replyTo ? nameOf(m.replyTo.senderId) : null}
                seen={names ? (group ? `Seen by ${names.join(', ')}` : 'Seen') : null}
                onReply={() => setReply(m)}
                onDelete={() => void onDelete(m)}
              />
            );
          })}
        </ul>
        {remove.error && (
          <p role="alert" className="mt-2 text-center text-body-sm font-medium text-destructive">
            {remove.error}
          </p>
        )}
      </div>

      <p aria-live="polite" className="h-5 shrink-0 px-4 text-caption text-muted-foreground">
        {typingText && <span className="animate-pulse">{typingText}</span>}
      </p>
      {send.error && (
        <p role="alert" className="shrink-0 px-4 pb-1 text-body-sm font-medium text-destructive">
          {send.error}
        </p>
      )}
      <Composer
        onSend={onSend}
        onTyping={() => typing.current()}
        replyTo={reply && { id: reply.id, name: nameOf(reply.sender.id), body: reply.body }}
        onCancelReply={() => setReply(null)}
        note={note}
        onRemoveNote={() => setNote(null)}
        pending={send.pending}
        disabled={cannotSend}
        placeholder={cannotSend ? 'You cannot message this person' : 'Write a message'}
      />
      {details && group && (
        <GroupDetails conversation={conversation} onClose={() => setDetails(false)} onLeft={onLeft} />
      )}
    </div>
  );
}
