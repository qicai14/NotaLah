import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { SlideCarousel } from '../../components/board/SlideCarousel';
import { api, errorText } from '../../lib/api';
import { useAction } from '../../lib/useAction';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { ReportGroup, ReportSummary } from '../../types';

type Report = ReportGroup['reports'][number];

/** One reported annotation (R10): its quote, body and author, its reports, and a dismiss or hide that leaves the note alone. */
function AnnotationReview({
  reports,
  onResolved,
}: {
  reports: Report[];
  onResolved: (annotationId: number, outcome: 'dismiss' | 'hide', count: number) => void;
}) {
  const a = reports[0].annotation!;
  const [remark, setRemark] = useState('');
  const { run, pending, error, setError } = useAction();
  const resolve = async (outcome: 'dismiss' | 'hide') => {
    if (!remark.trim()) return setError('Remark is required');
    const r = await run(() =>
      api<{ resolved: number }>(`/admin/reports/annotations/${a.id}/resolve`, {
        method: 'POST',
        body: { outcome, remark: remark.trim() },
      }),
    );
    if (r) onResolved(a.id, outcome, r.resolved);
  };
  return (
    <li className="rounded-md border border-border p-3">
      <p className="text-sm">
        <span className="rounded-sm bg-annotation px-1.5">“{a.quote}”</span>{' '}
        {a.gone && <span className="rounded-sm bg-surface-strong px-1.5 text-xs font-semibold">Deleted or hidden</span>}
      </p>
      <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
      <p className="mt-1 text-xs text-muted-foreground">Annotation by {a.author}</p>
      <ul className="my-2 flex flex-col gap-1 text-sm">
        {reports.map((r) => (
          <li key={r.id}>
            <span className="font-medium">{r.reason}</span> by {r.reporter}, {timeAgo(r.createdAt)}
            {r.details && <span className="text-muted-foreground"> — {r.details}</span>}
          </li>
        ))}
      </ul>
      <label htmlFor={`ann-remark-${a.id}`} className="text-sm font-medium">
        Resolution remark (required)
      </label>
      <textarea
        id={`ann-remark-${a.id}`}
        value={remark}
        maxLength={300}
        rows={2}
        onChange={(e) => setRemark(e.target.value)}
        aria-invalid={error ? true : undefined}
        className="mt-1 w-full rounded-md border border-input px-3 py-2"
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve('dismiss')}
          className="rounded-md border border-input px-3 py-1 disabled:opacity-60"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => resolve('hide')}
          className="rounded-md bg-destructive px-3 py-1 text-primary-foreground disabled:opacity-60"
        >
          Hide annotation
        </button>
      </div>
    </li>
  );
}

/** Reported content queue (UC20, wireframe 23): open reports grouped by note, oldest first; resolve with a remark. */
export default function AdminReports() {
  // shortcut: shows the first page (20) only; the redesign adds "load more" with nextCursor
  const { data, setData, error, loading, reload } = useFetch<{
    groups: ReportSummary[];
    nextCursor: string | null;
  }>('/admin/reports');
  const [openId, setOpenId] = useState<number | null>(null);
  const detail = useFetch<{ group: ReportGroup }>(openId === null ? null : `/admin/reports/${openId}`);
  const [remark, setRemark] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hidden, setHidden] = useState<{ id: number; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const open = detail.data?.group;
  const noteReports = open?.reports.filter((r) => !r.annotation) ?? [];
  const byAnnotation = new Map<number, Report[]>();
  for (const r of open?.reports ?? [])
    if (r.annotation) byAnnotation.set(r.annotation.id, [...(byAnnotation.get(r.annotation.id) ?? []), r]);

  /** Drops one annotation's resolved reports from the open group and its queue row; a row with none left goes. */
  function annotationResolved(annotationId: number, outcome: 'dismiss' | 'hide', count: number) {
    if (!open) return;
    const keep = (rs: Report[]) => rs.filter((r) => r.annotation?.id !== annotationId);
    detail.setData(
      (d) => d && { group: { ...d.group, reports: keep(d.group.reports), reportCount: d.group.reportCount - count } },
    );
    setData(
      (d) =>
        d && {
          ...d,
          groups: d.groups
            .map((g) => (g.id === open.id ? { ...g, reports: keep(g.reports), reportCount: g.reportCount - count } : g))
            .filter((g) => g.reportCount > 0),
        },
    );
    setStatus(`Annotation ${outcome === 'hide' ? 'hidden' : 'kept visible'}; ${count} report(s) resolved.`);
    setHidden(null);
    if (open.reportCount - count <= 0) setOpenId(null);
  }

  async function resolve(e: FormEvent, outcome: 'dismiss' | 'hide') {
    e.preventDefault();
    if (!open) return;
    if (!remark.trim()) return setFormError('Remark is required');
    setBusy(true);
    setFormError(null);
    try {
      await api(`/admin/reports/${open.id}/resolve`, {
        method: 'POST',
        body: { outcome, remark: remark.trim() },
      });
      // Annotation reports stay open after a note-level resolve, so the row stays while any remain.
      const left = open.reports.filter((r) => r.annotation);
      setData(
        (d) =>
          d && {
            ...d,
            groups: d.groups
              .map((g) => (g.id === open.id ? { ...g, reports: left, reportCount: left.length } : g))
              .filter((g) => g.reportCount > 0),
          },
      );
      if (data?.nextCursor && !left.length && data.groups.every((g) => g.id === open.id)) reload(); // page emptied: fetch the next groups
      setStatus(
        `"${open.title}" ${outcome === 'hide' ? 'hidden' : 'kept visible'}; ${noteReports.length} report(s) resolved.`,
      );
      setHidden(outcome === 'hide' ? { id: open.author.id, name: open.author.displayName } : null);
      setOpenId(null);
      setRemark('');
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="mb-4 text-xl font-semibold">Reported content</h1>
      <p role="status" className="mb-2 text-sm text-success">
        {status}{' '}
        {hidden && (
          <Link to={`/admin/users?q=${encodeURIComponent(hidden.name)}`} className="text-primary underline">
            Review {hidden.name}'s account
          </Link>
        )}
      </p>
      {(error ?? detail.error) && (
        <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error ?? detail.error}
        </p>
      )}
      {loading && <p className="text-muted-foreground">Loading…</p>}
      {data?.groups.length === 0 && <p className="text-muted-foreground">No open reports.</p>}
      {data && data.groups.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-input">
                <th scope="col" className="py-2 pr-3">
                  Note
                </th>
                <th scope="col" className="py-2 pr-3">
                  Author
                </th>
                <th scope="col" className="py-2 pr-3">
                  Reports
                </th>
                <th scope="col" className="py-2 pr-3">
                  Reasons
                </th>
                <th scope="col" className="py-2 pr-3">
                  Oldest
                </th>
                <th scope="col" className="py-2">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {data.groups.map((g) => (
                <tr key={g.id} className={`border-b border-border align-top ${g.id === openId ? 'bg-primary/10' : ''}`}>
                  <td className="py-2 pr-3">{g.title}</td>
                  <td className="py-2 pr-3">{g.author.displayName}</td>
                  <td className="py-2 pr-3">{g.reportCount}</td>
                  <td className="py-2 pr-3">{[...new Set(g.reports.map((r) => r.reason))].join(', ')}</td>
                  <td className="py-2 pr-3">{timeAgo(g.oldestReportAt)}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => (setOpenId(g.id), setRemark(''), setFormError(null))}
                      aria-label={`Review ${g.title}`}
                      className="rounded-md border border-input px-3 py-1"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <section aria-label={`Review ${open.title}`} className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-lg font-semibold">{open.title}</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            by {open.author.displayName} · {open.module?.code} · status {open.status} ·{' '}
            <Link to={`/notes/${open.id}`} className="text-primary underline">
              Open note
            </Link>
          </p>
          <div className="h-[min(30rem,60dvh)]">
            <SlideCarousel
              slides={open.slides}
              aspect={open.aspect}
              assets={open.assets}
              videoStatus={open.videoStatus}
            />
          </div>
          {byAnnotation.size > 0 && (
            <>
              <h3 className="mt-4 font-medium">Reported annotations</h3>
              <ul className="mt-2 flex flex-col gap-3">
                {[...byAnnotation].map(([annId, rs]) => (
                  <AnnotationReview key={annId} reports={rs} onResolved={annotationResolved} />
                ))}
              </ul>
            </>
          )}
          {noteReports.length > 0 && (
            <>
              <h3 className="mt-4 font-medium">Reports on the note</h3>
              <ul className="mb-4 flex flex-col gap-1 text-sm">
                {noteReports.map((r) => (
                  <li key={r.id}>
                    <span className="font-medium">{r.reason}</span> by {r.reporter}, {timeAgo(r.createdAt)}
                    {r.details && <span className="text-muted-foreground"> — {r.details}</span>}
                  </li>
                ))}
              </ul>
              <form onSubmit={(e) => resolve(e, 'dismiss')} className="flex flex-col gap-2">
                <label htmlFor="resolve-remark" className="text-sm font-medium">
                  Resolution remark (required)
                </label>
                <textarea
                  id="resolve-remark"
                  value={remark}
                  maxLength={300}
                  rows={2}
                  onChange={(e) => setRemark(e.target.value)}
                  aria-invalid={formError ? true : undefined}
                  className="rounded-md border border-input px-3 py-2"
                />
                {formError && (
                  <p role="alert" className="text-sm text-destructive">
                    {formError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md border border-input px-3 py-1 disabled:opacity-60"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => resolve(e, 'hide')}
                    className="rounded-md bg-destructive px-3 py-1 text-primary-foreground disabled:opacity-60"
                  >
                    Hide note
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="rounded-md px-3 py-1 text-muted-foreground"
                  >
                    Close
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}
    </section>
  );
}
