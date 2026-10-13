import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Field } from '../../components/Field';
import { api, ApiError, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { ModuleRef, Note } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { HashtagInput } from './HashtagInput';
import { type PublishChoice, PublishDialog } from './PublishDialog';
import { Toolbar } from './Toolbar';

const MAX_SLIDES = 30; // mirrors the server limit
const TEMPLATES = [
  ['plain', 'Plain'],
  ['lecture', 'Lecture summary'],
  ['revision', 'Revision sheet'],
  ['howto', 'Step-by-step guide'],
];

// Exactly the server sanitize allow-list (D20): StarterKit v3 also ships Underline, Link, ListKeymap and TrailingNode.
const EXTENSIONS = [StarterKit.configure({ heading: { levels: [1, 2, 3] }, underline: false, link: false, listKeymap: false, trailingNode: false })];

const isEmpty = (html: string) => html === '' || html === '<p></p>';
const preview = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28);

export default function NoteEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // After the first draft save we land here with the saved note in router state, so nothing is refetched over what was typed.
  const seed = (useLocation().state as { note?: Note } | null)?.note;
  const fetched = useFetch<{ note: Note }>(id && !seed ? `/notes/${id}` : null);
  const existing = { ...fetched, data: seed ? { note: seed } : fetched.data };
  const modules = useFetch<{ modules: ModuleRef[] }>('/modules');

  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState('plain');
  const [moduleId, setModuleId] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [slides, setSlidesState] = useState<string[]>(['']);
  const [active, setActiveState] = useState(0);
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [visibility, setVisibility] = useState<PublishChoice | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState(false);

  // Refs mirror state so editor callbacks never read a stale slide list.
  const slidesRef = useRef(slides);
  const activeRef = useRef(0);
  const setSlides = (next: string[]) => ((slidesRef.current = next), setSlidesState(next));
  const setActive = (n: number) => ((activeRef.current = n), setActiveState(n));

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: '',
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Slide content', class: 'slide-content' },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      setSlides(slidesRef.current.map((s, i) => (i === activeRef.current ? (isEmpty(html) ? '' : html) : s)));
    },
  });

  useEffect(() => {
    editor?.setEditable(!saving); // no typing while a save is in flight
  }, [editor, saving]);

  // Load an existing note once, when both the note and the editor are ready.
  const loaded = useRef(false);
  useEffect(() => {
    const note = existing.data?.note;
    if (!note || !editor || loaded.current) return;
    loaded.current = true;
    setTitle(note.title);
    setTemplate(note.template);
    setModuleId(note.module ? String(note.module.id) : '');
    setHashtags(note.hashtags);
    setStatus(note.status === 'published' ? 'published' : 'draft');
    setVisibility(note.visibility);
    const s = note.slides.length ? note.slides.map((x) => x.content) : [''];
    setSlides(s);
    setActive(0);
    editor.commands.setContent(s[0], { emitUpdate: false });
  }, [existing.data, editor]);

  function show(i: number, list = slidesRef.current) {
    setActive(i);
    editor?.commands.setContent(list[i] ?? '', { emitUpdate: false });
  }
  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    const next = [...slides, ''];
    setSlides(next);
    show(next.length - 1, next);
  }
  function removeSlide() {
    if (slides.length === 1) {
      setSlides(['']);
      return show(0, ['']);
    }
    const next = slides.filter((_, i) => i !== active);
    setSlides(next);
    show(Math.min(active, next.length - 1), next);
  }
  function move(delta: -1 | 1) {
    const to = active + delta;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[active], next[to]] = [next[to], next[active]];
    setSlides(next);
    setActive(to); // the editor already shows this slide's content
  }

  async function save(choice: PublishChoice) {
    const publishing = choice !== 'draft';
    setSaving(true);
    setErrors({});
    setMessage(null);
    const body = {
      title,
      template,
      moduleId: moduleId ? Number(moduleId) : null,
      hashtags,
      slides: slidesRef.current,
      status: publishing ? 'published' : 'draft',
      visibility: publishing ? choice : null,
    };
    try {
      const { note } = await api<{ note: Note }>(id ? `/notes/${id}` : '/notes', { method: id ? 'PUT' : 'POST', body });
      if (publishing) navigate(`/notes/${note.id}`);
      else if (id) setMessage('Draft saved.');
      else navigate(`/notes/${note.id}/edit`, { replace: true, state: { note } });
      setDialog(false);
    } catch (e) {
      setDialog(false);
      if (e instanceof ApiError && Object.keys(e.errors ?? {}).length) setErrors(e.errors);
      else setErrors({ form: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  if (id && existing.loading) return <p>Loading…</p>;
  if (id && existing.error) {
    return (
      <p role="alert" className="text-red-600">
        {existing.error}
      </p>
    );
  }
  if (id && existing.data && existing.data.note.author.id !== user?.id) {
    return (
      <p role="alert" className="text-red-600">
        You can only edit your own notes.
      </p>
    );
  }

  const published = status === 'published';
  const fieldErrors = Object.entries(errors).filter(([k]) => !['title', 'moduleId', 'hashtags', 'slides'].includes(k));
  const card = 'flex flex-col gap-1';
  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">{id ? 'Edit note' : 'Create note'}</h1>
      <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
        <Field label="Title" name="title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={card}>
            <label htmlFor="module" className="text-sm font-medium">
              Module
            </label>
            <select
              id="module"
              value={moduleId}
              onChange={(e) => setModuleId(e.target.value)}
              aria-invalid={errors.moduleId ? true : undefined}
              aria-describedby={errors.moduleId ? 'module-error' : undefined}
              className="rounded-md border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">Select a module</option>
              {modules.data?.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
            {errors.moduleId && (
              <p id="module-error" role="alert" className="text-sm text-red-600">
                {errors.moduleId}
              </p>
            )}
            {modules.error && (
              <p role="alert" className="text-sm text-red-600">
                {modules.error}
              </p>
            )}
          </div>
          <div className={card}>
            <label htmlFor="template" className="text-sm font-medium">
              Template
            </label>
            <select id="template" value={template} onChange={(e) => setTemplate(e.target.value)} className="rounded-md border border-slate-300 bg-white px-3 py-2">
              {TEMPLATES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <HashtagInput value={hashtags} onChange={setHashtags} error={errors.hashtags} />

        <div className="grid gap-3 md:grid-cols-[11rem_1fr]">
          <div>
            <h2 className="mb-1 text-sm font-medium">
              Slides ({slides.length}/{MAX_SLIDES})
            </h2>
            <ol aria-label="Slide strip" className="flex gap-1 overflow-x-auto md:max-h-80 md:flex-col md:overflow-y-auto">
              {slides.map((s, i) => (
                <li key={i} className="shrink-0">
                  <button
                    type="button"
                    aria-current={i === active ? 'true' : undefined}
                    aria-label={`Select slide ${i + 1}`}
                    onClick={() => i !== active && show(i)}
                    className={`w-32 truncate rounded-md border px-2 py-1 text-left text-sm md:w-full ${i === active ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white'}`}
                  >
                    {i + 1}. {preview(s) || <span className="text-slate-400">empty</span>}
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex flex-wrap gap-1 text-sm">
              <button type="button" onClick={addSlide} disabled={slides.length >= MAX_SLIDES} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">
                Add slide
              </button>
              <button type="button" onClick={removeSlide} className="rounded-md border border-slate-300 px-2 py-1">
                Remove slide
              </button>
              <button type="button" aria-label="Move slide up" onClick={() => move(-1)} disabled={active === 0} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">
                Up
              </button>
              <button type="button" aria-label="Move slide down" onClick={() => move(1)} disabled={active === slides.length - 1} className="rounded-md border border-slate-300 px-2 py-1 disabled:opacity-50">
                Down
              </button>
            </div>
          </div>
          <div>
            {editor && <Toolbar editor={editor} />}
            <div className="rounded-b-md border border-t-0 border-slate-300 bg-white p-3">
              <EditorContent editor={editor} />
            </div>
            {errors.slides && (
              <p role="alert" className="mt-1 text-sm text-red-600">
                {errors.slides}
              </p>
            )}
          </div>
        </div>

        {fieldErrors.length > 0 && (
          <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {fieldErrors.map(([k, v]) => (
              <p key={k}>{v}</p>
            ))}
          </div>
        )}
        {message && (
          <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            {message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {!published && (
            <button type="button" disabled={saving} onClick={() => save('draft')} className="rounded-md border border-slate-300 bg-white px-4 py-2 disabled:opacity-60">
              Save Draft
            </button>
          )}
          <button type="button" disabled={saving} onClick={() => setDialog(true)} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-60">
            {published ? 'Update' : 'Publish'}
          </button>
          <Link to="/drafts" className="px-3 py-2 text-sm text-slate-600 underline">
            Back to drafts
          </Link>
        </div>
      </fieldset>
      {dialog && (
        <PublishDialog
          initial={visibility}
          alreadyPublished={published}
          busy={saving}
          onClose={() => setDialog(false)}
          onChoose={(c) => save(c)}
        />
      )}
    </section>
  );
}
