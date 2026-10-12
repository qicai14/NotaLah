import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';

interface Application {
  id: number;
  displayName: string;
  email: string;
  staffId: string | null;
  programme: string | null;
  createdAt: string;
}

export default function AdminLecturers() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ applications: Application[] }>('/admin/lecturer-applications')
      .then((d) => setApps(d.applications))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load applications.'));
  }, []);

  async function decide(app: Application, action: 'approve' | 'reject', body?: { reason: string }) {
    setError(null);
    setBusy(true);
    try {
      await api(`/admin/lecturer-applications/${app.id}/${action}`, { method: 'POST', body: body ?? {} });
      setApps((list) => list?.filter((a) => a.id !== app.id) ?? null);
      setRejecting(null);
      setReason('');
      setStatus(`${app.displayName} ${action === 'approve' ? 'approved as a lecturer' : 'rejected'}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function onReject(e: FormEvent, app: Application) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    void decide(app, 'reject', { reason: reason.trim() });
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Lecturer applications</h1>
      <p role="status" className="mb-2 text-sm text-green-700">
        {status}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {apps === null && !error && <p className="text-slate-500">Loading…</p>}
      {apps?.length === 0 && <p className="text-slate-500">No pending applications.</p>}
      {apps && apps.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th scope="col" className="py-2 pr-3">Name</th>
                <th scope="col" className="py-2 pr-3">Email</th>
                <th scope="col" className="py-2 pr-3">Staff ID</th>
                <th scope="col" className="py-2 pr-3">Programme</th>
                <th scope="col" className="py-2 pr-3">Applied</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-slate-200 align-top">
                  <td className="py-2 pr-3">{a.displayName}</td>
                  <td className="py-2 pr-3 break-all">{a.email}</td>
                  <td className="py-2 pr-3">{a.staffId}</td>
                  <td className="py-2 pr-3">{a.programme}</td>
                  <td className="py-2 pr-3">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    {rejecting === a.id ? (
                      <form onSubmit={(e) => onReject(e, a)} className="flex flex-col gap-2">
                        <label htmlFor={`reason-${a.id}`} className="text-xs font-medium">
                          Reason for rejecting
                        </label>
                        <input
                          id={`reason-${a.id}`}
                          autoFocus
                          maxLength={300}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          className="rounded-md border border-slate-300 px-2 py-1"
                        />
                        <div className="flex gap-2">
                          <button type="submit" disabled={busy} className="rounded-md bg-red-600 px-3 py-1 text-white disabled:opacity-60">
                            Confirm reject
                          </button>
                          <button type="button" onClick={() => setRejecting(null)} className="rounded-md border border-slate-300 px-3 py-1">
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => decide(a, 'approve')}
                          aria-label={`Approve ${a.displayName}`}
                          className="rounded-md bg-green-600 px-3 py-1 text-white disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setRejecting(a.id);
                            setReason('');
                            setError(null);
                          }}
                          aria-label={`Reject ${a.displayName}`}
                          className="rounded-md border border-red-600 px-3 py-1 text-red-700"
                        >
                          Reject
                        </button>
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
