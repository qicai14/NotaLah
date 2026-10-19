import { FileText, Send, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BODY_MAX } from './helpers';

export interface Attachment {
  id: number;
  title: string | null;
}

/**
 * Message box: Enter sends, Shift+Enter adds a line. `onSend` resolves true once the message is accepted (the box then
 * clears) and false when it failed (the text stays so nothing is lost). A reply or note card shows above the box.
 */
export function Composer({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  note,
  onRemoveNote,
  pending,
  disabled,
  placeholder = 'Write a message',
  autoFocus,
}: {
  onSend: (body: string) => Promise<boolean>;
  onTyping?: () => void;
  replyTo?: { id: number; name: string; body: string | null } | null;
  onCancelReply?: () => void;
  note?: Attachment | null;
  onRemoveNote?: () => void;
  pending: boolean;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState('');
  const box = useRef<HTMLTextAreaElement>(null);
  // Choosing Reply moves the cursor into the box, so the answer can be typed at once.
  const replyId = replyTo?.id;
  useEffect(() => {
    if (replyId !== undefined) box.current?.focus();
  }, [replyId]);
  const body = text.trim();
  const near = text.length > BODY_MAX - 200;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!body || pending || disabled) return;
    if (await onSend(body)) {
      setText('');
      box.current?.focus();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form onSubmit={submit} className="border-t bg-background px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-surface px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <p className="truncate text-caption font-semibold">Replying to {replyTo.name}</p>
            <p className="truncate text-caption text-muted-foreground">{replyTo.body ?? 'Message deleted'}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Cancel reply" onClick={onCancelReply}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      {note && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-surface px-3 py-2">
          <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-body-sm">
            <span className="font-semibold">Sharing note:</span> {note.title ?? 'Note attached'}
          </p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove note" onClick={onRemoveNote}>
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label htmlFor="message-box" className="sr-only">
          Message
        </label>
        <textarea
          id="message-box"
          ref={box}
          value={text}
          rows={1}
          maxLength={BODY_MAX}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) onTyping?.();
          }}
          onKeyDown={onKey}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-md border border-transparent bg-surface px-4 py-2.5 text-body text-foreground outline-none [field-sizing:content] placeholder:text-muted-foreground hover:bg-surface-strong focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="Send message"
          disabled={!body || pending || disabled}
          className="shrink-0"
        >
          <Send aria-hidden="true" />
        </Button>
      </div>
      {near && (
        <p className="mt-1 text-right text-caption text-muted-foreground tabular-nums" aria-live="polite">
          {text.length}/{BODY_MAX}
        </p>
      )}
    </form>
  );
}
