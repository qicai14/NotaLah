import { OUTLINE_LIMITS, parseOutline, THEMES } from '@notalah/shared';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError, errorText } from '@/lib/api';
import { outlineToSlides } from './outline';
import { useEditor } from './store';

/** A request that runs longer than this is stopped (R28). */
export const AI_TIMEOUT_MS = 30_000;
/** The server's limit on pasted text. */
const MAX_CHARS = 20_000;

let probe: Promise<boolean> | undefined;
/** Asks the server once whether the AI routes exist: an empty body is refused with 400 before any call is spent, a 404 means off. */
const aiAvailable = () =>
  (probe ??= api('/ai/outline', { method: 'POST', body: {} }).then(
    () => true,
    (e) => !(e instanceof ApiError && e.status === 404),
  ));

/** "Draft slides from text" (R28): paste text, the assistant outlines it, the outline lands as Slides after the current one. */
export function DraftFromText({ onAdd }: { onAdd?: () => void }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    void aiAvailable().then(setAvailable);
    return () => ctrl.current?.abort();
  }, []);

  function close() {
    ctrl.current?.abort();
    setOpen(false);
    setPending(false);
  }

  async function send() {
    const st = useEditor.getState();
    st.setEditing(null); // typing and the reply must not collide
    const { session } = st;
    const c = (ctrl.current = new AbortController());
    setPending(true);
    setError(null);
    try {
      const { outline } = await api<{ outline: unknown }>('/ai/outline', {
        method: 'POST',
        body: { text, currentSlides: st.deck.slides.length },
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(AI_TIMEOUT_MS)]),
      });
      const now = useEditor.getState();
      const parsed = parseOutline(outline, now.deck.slides.length);
      if (!parsed.success) return setError("Couldn't tidy this, try shorter text");
      const added = now.insertSlides(outlineToSlides(parsed.data, THEMES[now.deck.theme], now.deck.aspect), session);
      if (!added) return setError('No slides were added: the note changed, is read-only or is full.');
      setOpen(false);
      setText('');
      onAdd?.();
    } catch (e) {
      if (c.signal.aborted) return; // stopped by the student
      setError(
        e instanceof DOMException && e.name === 'TimeoutError'
          ? 'This took too long and was stopped. Try shorter text.'
          : errorText(e),
      );
    } finally {
      setPending(false);
    }
  }

  if (!available) return null;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-muted-foreground">Draft with AI</h3>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Sparkles aria-hidden="true" />
          Draft slides from text
        </Button>
      </section>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Draft slides from text</DialogTitle>
          <DialogDescription>
            Your text is sent to an external AI service to draft up to {OUTLINE_LIMITS.slides} slides after the current
            one. Do not paste anything private. You can edit every slide, and one undo removes the whole draft.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim() && !pending) void send();
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="draft-text" className="text-body-sm font-semibold">
              Text to turn into slides
            </label>
            <textarea
              id="draft-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX_CHARS}
              rows={8}
              readOnly={pending}
              className="resize-y rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
            />
            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive"
              >
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !text.trim()}>
                {pending ? 'Drafting…' : 'Send'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
