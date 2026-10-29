import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Field } from '@/components/Field';
import { PageMessage } from '@/components/PageMessage';
import { ProgrammeSelect } from '@/components/ProgrammeSelect';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '../../lib/api';
import { useAction } from '../../lib/useAction';
import { useFetch } from '../../lib/useFetch';
import { AdminHeading, cardClass, Loading, Notices } from './parts';

interface AdminModule {
  id: number;
  code: string;
  name: string;
  programme: string;
  noteCount: number;
}

type Fields = Record<string, string>;

const EMPTY = { code: '', name: '', programme: '' };

/** Field errors show beside their input (returning null tells useAction they are handled); anything else is the shared alert. */
const fieldErrors = (set: (f: Fields) => void) => (e: unknown) => {
  if (e instanceof ApiError && Object.keys(e.errors ?? {}).length > 0) {
    set(e.errors);
    return null;
  }
  return e instanceof ApiError ? e.message : 'Could not reach the server. Please try again.';
};

export default function AdminModules() {
  const { data, error: loadError, loading, setData } = useFetch<{ modules: AdminModule[] }>('/admin/modules');
  const add = useAction();
  const rename = useAction();
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [addErrors, setAddErrors] = useState<Fields>({});
  const [editing, setEditing] = useState<AdminModule | null>(null);
  const [newName, setNewName] = useState('');
  const [renameError, setRenameError] = useState<string>();
  const lastEdited = useRef<number | null>(null);

  // The edit form unmounts on Save or Cancel; return focus to that row's Rename button.
  useEffect(() => {
    if (!editing && lastEdited.current !== null) document.getElementById(`rename-${lastEdited.current}`)?.focus();
  }, [editing]);

  function closeEditor() {
    lastEdited.current = editing?.id ?? null;
    setEditing(null);
  }

  async function onAdd(ev: FormEvent) {
    ev.preventDefault();
    setStatus(null);
    setAddErrors({});
    rename.setError(null);
    const out = await add.run(
      () => api<{ module: AdminModule }>('/admin/modules', { method: 'POST', body: draft }),
      fieldErrors(setAddErrors),
    );
    if (!out) return;
    setData((d) => ({ modules: [...(d?.modules ?? []), out.module].sort((a, b) => a.code.localeCompare(b.code)) }));
    setDraft(EMPTY);
    setStatus(`Subject ${out.module.code} added.`);
  }

  async function onRename(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    setStatus(null);
    setRenameError(undefined);
    add.setError(null);
    if (newName.trim() === editing.name) return closeEditor();
    const out = await rename.run(
      () => api<{ module: AdminModule }>(`/admin/modules/${editing.id}`, { method: 'PATCH', body: { name: newName } }),
      fieldErrors((f) => setRenameError(f.name ?? Object.values(f)[0])),
    );
    if (!out) return;
    setData((d) => ({ modules: d?.modules.map((m) => (m.id === out.module.id ? out.module : m)) ?? [] }));
    setStatus(`Subject ${out.module.code} renamed.`);
    closeEditor();
  }

  const modules = data?.modules;
  return (
    <section className="flex flex-col gap-4">
      <AdminHeading>Subjects</AdminHeading>
      <Notices status={status} error={loadError ?? add.error ?? rename.error} />
      <form onSubmit={onAdd} className={`${cardClass} flex flex-col gap-3`} aria-label="Add a subject">
        <Field
          label="Code"
          name="code"
          maxLength={20}
          value={draft.code}
          error={addErrors.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
        />
        <Field
          label="Name"
          name="name"
          maxLength={150}
          value={draft.name}
          error={addErrors.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <ProgrammeSelect
          value={draft.programme}
          error={addErrors.programme}
          onChange={(e) => setDraft({ ...draft, programme: e.target.value })}
        />
        <div>
          <Button type="submit" disabled={add.pending}>
            Add subject
          </Button>
        </div>
      </form>
      {loading && <Loading>Loading…</Loading>}
      {modules?.length === 0 && <PageMessage title="No subjects yet" body="Add the first subject above." />}
      {modules && modules.length > 0 && (
        <ul className="flex flex-col gap-3">
          {modules.map((m) => (
            <li key={m.id} className={cardClass}>
              {editing?.id === m.id ? (
                <form onSubmit={onRename} className="flex flex-col gap-3">
                  <Field
                    label={`Name for ${m.code}`}
                    name={`name-${m.id}`}
                    autoFocus
                    maxLength={150}
                    value={newName}
                    error={renameError}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={rename.pending}>
                      Save
                    </Button>
                    <Button type="button" variant="ghost" onClick={closeEditor}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-title-sm font-semibold break-words">
                      {m.code} · {m.name}
                    </p>
                    <p className="text-body-sm text-muted-foreground">
                      {m.programme} · {m.noteCount} {m.noteCount === 1 ? 'note' : 'notes'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    id={`rename-${m.id}`}
                    aria-label={`Rename ${m.code}`}
                    onClick={() => {
                      setEditing(m);
                      setNewName(m.name);
                      setRenameError(undefined);
                      setStatus(null);
                      add.setError(null);
                    }}
                  >
                    Rename
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
