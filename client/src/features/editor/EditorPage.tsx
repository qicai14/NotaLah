import { type Aspect } from '@parp/shared';
import { ArrowLeft, Check, CloudOff, LoaderCircle, NotebookPen, Proportions, Redo2, Undo2, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { api, errorText } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { cn } from '@/lib/utils';
import type { ModuleRef, Note } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { PublishDialog, type PublishChoice } from '../notes/PublishDialog';
import { Canvas } from './Canvas';
import { ElementBar } from './ElementBar';
import { type Details, PanelBody, type PanelId, PANELS } from './Panels';
import {
  autosaveDelay,
  type Backup,
  clearBackup,
  keepMine,
  noteToDeck,
  noteToMeta,
  readBackup,
  saveNote,
  type SaveOutcome,
  writeBackup,
} from './save';
import { PageNotes } from './PageNotes';
import { SlideStrip } from './SlideStrip';
import { emptyDeck, useEditor } from './store';

const ASPECT_LABELS: Record<Aspect, string> = {
  '4:5': '4:5 Portrait',
  '9:16': '9:16 Full screen',
  '16:9': '16:9 Widescreen',
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

function SaveStatus() {
  const saveState = useEditor((s) => s.saveState);
  const dirty = useEditor((s) => s.dirty);
  const meta = useEditor((s) => s.meta);
  let icon: ReactNode = null;
  let text = '';
  if (saveState === 'saving') {
    icon = <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
    text = 'Saving…';
  } else if (saveState === 'error' || saveState === 'conflict') {
    icon = <CloudOff className="size-3.5" aria-hidden="true" />;
    text = 'Not saved';
  } else if (dirty && meta.status === 'draft' && !meta.title.trim()) text = 'Add a title to save';
  else if (dirty && meta.status === 'published') text = 'Unsaved changes';
  else if (dirty) text = 'Editing';
  else if (saveState === 'saved') {
    icon = <Check className="size-3.5" aria-hidden="true" />;
    text = 'Saved';
  }
  return (
    <span role="status" className="flex items-center gap-1 text-caption whitespace-nowrap text-muted-foreground">
      {icon}
      {text}
    </span>
  );
}

function Banner({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-body-sm',
        tone === 'error' ? 'bg-destructive/10 font-medium text-destructive' : 'bg-surface text-foreground',
      )}
    >
      {children}
    </div>
  );
}

function AspectPicker({ compact }: { compact: boolean }) {
  const aspect = useEditor((s) => s.deck.aspect);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon-sm' : 'sm'}
          aria-label={compact ? `Slide size, ${ASPECT_LABELS[aspect]}` : undefined}
        >
          <Proportions aria-hidden="true" />
          {!compact && ASPECT_LABELS[aspect]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Slide size</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={aspect} onValueChange={(v) => useEditor.getState().setAspect(v as Aspect)}>
          {(Object.keys(ASPECT_LABELS) as Aspect[]).map((a) => (
            <DropdownMenuRadioItem key={a} value={a}>
              {ASPECT_LABELS[a]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UndoRedo({ size }: { size: 'icon' | 'icon-sm' }) {
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  return (
    <>
      <Button
        variant="ghost"
        size={size}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={() => useEditor.getState().undo()}
      >
        <Undo2 />
      </Button>
      <Button
        variant="ghost"
        size={size}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={() => useEditor.getState().redo()}
      >
        <Redo2 />
      </Button>
    </>
  );
}

/** The slide editor (R21c, wireframes 19-29): Canva-style board, panels, slide strip, autosave for drafts. */
export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const desktop = useMediaQuery(DESKTOP);
  const modules = useFetch<{ modules: ModuleRef[] }>('/modules');

  const meta = useEditor((s) => s.meta);
  const saveState = useEditor((s) => s.saveState);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notMine, setNotMine] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>('text');
  const [sheet, setSheet] = useState<PanelId | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  async function fetchAndLoad(noteId: number) {
    const { note } = await api<{ note: Note }>(`/notes/${noteId}`);
    if (note.author.id !== user?.id) return setNotMine(true);
    useEditor.getState().load(noteToDeck(note), noteToMeta(note));
    if (note.status === 'published') setBackup(readBackup(note.id, note.updatedAt));
  }

  // Load once per mount. Right after the first autosave creates the note the URL changes and this page remounts; the
  // store already holds that note (and whatever was typed meanwhile), so it is kept rather than refetched.
  useEffect(() => {
    const created = (location.state as { created?: boolean } | null)?.created;
    if (id && created && useEditor.getState().meta.noteId === Number(id)) {
      navigate(location.pathname, { replace: true, state: null }); // a reload must refetch
      setReady(true);
      return;
    }
    if (!id) {
      useEditor.getState().load(emptyDeck());
      setReady(true);
      return;
    }
    fetchAndLoad(Number(id))
      .catch((e) => setLoadError(errorText(e)))
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount; the route key remounts per note
  }, []);

  /** After any save: show errors, or move a new note to its own URL. */
  const afterSave = useRef<(r: SaveOutcome) => void>(() => {});
  afterSave.current = (r) => {
    if (!r.ok) return setErrors(r.errors);
    setErrors({});
    if (!id) navigate(`/notes/${r.note.id}/edit`, { replace: true, state: { created: true } });
  };

  // Autosave for drafts: 2 s after the last change, at most 10 s after the first unsaved one, and when the tab hides.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first: number | null = null;
    const eligible = () => {
      const s = useEditor.getState();
      return s.dirty && s.meta.status === 'draft' && s.saveState !== 'conflict' && s.meta.title.trim() !== '';
    };
    const run = async () => {
      first = null;
      if (!eligible()) return;
      const r = await saveNote('draft');
      if (!alive) return;
      afterSave.current(r);
      if (r.ok) schedule();
    };
    const schedule = () => {
      if (!alive || !eligible()) return;
      first ??= Date.now();
      clearTimeout(timer);
      timer = setTimeout(run, autosaveDelay(first, Date.now()));
    };
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      clearTimeout(timer);
      void run();
    };
    const unsub = useEditor.subscribe((s, p) => s.rev !== p.rev && schedule());
    document.addEventListener('visibilitychange', onHide);
    return () => {
      alive = false;
      unsub();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
      if (eligible()) void saveNote('draft'); // leaving within the idle delay still saves the draft
    };
  }, []);

  // Published notes only change on Update, so their unsaved edits are backed up on this device (D52).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useEditor.subscribe((s, p) => {
      if (s.rev === p.rev || s.meta.status !== 'published' || !s.dirty) return;
      clearTimeout(timer);
      timer = setTimeout(writeBackup, 800);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  // Undo and redo from the keyboard, except while typing (TipTap and inputs keep their own).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) useEditor.getState().undo();
      else if ((k === 'z' && e.shiftKey) || k === 'y') useEditor.getState().redo();
      else return;
      e.preventDefault();
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, []);

  async function run(save: () => Promise<SaveOutcome>, publishing: boolean) {
    setBusy(true);
    const r = await save();
    setBusy(false);
    setDialog(false);
    if (r.ok && publishing) {
      clearBackup(r.note.id);
      navigate(`/notes/${r.note.id}`);
      return;
    }
    afterSave.current(r);
    if (!r.ok && (r.errors.moduleId || r.errors.hashtags)) {
      if (desktop) setPanel('details');
      else setSheet('details');
    }
  }

  const published = meta.status === 'published';
  const resaveChoice: PublishChoice = published ? (meta.visibility ?? 'public') : 'draft';

  if (!ready) {
    return (
      <p role="status" className="py-16 text-center text-body-sm text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (loadError || notMine) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {notMine ? 'You can only edit your own notes.' : loadError}
        </p>
        <Button asChild variant="secondary">
          <Link to="/drafts">Back to drafts</Link>
        </Button>
      </div>
    );
  }

  const details: Details = {
    moduleId: meta.moduleId,
    hashtags: meta.hashtags,
    errors,
    modules: modules.data?.modules,
    modulesError: modules.error,
    setModuleId: (moduleId) => useEditor.getState().setMeta({ moduleId }),
    setHashtags: (hashtags) => useEditor.getState().setMeta({ hashtags }),
  };
  const formErrors = Object.entries(errors).filter(([k]) => k !== 'title');

  const titleInput = (
    <div className="min-w-0 flex-1">
      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      <input
        id="note-title"
        value={meta.title}
        maxLength={150}
        placeholder="Untitled note"
        onChange={(e) => useEditor.getState().setMeta({ title: e.target.value })}
        aria-invalid={errors.title ? true : undefined}
        aria-describedby={errors.title ? 'title-error' : undefined}
        className="h-9 w-full max-w-md truncate rounded-md border border-transparent bg-transparent px-2 text-body font-semibold outline-none placeholder:text-muted-foreground hover:border-input focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive"
      />
    </div>
  );

  const banners = (
    <>
      {saveState === 'conflict' && (
        <Banner tone="error">
          <span>This note was changed elsewhere since you opened it.</span>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => meta.noteId && fetchAndLoad(meta.noteId).catch((e) => setErrors({ form: errorText(e) }))}
          >
            Reload
          </Button>
          <Button size="xs" onClick={() => run(() => keepMine(resaveChoice), published)}>
            Keep mine
          </Button>
        </Banner>
      )}
      {backup && (
        <Banner tone="info">
          <span>
            You have unsaved changes on this device from{' '}
            {new Date(backup.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </span>
          <Button
            size="xs"
            onClick={() => {
              const { load, meta: m, setMeta } = useEditor.getState();
              load(backup.deck, m);
              setMeta(backup.meta);
              setBackup(null);
            }}
          >
            Restore
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              if (meta.noteId) clearBackup(meta.noteId);
              setBackup(null);
            }}
          >
            Discard
          </Button>
        </Banner>
      )}
      {(errors.title || formErrors.length > 0) && (
        <Banner tone="error">
          {errors.title && <span id="title-error">{errors.title}</span>}
          {formErrors.map(([k, v]) => (
            <span key={k}>{v}</span>
          ))}
        </Banner>
      )}
    </>
  );

  const actions = (
    <>
      {!published && desktop && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(() => saveNote('draft'), false)}>
          Save draft
        </Button>
      )}
      <Button size="sm" disabled={busy} onClick={() => setDialog(true)}>
        {published ? 'Update' : 'Publish'}
      </Button>
    </>
  );

  const dialogEl = dialog && (
    <PublishDialog
      initial={meta.visibility}
      alreadyPublished={published}
      busy={busy}
      onClose={() => setDialog(false)}
      onChoose={(c) => run(() => saveNote(c), c !== 'draft')}
    />
  );

  if (!desktop) {
    return (
      <div className="flex h-dvh flex-col bg-editor-canvas text-foreground">
        <h1 className="sr-only">{id ? 'Edit note' : 'Create note'}</h1>
        <header className="flex h-topbar shrink-0 items-center gap-1 border-b bg-background px-2">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to drafts">
            <Link to="/drafts">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex min-w-0 flex-1 flex-col">
            {titleInput}
            <span className="px-2">
              <SaveStatus />
            </span>
          </div>
          <UndoRedo size="icon-sm" />
          {actions}
        </header>
        {banners}
        <div className="h-12 shrink-0 overflow-x-auto border-b bg-background [scrollbar-width:none]">
          <div className="flex h-full items-center">
            <ElementBar />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <Canvas compact />
        </div>
        {notesOpen && <PageNotes />}
        <div className="flex shrink-0 items-center gap-1 border-t bg-background px-2">
          <div className="min-w-0 flex-1">
            <SlideStrip compact />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Page notes"
            aria-pressed={notesOpen}
            onClick={() => setNotesOpen(!notesOpen)}
            className="shrink-0 rounded-md aria-pressed:bg-surface-strong"
          >
            <NotebookPen />
          </Button>
          <AspectPicker compact />
        </div>
        <nav
          aria-label="Editor tools"
          className="grid shrink-0 grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)]"
        >
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSheet(p.id)}
              className="flex h-14 flex-col items-center justify-center gap-0.5 text-caption text-muted-foreground active:scale-[0.97]"
            >
              <p.icon className="size-5" aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </nav>
        <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
          <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto rounded-t-2xl border-t-0 p-5">
            <SheetHeader className="p-0">
              <SheetTitle>{PANELS.find((p) => p.id === sheet)?.label}</SheetTitle>
              <SheetDescription className="sr-only">Add to the current slide</SheetDescription>
            </SheetHeader>
            {sheet && <PanelBody id={sheet} details={details} onAdd={() => setSheet(null)} />}
          </SheetContent>
        </Sheet>
        {dialogEl}
      </div>
    );
  }

  const active = PANELS.find((p) => p.id === panel);
  return (
    <div className="flex h-dvh flex-col bg-editor-canvas text-foreground">
      <h1 className="sr-only">{id ? 'Edit note' : 'Create note'}</h1>
      <header className="flex h-topbar shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/drafts">
            <ArrowLeft aria-hidden="true" />
            Drafts
          </Link>
        </Button>
        <span className="h-6 w-px bg-border" aria-hidden="true" />
        {titleInput}
        <SaveStatus />
        <UndoRedo size="icon" />
        <span className="h-6 w-px bg-border" aria-hidden="true" />
        <AspectPicker compact={false} />
        {actions}
      </header>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Editor panels" className="flex w-rail-collapsed shrink-0 flex-col gap-1 border-r bg-rail py-2">
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={panel === p.id}
              onClick={() => setPanel(panel === p.id ? null : p.id)}
              className="mx-1.5 flex h-16 flex-col items-center justify-center gap-1 rounded-md text-caption text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-surface hover:text-foreground aria-pressed:bg-surface-strong aria-pressed:font-semibold aria-pressed:text-foreground"
            >
              <p.icon className="size-5" aria-hidden="true" />
              {p.label}
            </button>
          ))}
        </nav>
        {active && (
          <aside aria-label={active.label} className="flex w-80 shrink-0 flex-col border-r bg-background">
            <div className="flex h-12 items-center justify-between px-4">
              <h2 className="text-title-sm font-semibold">{active.label}</h2>
              <Button variant="ghost" size="icon-sm" aria-label="Close panel" onClick={() => setPanel(null)}>
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
              <PanelBody id={active.id} details={details} />
            </div>
          </aside>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center overflow-x-auto border-b bg-background">
            <ElementBar />
          </div>
          {banners}
          <div className="min-h-0 flex-1">
            <Canvas compact={false} />
          </div>
          {notesOpen && <PageNotes />}
          <div className="flex shrink-0 items-center gap-3 border-t bg-background px-3">
            <div className="min-w-0 flex-1">
              <SlideStrip compact={false} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={notesOpen}
              onClick={() => setNotesOpen(!notesOpen)}
              className="shrink-0 rounded-md aria-pressed:bg-surface-strong"
            >
              <NotebookPen aria-hidden="true" />
              Notes
            </Button>
            <SlideCount />
          </div>
        </div>
      </div>
      {dialogEl}
    </div>
  );
}

function SlideCount() {
  const label = useEditor((s) => `Slide ${s.activeSlide + 1} of ${s.deck.slides.length}`);
  return <span className="shrink-0 text-caption whitespace-nowrap text-muted-foreground tabular-nums">{label}</span>;
}
