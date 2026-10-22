import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Field } from '@/components/Field';
import { PageMessage } from '@/components/PageMessage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { AdminUser } from '../../types';
import { AdminHeading, cardClass, Chip, dangerOutline, Loading, Notices } from './parts';

type Action = 'restrict' | 'suspend' | 'reinstate' | 'delete';
const LABEL: Record<Action, string> = {
  restrict: 'Restrict',
  suspend: 'Suspend',
  reinstate: 'Reinstate',
  delete: 'Delete',
};

/** Actions that change something for an account in this status; administrators and deleted accounts get none. */
function actionsFor(u: AdminUser): Action[] {
  if (u.role === 'admin' || u.status === 'deleted') return [];
  return (['restrict', 'suspend', 'reinstate', 'delete'] as Action[]).filter(
    (a) =>
      !(a === 'restrict' && u.status === 'restricted') &&
      !(a === 'suspend' && u.status === 'suspended') &&
      !(a === 'reinstate' && u.status === 'active'),
  );
}

/** User management (UC21, wireframe 24): search, then restrict, suspend, reinstate or delete with a recorded reason. */
export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const { data, setData, error, loading } = useFetch<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`);
  const [pending, setPending] = useState<{ id: number; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | undefined>();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function search(e: FormEvent) {
    e.preventDefault();
    setParams(draft.trim() ? { q: draft.trim() } : {});
  }

  async function confirm(e: FormEvent, u: AdminUser, action: Action) {
    e.preventDefault();
    if (!reason.trim()) return setFormError('Reason is required');
    setBusy(true);
    setFormError(undefined);
    try {
      const r = await api<{ user: AdminUser }>(`/admin/users/${u.id}/${action}`, {
        method: 'POST',
        body: { reason: reason.trim() },
      });
      setData((d) => d && { users: d.users.map((x) => (x.id === u.id ? r.user : x)) });
      setStatus(`${u.displayName}: ${LABEL[action].toLowerCase()} done (status ${r.user.status}).`);
      setPending(null);
      setReason('');
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <AdminHeading>Users</AdminHeading>
      <form onSubmit={search} role="search" className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field
            label="Search by name or email"
            name="user-search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>
      <Notices status={status} error={error} />
      {loading && <Loading>Loading…</Loading>}
      {data?.users.length === 0 && (
        <PageMessage title="No matching accounts" body="Try a different name or email, or clear the search." />
      )}
      {data && data.users.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.users.map((u) => (
            <li key={u.id} className={cardClass}>
              <div className="flex items-start gap-3">
                <UserAvatar name={u.displayName} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="text-title-sm font-semibold break-words">{u.displayName}</p>
                  <p className="text-body-sm break-all text-muted-foreground">{u.email}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-muted-foreground">
                    <Chip>{u.role}</Chip>
                    <Chip tone={u.status === 'active' ? undefined : 'warn'}>{u.status}</Chip>
                    {u.lecturerStatus === 'pending' && <Chip>lecturer pending</Chip>}
                    <span className="tabular-nums">
                      {u.upheldReports} upheld {u.upheldReports === 1 ? 'report' : 'reports'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {pending?.id === u.id ? (
                  <form onSubmit={(e) => confirm(e, u, pending.action)} className="flex flex-col gap-3">
                    <Field
                      label={`Reason to ${pending.action} ${u.displayName}`}
                      name={`reason-${u.id}`}
                      autoFocus
                      maxLength={300}
                      value={reason}
                      error={formError}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="destructive" disabled={busy}>
                        Confirm {pending.action}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => (setPending(null), setFormError(undefined))}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {actionsFor(u).map((a) => (
                      <Button
                        key={a}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => (setPending({ id: u.id, action: a }), setReason(''), setFormError(undefined))}
                        aria-label={`${LABEL[a]} ${u.displayName}`}
                        className={cn('max-md:min-h-11', (a === 'delete' || a === 'suspend') && dangerOutline)}
                      >
                        {LABEL[a]}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
