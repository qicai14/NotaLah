import type { ReactNode, RefObject } from 'react';
import { ConfirmButton } from '@/components/ConfirmButton';
import { UserAvatar } from '@/components/UserAvatar';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAction } from '@/lib/useAction';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { CollabRole, NoteAccess } from '../../types';
import { CollabRequestActions } from './CollabRequestActions';
import { InvitePeople } from './InvitePeople';
import { RoleSelect } from './RoleSelect';
import { ShareLinks } from './ShareLinks';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-title-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** Share dialog (wireframe 27, owner only): invite by search, who has access, requests, view and edit links. */
export function ShareDialog({
  noteId,
  title,
  ownerId,
  ownerName,
  onClose,
  returnFocus,
}: {
  noteId: number;
  title: string;
  ownerId: number;
  ownerName: string;
  onClose(): void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const access = useFetch<NoteAccess>(`/notes/${noteId}/access`);
  const change = useAction();
  const data = access.data;

  const setRole = (userId: number, role: CollabRole) =>
    change.run(async () => {
      await api(`/notes/${noteId}/collaborators/${userId}`, { method: 'PUT', body: { role } });
      access.reload();
    });
  const remove = (userId: number) =>
    change.run(async () => {
      await api(`/notes/${noteId}/collaborators/${userId}`, { method: 'DELETE' });
      access.reload();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[min(44rem,92dvh)] gap-6 overflow-y-auto p-5 sm:max-w-xl sm:p-6"
        onCloseAutoFocus={(e) => {
          if (!returnFocus?.current) return;
          e.preventDefault();
          returnFocus.current.focus();
        }}
      >
        <div className="pr-8">
          <DialogTitle className="text-title font-bold text-balance">Share “{title}”</DialogTitle>
          <DialogDescription className="mt-1 text-body-sm text-muted-foreground">
            Editors can change the slides and title. Only you can publish, delete or change who sees the note.
          </DialogDescription>
        </div>

        {access.loading && (
          <p role="status" className="py-6 text-center text-body-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {access.error && !data && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
            {access.error}
          </p>
        )}

        {data && (
          <>
            <Section title="Invite people">
              <InvitePeople
                noteId={noteId}
                skip={new Set([ownerId, ...data.collaborators.map((c) => c.user.id)])}
                onInvited={access.reload}
              />
            </Section>

            {data.requests.length > 0 && (
              <Section title={`Requests (${data.requests.length})`}>
                <ul className="flex flex-col gap-3">
                  {data.requests.map((r) => (
                    <li key={r.id} className="flex flex-col gap-2 rounded-xl border p-3.5">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={r.user.displayName} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-semibold">{r.user.displayName}</p>
                          <p className="text-caption text-muted-foreground">asked {timeAgo(r.createdAt)}</p>
                        </div>
                      </div>
                      {r.message && <p className="text-body-sm text-pretty">“{r.message}”</p>}
                      <CollabRequestActions
                        noteId={noteId}
                        requestId={r.id}
                        name={r.user.displayName}
                        onDecided={access.reload}
                      />
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="People with access">
              <ul className="flex flex-col">
                <li className="flex items-center gap-3 py-1.5">
                  <UserAvatar name={ownerName} />
                  <span className="min-w-0 flex-1 truncate text-body font-semibold">{ownerName} (you)</span>
                  <span className="text-body-sm font-semibold text-muted-foreground">Owner</span>
                </li>
                {data.collaborators.map((c) => (
                  <li key={c.user.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5">
                    <UserAvatar name={c.user.displayName} />
                    <span className="min-w-0 flex-1 basis-32 truncate text-body font-semibold">
                      {c.user.displayName}
                    </span>
                    <RoleSelect
                      value={c.role}
                      label={`Role for ${c.user.displayName}`}
                      disabled={change.pending}
                      onChange={(role) => setRole(c.user.id, role)}
                    />
                    <ConfirmButton label="Remove" disabled={change.pending} onConfirm={() => remove(c.user.id)} />
                  </li>
                ))}
              </ul>
              {data.collaborators.length === 0 && (
                <p className="text-body-sm text-muted-foreground">Only you for now. Invite someone or share a link.</p>
              )}
              {change.error && (
                <p role="alert" className="text-body-sm font-medium text-destructive">
                  {change.error}
                </p>
              )}
            </Section>

            <Section title="Links">
              <ShareLinks noteId={noteId} links={data.links} onChanged={access.reload} />
            </Section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
