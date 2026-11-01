import { LIMITS, THEMES, type TextElement } from '@notalah/shared';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { api, errorText } from '@/lib/api';
import { AI_TIMEOUT_MS, aiAvailable } from './DraftFromText';
import { htmlToText, quizSlide, textToHtml } from './outline';
import { type EditorState, useEditor } from './store';

const MAX_CHARS = 2_000;
const ACTIONS = [
  ['rewrite', 'Rewrite clearer'],
  ['shorten', 'Shorten'],
  ['quiz', 'Quiz me'],
] as const;
type Action = (typeof ACTIONS)[number][0];

const boxOf = (s: EditorState, id: string) => s.deck.slides[s.activeSlide]?.elements.find((e) => e.id === id);

/** "Rewrite clearer", "Shorten" and "Quiz me" (R28) on the selected text box. */
export function TextActions({ el }: { el: TextElement }) {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = useEditor((s) => s.readOnly);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    void aiAvailable().then(setAvailable);
    return () => ctrl.current?.abort(); // the bar is keyed by the box: another selection ends the request
  }, []);

  function stop() {
    ctrl.current?.abort();
    ctrl.current = null; // the stopped request must not touch state when it settles
    setBusy(null);
  }

  async function run(action: Action) {
    const st = useEditor.getState();
    st.setEditing(null); // typing and the reply must not collide
    const { session } = st;
    const box = boxOf(useEditor.getState(), el.id);
    if (st.readOnly || box?.type !== 'text') return;
    const text = htmlToText(box.html);
    if (!text) return setError('This box has no text.');
    if (text.length > MAX_CHARS)
      return setError(`Use a box with at most ${MAX_CHARS.toLocaleString('en')} characters.`);
    ctrl.current?.abort();
    const c = (ctrl.current = new AbortController());
    setBusy(action);
    setError(null);
    try {
      const reply = await api<{ text?: unknown; questions?: unknown }>('/ai/rewrite', {
        method: 'POST',
        body: { text, action },
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(AI_TIMEOUT_MS)]),
      });
      if (ctrl.current !== c) return;
      const now = useEditor.getState();
      if (now.session !== session || now.readOnly) return; // another Note or a lock: dropped quietly
      const cur = boxOf(now, el.id);
      if (cur?.type !== 'text' || cur.html !== box.html) return setError('The box changed while waiting. Try again.');
      if (action === 'quiz') {
        const qs = reply.questions;
        if (
          !Array.isArray(qs) ||
          qs.length < 3 ||
          qs.length > 5 ||
          qs.some((x) => typeof x?.q !== 'string' || typeof x?.a !== 'string')
        )
          return setError("Couldn't do that, try shorter text");
        const slide = quizSlide(qs, THEMES[now.deck.theme], now.deck.aspect);
        if (!now.insertSlides([slide], session))
          return setError(`This note already has ${LIMITS.slides} slides. Delete one to make room.`);
      } else if (typeof reply.text === 'string' && textToHtml(reply.text)) {
        now.updateElement(el.id, { html: textToHtml(reply.text) });
      } else return setError("Couldn't do that, try shorter text");
    } catch (e) {
      if (c.signal.aborted || ctrl.current !== c) return;
      setError(
        e instanceof DOMException && e.name === 'TimeoutError'
          ? 'This took too long and was stopped. Try shorter text.'
          : errorText(e),
      );
    } finally {
      if (ctrl.current === c) setBusy(null);
    }
  }

  if (!available || readOnly) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5">
          <Sparkles aria-hidden="true" />
          AI help
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-2">
        <p className="text-caption text-muted-foreground">
          The text of this box is sent to an external AI service. Do not use anything private. One undo reverses the
          result.
        </p>
        {ACTIONS.map(([action, label]) => (
          <Button
            key={action}
            type="button"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => void run(action)}
          >
            {busy === action ? 'Working…' : label}
          </Button>
        ))}
        {busy && (
          <Button type="button" variant="ghost" onClick={stop}>
            Cancel
          </Button>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
