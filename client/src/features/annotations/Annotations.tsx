import { Keyboard, MessageSquareQuote } from 'lucide-react';
import { type FormEvent, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { Slide } from '@notalah/shared';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { useAction } from '@/lib/useAction';
import { ConfirmButton } from '../../components/ConfirmButton';
import { LecturerBadge } from '../../components/LecturerBadge';
import { ReportDialog } from '../../components/ReportDialog';
import { api, ApiError, errorText } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { Annotation } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useGuestPrompt } from '../auth/GuestPrompt';
import { type Anchor, htmlText, MAX_QUOTE, resolveAnchor, selectionAnchor, slideOf, textRange } from './anchors';

const MAX_BODY = 500;
const OFF_MESSAGE = 'Annotations are turned off for this note';
type Deck = Pick<Slide, 'elements'>[];
export type Draft = Anchor & { slideId: number };

const canPaint = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

/** The live range of an annotation on the slide on show (hidden neighbour slides are `inert`), or null. */
function rangeOf(root: HTMLElement, slides: Deck, a: Annotation): Range | null {
  const start = resolveAnchor(slides, a);
  if (start === null) return null;
  const el = [...root.querySelectorAll(`[data-anchor="${CSS.escape(a.elementId)}"]`)].find(
    (n) => !n.closest('[inert]'),
  );
  return el ? textRange(el, start, a.quote.length) : null;
}

/**
 * Paints the current slide's annotations with the CSS Custom Highlight API, leaving the slide DOM untouched. Returns
 * `show`, which scrolls an annotation into view and flashes it.
 */
export function useHighlights(root: RefObject<HTMLElement | null>, slides: Deck, list: Annotation[], slideNo: number) {
  useEffect(() => {
    const node = root.current;
    if (!node || !canPaint()) return;
    const ranges = list.filter((a) => slideOf(slides, a) === slideNo).flatMap((a) => rangeOf(node, slides, a) ?? []);
    CSS.highlights.set('annotation', new Highlight(...ranges));
    return () => void CSS.highlights.delete('annotation');
  }, [root, slides, list, slideNo]);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (canPaint()) CSS.highlights.delete('annotation-flash');
    },
    [],
  );
  return useCallback(
    (a: Annotation) => {
      const node = root.current;
      const range = node && rangeOf(node, slides, a);
      if (!range) return;
      const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
      if (!canPaint()) return;
      CSS.highlights.set('annotation-flash', new Highlight(range));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => CSS.highlights.delete('annotation-flash'), 1400);
    },
    [root, slides],
  );
}

/** The floating "Annotate" button under a text selection inside `root`; nothing when annotations are off. */
export function SelectionAnnotate({
  root,
  enabled,
  onAnnotate,
}: {
  root: RefObject<HTMLElement | null>;
  enabled: boolean;
  onAnnotate: (anchor: Anchor) => void;
}) {
  const [sel, setSel] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const update = () => {
      const s = document.getSelection();
      const range = s && s.rangeCount > 0 && !s.isCollapsed ? s.getRangeAt(0) : null;
      const anchor = range && root.current?.contains(range.commonAncestorContainer) ? selectionAnchor(range) : null;
      if (!range || !anchor) return setSel(null);
      const r = typeof range.getBoundingClientRect === 'function' ? range.getBoundingClientRect() : null;
      setSel({ anchor, x: r ? r.left + r.width / 2 : 0, y: r ? r.bottom : 0 });
    };
    document.addEventListener('selectionchange', update);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [enabled, root]);

  if (!enabled || !sel) return null;
  const tooLong = sel.anchor.quote.length > MAX_QUOTE;
  return (
    <Button
      size="sm"
      disabled={tooLong}
      // Keep the selection: a press would otherwise collapse it and unmount the button before the click lands.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onAnnotate(sel.anchor);
        document.getSelection()?.removeAllRanges();
        setSel(null);
      }}
      className="fixed z-40 -translate-x-1/2 shadow-(--shadow-float) disabled:opacity-100"
      style={{
        left: Math.min(Math.max(sel.x, 96), window.innerWidth - 96),
        top: Math.min(sel.y + 10, window.innerHeight - 56),
      }}
    >
      <MessageSquareQuote aria-hidden="true" />
      {tooLong ? `Select up to ${MAX_QUOTE} characters` : 'Annotate'}
    </Button>
  );
}

/**
 * Keyboard route to a new annotation (R10): rendered text takes no Shift+arrow selection in most browsers, so the slide's
 * text boxes are offered as read-only text areas (the same plain text the anchors count in), which do. The panel's live
 * region announces the result.
 */
function KeyboardPicker({
  slide,
  slideNo,
  onPick,
}: {
  slide: Pick<Slide, 'elements'> | undefined;
  slideNo: number;
  onPick: (anchor: Anchor & { slideId: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = useRef<{ elementId: string; start: number; end: number; text: string } | null>(null);
  const boxes = (slide?.elements ?? []).flatMap((e) =>
    e.type === 'text' ? [{ id: e.id, text: htmlText(e.html) }] : [],
  );

  const annotate = () => {
    const p = picked.current;
    const raw = p ? p.text.slice(p.start, p.end) : '';
    const quote = raw.trim();
    if (!p || !quote) return setError('Select some text first: hold Shift and press the arrow keys.');
    if (quote.length > MAX_QUOTE) return setError(`Select up to ${MAX_QUOTE} characters.`);
    setError(null);
    setOpen(false);
    picked.current = null;
    onPick({
      elementId: p.elementId,
      quote,
      offset: p.start + raw.length - raw.trimStart().length,
      slideId: slideNo,
    });
  };

  if (!open) {
    return (
      <div className="border-b px-5 pb-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Keyboard aria-hidden="true" />
          Select text with the keyboard
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 border-b px-5 pb-4">
      <p className="text-body-sm text-muted-foreground">
        {boxes.length === 0
          ? 'This slide has no text to annotate.'
          : 'Move into a text box, hold Shift and press the arrow keys to select, then choose Annotate selection.'}
      </p>
      {boxes.map((b, i) => (
        <div key={b.id} className="flex flex-col gap-1">
          <label htmlFor={`pick-${b.id}`} className="text-caption font-semibold">
            Text box {i + 1}
          </label>
          <textarea
            id={`pick-${b.id}`}
            readOnly
            value={b.text}
            rows={Math.min(5, Math.max(2, Math.ceil(b.text.length / 40)))}
            onSelect={(e) => {
              const t = e.currentTarget;
              picked.current = { elementId: b.id, start: t.selectionStart, end: t.selectionEnd, text: b.text };
            }}
            className="resize-none rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={boxes.length === 0} onClick={annotate}>
          Annotate selection
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Composer({
  noteId,
  draft,
  onPosted,
  onCancel,
  onOff,
}: {
  noteId: number;
  draft: Draft;
  onPosted: (a: Annotation) => void;
  onCancel: () => void;
  onOff: () => void;
}) {
  const [body, setBody] = useState('');
  const { run, pending, error, setError } = useAction();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return setError('Annotation is required');
    if (body.length > MAX_BODY) return setError(`Annotation must be at most ${MAX_BODY} characters`);
    const r = await run(
      () =>
        api<{ annotation: Annotation }>(`/notes/${noteId}/annotations`, { method: 'POST', body: { ...draft, body } }),
      (err) => {
        // Only the off switch is handled here; any other 403 (a restricted account) is just shown.
        if (err instanceof ApiError && err.status === 403 && err.message === OFF_MESSAGE) onOff();
        return errorText(err);
      },
    );
    if (r) onPosted(r.annotation);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-b px-5 pb-4">
      <p className="text-caption font-semibold text-muted-foreground">Annotating</p>
      <blockquote className="line-clamp-3 rounded-sm bg-annotation px-2.5 py-1.5 text-body-sm">
        “{draft.quote}”
      </blockquote>
      <label htmlFor="annotation-body" className="sr-only">
        Your annotation
      </label>
      <textarea
        id="annotation-body"
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Add your annotation"
        aria-invalid={error ? true : undefined}
        aria-describedby="annotation-count"
        className="resize-none rounded-md border border-input bg-background px-3 py-2 text-body outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
      />
      <div className="flex items-center justify-between gap-2">
        <span
          id="annotation-count"
          className={
            body.length > MAX_BODY
              ? 'text-caption font-semibold text-destructive'
              : 'text-caption text-muted-foreground'
          }
        >
          {body.length}/{MAX_BODY}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Posting…' : 'Post'}
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function Item({
  a,
  noteId,
  resolved,
  readOnly,
  onShow,
  onRemoved,
}: {
  a: Annotation;
  noteId: number;
  resolved: boolean;
  readOnly: boolean;
  onShow: (a: Annotation) => void;
  onRemoved: (id: number) => void;
}) {
  const { user } = useAuth();
  const askToLogIn = useGuestPrompt();
  const [reporting, setReporting] = useState(false);
  const reportButton = useRef<HTMLButtonElement>(null);
  const { run, error } = useAction();
  const remove = async () => {
    const ok = await run(
      async () => {
        await api(`/notes/${noteId}/annotations/${a.id}`, { method: 'DELETE' });
        return true;
      },
      (err) => (err instanceof ApiError && err.status === 404 ? (onRemoved(a.id), null) : errorText(err)), // already gone
    );
    if (ok) onRemoved(a.id);
  };

  return (
    <li className="flex gap-3">
      <UserAvatar name={a.author.displayName} src={a.author.avatarUrl} className="size-9 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm">
          <span className="font-bold">{a.author.displayName}</span>
          {a.author.isVerifiedLecturer && <LecturerBadge />}
          <span className="text-caption text-muted-foreground">{timeAgo(a.createdAt)}</span>
        </p>
        {resolved ? (
          <button
            type="button"
            onClick={() => onShow(a)}
            aria-label={`Show “${a.quote}” on the slide`}
            className="line-clamp-2 cursor-pointer self-start rounded-sm bg-annotation px-2 py-0.5 text-left text-body-sm transition-colors duration-(--duration-fast) hover:bg-annotation/80"
          >
            “{a.quote}”
          </button>
        ) : (
          <p className="flex flex-wrap items-baseline gap-1.5 text-body-sm text-muted-foreground">
            <span className="rounded-sm bg-surface-strong px-1.5 text-caption font-semibold text-foreground">
              Text changed
            </span>
            <span className="line-clamp-2">“{a.quote}”</span>
          </p>
        )}
        <p className="text-body break-words whitespace-pre-wrap">{a.body}</p>
        <div className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
          {!readOnly && a.canDelete && <ConfirmButton label="Delete" onConfirm={remove} focusMain={false} />}
          {!readOnly && a.author.id !== user?.id && (
            <button
              ref={reportButton}
              type="button"
              onClick={() =>
                user ? setReporting(true) : askToLogIn({ action: 'report', returnTo: `/notes/${noteId}` })
              }
              className="rounded-full px-2 py-1 text-body-sm font-semibold hover:bg-accent hover:text-foreground"
            >
              Report
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
      {reporting && (
        <ReportDialog
          noteId={noteId}
          annotationId={a.id}
          onClose={() => setReporting(false)}
          returnFocus={reportButton}
        />
      )}
    </li>
  );
}

/**
 * Annotations on the slide on show (R10, FR18), with the composer for a new one at the top. An annotation whose quote
 * no longer resolves in the deck is listed as "Text changed" and is not highlighted; ones on a slide that no longer
 * exists are listed on the last slide. `readOnly` (the share-link page) lists them without the composer, delete or report.
 */
export function AnnotationPanel({
  noteId,
  slides,
  slideNo,
  annotations,
  draft,
  readOnly = false,
  onPick,
  onDraftDone,
  onPosted,
  onRemoved,
  onShow,
  onOff,
}: {
  noteId: number;
  slides: Deck;
  /** 1-based, as `Annotation.slideId`. */
  slideNo: number;
  annotations: Annotation[];
  draft: Draft | null;
  readOnly?: boolean;
  /** Starts an annotation from the keyboard picker; the parent asks guests to log in. */
  onPick?: (anchor: Anchor) => void;
  onDraftDone?: () => void;
  onPosted?: (a: Annotation) => void;
  onRemoved?: (id: number) => void;
  onShow: (a: Annotation) => void;
  onOff?: () => void;
}) {
  const [said, setSaid] = useState('');
  const last = slideNo === slides.length;
  const here = annotations.filter((a) => {
    const at = slideOf(slides, a);
    return at === slideNo || (last && at > slides.length);
  });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p role="status" className="sr-only">
        {said}
      </p>
      {!readOnly && !draft && onPick && (
        <KeyboardPicker
          key={slideNo}
          slide={slides[slideNo - 1]}
          slideNo={slideNo}
          onPick={(a) => {
            setSaid(`Selected “${a.quote}”. Write your annotation, then choose Post.`);
            onPick(a);
          }}
        />
      )}
      {!readOnly && draft && (
        <Composer
          key={`${draft.slideId}:${draft.elementId}:${draft.offset}:${draft.quote}`}
          noteId={noteId}
          draft={draft}
          onCancel={() => onDraftDone?.()}
          onOff={() => onOff?.()}
          onPosted={(a) => {
            onPosted?.(a);
            onDraftDone?.();
            setSaid('Annotation posted.');
          }}
        />
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {here.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-muted-foreground">
            {readOnly
              ? 'No annotations on this slide.'
              : 'No annotations on this slide. Select text on the slide to add one.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-5">
            {here.map((a) => (
              <Item
                key={a.id}
                a={a}
                noteId={noteId}
                resolved={resolveAnchor(slides, a) !== null}
                readOnly={readOnly}
                onShow={onShow}
                onRemoved={(id) => {
                  onRemoved?.(id);
                  setSaid('Annotation deleted.');
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
