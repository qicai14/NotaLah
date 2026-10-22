import { GraduationCap } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Field } from '@/components/Field';
import { PageMessage } from '@/components/PageMessage';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/UserAvatar';
import { api, ApiError } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { LecturerApplication } from '../../types';
import { AdminHeading, cardClass, dangerOutline, Loading, Notices } from './parts';

export default function AdminLecturers() {
  const [apps, setApps] = useState<LecturerApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ applications: LecturerApplication[] }>('/admin/lecturer-applications')
      .then((d) => setApps(d.applications))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load applications.'));
  }, []);

  async function decide(app: LecturerApplication, action: 'approve' | 'reject', body?: { reason: string }) {
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

  function onReject(e: FormEvent, app: LecturerApplication) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    void decide(app, 'reject', { reason: reason.trim() });
  }

  return (
    <section className="flex flex-col gap-4">
      <AdminHeading count={apps?.length}>Lecturer applications</AdminHeading>
      <Notices status={status} error={rejecting === null ? error : null} />
      {apps === null && !error && <Loading>Loading…</Loading>}
      {apps?.length === 0 && (
        <PageMessage
          title="No pending applications"
          body="New lecturer applications appear here for you to approve or reject."
        />
      )}
      {apps && apps.length > 0 && (
        <ul className="flex flex-col gap-3">
          {apps.map((a) => (
            <li key={a.id} className={cardClass}>
              <div className="flex items-start gap-3">
                <UserAvatar name={a.displayName} className="size-11" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-title-sm font-semibold">
                    <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words">{a.displayName}</span>
                  </p>
                  <p className="text-body-sm break-all text-muted-foreground">{a.email}</p>
                  <p className="mt-1 text-body-sm text-muted-foreground">
                    {[a.staffId && `Staff ID ${a.staffId}`, a.programme, `Applied ${timeAgo(a.createdAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <div className="mt-3">
                {rejecting === a.id ? (
                  <form onSubmit={(e) => onReject(e, a)} className="flex flex-col gap-3">
                    <Field
                      label="Reason for rejecting"
                      name={`reason-${a.id}`}
                      autoFocus
                      maxLength={300}
                      value={reason}
                      error={error ?? undefined}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" variant="destructive" disabled={busy}>
                        Confirm reject
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRejecting(null);
                          setError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => decide(a, 'approve')}
                      aria-label={`Approve ${a.displayName}`}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      className={dangerOutline}
                      onClick={() => {
                        setRejecting(a.id);
                        setReason('');
                        setError(null);
                      }}
                      aria-label={`Reject ${a.displayName}`}
                    >
                      Reject
                    </Button>
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
