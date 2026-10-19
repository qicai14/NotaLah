import { Check, Copy, Link2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { api } from '../../lib/api';
import type { CollabRole, NoteAccess } from '../../types';

const COPY: Record<CollabRole, { title: string; hint: string }> = {
  view: { title: 'View link', hint: 'Anyone with the link can read the note, even without an account.' },
  edit: { title: 'Edit link', hint: 'Signed-in people who open it can join as editors.' },
};

/** One share link: create or regenerate (the address is shown once, so it can be copied now), revoke. */
function LinkRow({
  noteId,
  role,
  active,
  onChanged,
}: {
  noteId: number;
  role: CollabRole;
  active: NoteAccess['links'][number] | undefined;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const { run, pending, error } = useAction();
  const { title, hint } = COPY[role];
  const isActive = Boolean(active || url);

  const make = async () => {
    const r = await run(() => api<{ url: string }>(`/notes/${noteId}/links`, { method: 'POST', body: { role } }));
    if (!r) return;
    setUrl(r.url);
    setCopied(false);
    setCopyFailed(false);
    onChanged();
  };
  const revoke = async () => {
    const ok = await run(async () => {
      await api(`/notes/${noteId}/links/${role}`, { method: 'DELETE' });
      return true;
    });
    if (!ok) return;
    setUrl(null);
    onChanged();
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopyFailed(true);
      document.getElementById(`link-${role}`)?.focus();
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-body-sm font-semibold">
            <Link2 className="size-4" aria-hidden="true" />
            {title}
          </p>
          <p className="text-caption text-muted-foreground">{hint}</p>
        </div>
        {!isActive && (
          <Button size="sm" variant="secondary" disabled={pending} onClick={make}>
            Create link
          </Button>
        )}
      </div>
      {isActive && (
        <>
          {url ? (
            <div className="flex items-center gap-2">
              <input
                id={`link-${role}`}
                readOnly
                value={url}
                aria-label={`${title} address`}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-md bg-surface px-3 text-body-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
              />
              <Button size="sm" variant="secondary" onClick={copy}>
                {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">
              Active{active ? ` since ${new Date(active.createdAt).toLocaleDateString()}` : ''}. The address is shown
              only when you create it; regenerate to get a new one.
            </p>
          )}
          {copyFailed && (
            <p role="status" className="text-caption text-muted-foreground">
              Press Ctrl+C to copy.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" disabled={pending} onClick={make}>
              <RefreshCw aria-hidden="true" />
              Regenerate
            </Button>
            <ConfirmButton label="Revoke" focusMain={false} disabled={pending} onConfirm={revoke} />
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

export function ShareLinks({
  noteId,
  links,
  onChanged,
}: {
  noteId: number;
  links: NoteAccess['links'];
  onChanged: () => void;
}) {
  return (
    <ul className="flex flex-col gap-2.5">
      {(['view', 'edit'] as const).map((role) => (
        <LinkRow
          key={role}
          noteId={noteId}
          role={role}
          active={links.find((l) => l.role === role)}
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}
