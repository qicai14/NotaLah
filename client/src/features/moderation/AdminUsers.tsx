import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Field } from '../../components/Field';
import { api, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { AdminUser } from '../../types';

type Action = 'restrict' | 'suspend' | 'reinstate' | 'delete';
const LABEL: Record<Action, string> = { restrict: 'Restrict', suspend: 'Suspend', reinstate: 'Reinstate', delete: 'Delete' };

/** Actions that change something for an account in this status; administrators and deleted accounts get none. */
function actionsFor(u: AdminUser): Action[] {
  if (u.role === 'admin' || u.status === 'deleted') return [];
  return (['restrict', 'suspend', 'reinstate', 'delete'] as Action[]).filter(
    (a) => !(a === 'restrict' && u.status === 'restricted') && !(a === 'suspend' && u.status === 'suspended') && !(a === 'reinstate' && u.status === 'active'),
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
      const r = await api<{ user: AdminUser }>(`/admin/users/${u.id}/${action}`, { method: 'POST', body: { reason: reason.trim() } });
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
    <section>
      <h1 className="mb-4 text-xl font-semibold">Users</h1>
      <form onSubmit={search} role="search" className="mb-4 flex items-end gap-2">
        <div className="flex-1">
          <Field label="Search by name or email" name="user-search" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-white">
          Search
        </button>
      </form>
      <p role="status" className="mb-2 text-sm text-green-700">
        {status}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {loading && <p className="text-slate-500">Loading…</p>}
      {data?.users.length === 0 && <p className="text-slate-500">No matching accounts.</p>}
      {data && data.users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th scope="col" className="py-2 pr-3">Name</th>
                <th scope="col" className="py-2 pr-3">Email</th>
                <th scope="col" className="py-2 pr-3">Role</th>
                <th scope="col" className="py-2 pr-3">Status</th>
                <th scope="col" className="py-2 pr-3">Upheld reports</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-3">{u.displayName}</td>
                  <td className="py-2 pr-3 break-all">{u.email}</td>
                  <td className="py-2 pr-3">
                    {u.role}
                    {u.lecturerStatus === 'pending' && ' (lecturer pending)'}
                  </td>
                  <td className="py-2 pr-3">{u.status}</td>
                  <td className="py-2 pr-3">{u.upheldReports}</td>
                  <td className="py-2">
                    {pending?.id === u.id ? (
                      <form onSubmit={(e) => confirm(e, u, pending.action)} className="flex flex-col gap-2">
                        <Field
                          label={`Reason to ${pending.action} ${u.displayName}`}
                          name={`reason-${u.id}`}
                          autoFocus
                          maxLength={300}
                          value={reason}
                          error={formError}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button type="submit" disabled={busy} className="rounded-md bg-red-600 px-3 py-1 text-white disabled:opacity-60">
                            Confirm {pending.action}
                          </button>
                          <button type="button" onClick={() => (setPending(null), setFormError(undefined))} className="rounded-md border border-slate-300 px-3 py-1">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {actionsFor(u).map((a) => (
                          <button
                            key={a}
                            type="button"
                            disabled={busy}
                            onClick={() => (setPending({ id: u.id, action: a }), setReason(''), setFormError(undefined))}
                            aria-label={`${LABEL[a]} ${u.displayName}`}
                            className={`rounded-md border px-2 py-1 ${a === 'delete' || a === 'suspend' ? 'border-red-400 text-red-700' : 'border-slate-300'}`}
                          >
                            {LABEL[a]}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
