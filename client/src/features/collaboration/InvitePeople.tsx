import { useState } from 'react';
import { Field } from '@/components/Field';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useAction } from '@/lib/useAction';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { CollabPerson, CollabRole } from '../../types';
import { RoleSelect } from './RoleSelect';

/** Search people by name and invite one with a role (R30). People who already have access are left out. */
export function InvitePeople({ noteId, skip, onInvited }: { noteId: number; skip: Set<number>; onInvited(): void }) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<CollabRole>('edit');
  const q = useDebouncedValue(query.trim(), 250);
  const found = useFetch<{ items: CollabPerson[] }>(q ? `/search?tab=people&q=${encodeURIComponent(q)}` : null);
  const { run, pending, error } = useAction();
  const people = (found.data?.items ?? []).filter((p) => !skip.has(p.id)).slice(0, 6);

  const invite = async (p: CollabPerson) => {
    const ok = await run(async () => {
      await api(`/notes/${noteId}/collaborators/${p.id}`, { method: 'PUT', body: { role } });
      return true;
    });
    if (!ok) return;
    setQuery('');
    onInvited();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <Field
            label="Search people"
            name="invite-search"
            type="search"
            autoComplete="off"
            placeholder="Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <RoleSelect value={role} onChange={setRole} label="Role for the invited person" className="h-12" />
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {q && (
        <ul aria-label="Search results" className="flex flex-col">
          {found.loading && (
            <li role="status" className="py-2 text-body-sm text-muted-foreground">
              Searching…
            </li>
          )}
          {found.error && (
            <li role="alert" className="py-2 text-body-sm font-medium text-destructive">
              {found.error}
            </li>
          )}
          {!found.loading && !found.error && people.length === 0 && (
            <li className="py-2 text-body-sm text-muted-foreground">No one new matches “{q}”.</li>
          )}
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-1.5">
              <UserAvatar name={p.displayName} />
              <span className="min-w-0 flex-1 truncate text-body font-semibold">{p.displayName}</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                aria-label={`Invite ${p.displayName}`}
                onClick={() => invite(p)}
              >
                Invite
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
