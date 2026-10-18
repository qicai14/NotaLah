import { MessageCircle } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Chat, Gone } from './Chat';
import type { Attachment } from './Composer';
import { ConversationList, type InboxTab } from './ConversationList';
import { NewChat, NewGroup } from './Pickers';
import { StartChat } from './StartChat';

const positive = (v: string | null) => (v && /^[1-9]\d{0,9}$/.test(v) ? Number(v) : null);

/**
 * Messaging (FR6, FR7, FR13): the inbox beside a conversation on desktop, one pane at a time on phones.
 * `/messages` the inbox, `/messages/:id` a chat, `/messages/new` and `/messages/new-group` the pickers,
 * `/messages?to=<id>` opens or starts a direct chat, `?note=<id>` attaches a note card to the first message.
 */
export default function Messages() {
  const { '*': rest = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toList = () => navigate('/messages');

  const to = positive(params.get('to'));
  const noteId = positive(params.get('note'));
  const note: Attachment | null = noteId ? { id: noteId, title: params.get('noteTitle')?.slice(0, 120) || null } : null;
  const tab: InboxTab = params.get('tab') === 'requests' ? 'requests' : 'chats';

  const segment = rest.split('/')[0] ?? '';
  const chatId = positive(segment);
  const detail = segment !== '' || to !== null;

  let pane;
  if (segment === 'new') pane = <NewChat onBack={toList} />;
  else if (segment === 'new-group') pane = <NewGroup onBack={toList} />;
  else if (segment !== '' && chatId === null) pane = <Gone onBack={toList} />;
  else if (chatId !== null) pane = <Chat key={chatId} id={chatId} initialNote={note} onBack={toList} onLeft={toList} />;
  else if (to !== null) pane = <StartChat key={to} toId={to} note={note} onBack={toList} />;
  else
    pane = (
      <div className="grid h-full place-items-center px-6 text-center">
        <div>
          <MessageCircle aria-hidden="true" className="mx-auto size-12 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-title font-bold">Your messages</p>
          <p className="mt-1 text-body text-muted-foreground">Pick a conversation, or start a new one.</p>
        </div>
      </div>
    );

  return (
    <div className="flex h-dvh min-w-0">
      <section
        aria-label="Conversations"
        className={cn('w-full min-w-0 border-r md:w-[22rem] md:shrink-0 xl:w-[26rem]', detail && 'max-md:hidden')}
      >
        <ConversationList activeId={chatId} tab={tab} />
      </section>
      <section
        aria-label="Conversation"
        className={cn(
          'min-w-0 flex-1 bg-background',
          detail ? 'max-md:fixed max-md:inset-0 max-md:z-50' : 'max-md:hidden',
        )}
      >
        {pane}
      </section>
    </div>
  );
}
