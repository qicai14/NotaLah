import { LIMITS, OUTLINE_LIMITS, parseOutline, THEMES } from '@notalah/shared';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { api, ApiError, errorText } from '@/lib/api';
import { FileImport } from './FileImport';
import { outlineToSlides } from './outline';
import { useEditor } from './store';

export const AI_TIMEOUT_MS = 30_000;
export const MAX_CHARS = 8_000;
export const FULL = `This note already has ${LIMITS.slides} slides. Delete one to make room.`;

let probe: Promise<boolean> | undefined;
export const forgetAiProbe = () => void (probe = undefined);
/** Asks the server once whether the AI routes exist: an empty body is refused with 400 before any call is spent, a 404 means off. */
export const aiAvailable = () =>
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
  const [importing, setImporting] = useState(false);
  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const [error, setError] = useState<string | null>(null);
  const full = useEditor((s) => s.deck.slides.length >= LIMITS.slides);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    void aiAvailable().then(setAvailable);
    return () => ctrl.current?.abort();
  }, []);

  function close() {
    ctrl.current?.abort();
    ctrl.current = null; // the stopped request must not touch state when it settles
    setOpen(false);
    setPending(false);
    setImporting(false);
  }

  async function send() {
    const st = useEditor.getState();
    st.setEditing(null); // typing and the reply must not collide
    const { session } = st;
    ctrl.current?.abort();
    const c = (ctrl.current = new AbortController());
    const stale = () => ctrl.current !== c;
    setPending(true);
    setError(null);
    try {
      const { outline, aiToken } = await api<{ outline: unknown; aiToken?: string }>('/ai/outline', {
        method: 'POST',
        body: { text, currentSlides: st.deck.slides.length },
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(AI_TIMEOUT_MS)]),
      });
      if (stale()) return;
      const now = useEditor.getState();
      const parsed = parseOutline(outline, now.deck.slides.length);
      if (!parsed.success) return setError("Couldn't tidy this, try shorter text");
      const added = now.insertSlides(outlineToSlides(parsed.data, THEMES[now.deck.theme], now.deck.aspect), session);
      if (!added) {
        // A reply for another note, or while read-only, is dropped quietly; a full note says so.
        if (now.session !== session || useEditor.getState().readOnly) return close();
        return setError(FULL);
      }
      if (aiToken) now.setMeta({ aiToken });
      setOpen(false);
      setText('');
      onAdd?.();
    } catch (e) {
      if (c.signal.aborted || stale()) return;
      setError(
        e instanceof DOMException && e.name === 'TimeoutError'
          ? 'This took too long and was stopped. Try shorter text.'
          : errorText(e),
      );
    } finally {
      if (ctrl.current === c) setPending(false);
    }
  }

  if (!available) return null;
  return (
    <>
      <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-muted-foreground">Draft with AI</h3>
        <Button variant="secondary" disabled={full} onClick={() => setOpen(true)}>
          <Sparkles aria-hidden="true" />
          Draft slides from text
        </Button>
        {full && <p className="text-caption text-muted-foreground">{FULL}</p>}
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
              if (text.trim() && !pending && !importing) void send();
            }}
            className="flex flex-col gap-3"
          >
            <FileImport
              limit={MAX_CHARS}
              disabled={pending}
              onBusy={setImporting}
              onText={(t) => pendingRef.current || setText(t)}
            />
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
              <Button type="submit" disabled={pending || importing || full || !text.trim()}>
                {pending ? 'Drafting…' : 'Send'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
