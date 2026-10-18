import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { api, ApiError } from '../../lib/api';
import type { CollabRole } from '../../types';
import { RoleSelect } from './RoleSelect';

/**
 * Role picker with Decline and Approve for one pending request (wireframes 27, 44). The owner's share dialog uses it
 * now; the notification list (R8) mounts the same component. `onDecided` fires after the server accepts the decision.
 */
export function CollabRequestActions({
  noteId,
  requestId,
  name,
  onDecided,
}: {
  noteId: number;
  requestId: number;
  name: string;
  onDecided(decision: 'approve' | 'decline'): void;
}) {
  const [role, setRole] = useState<CollabRole>('edit');
  const { run, pending, error } = useAction();

  const decide = async (decision: 'approve' | 'decline') => {
    const ok = await run(async () => {
      try {
        await api(`/notes/${noteId}/requests/${requestId}`, { method: 'POST', body: { decision, role } });
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 409)) throw e; // already decided elsewhere: drop the row
      }
      return true;
    });
    if (ok) onDecided(decision);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <RoleSelect value={role} onChange={setRole} label={`Role for ${name}`} disabled={pending} />
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => decide('decline')}>
          Decline
        </Button>
        <Button size="sm" disabled={pending} onClick={() => decide('approve')}>
          Approve
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
