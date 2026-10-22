import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageMessage } from '@/components/PageMessage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SlideCarousel } from '../../components/board/SlideCarousel';
import { inputClass } from '../../components/Field';
import { api, errorText } from '../../lib/api';
import { useAction } from '../../lib/useAction';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { ReportGroup, ReportSummary } from '../../types';
import { AdminHeading, cardClass, Chip, Loading, Notices } from './parts';

type Report = ReportGroup['reports'][number];

const remarkClass = cn(inputClass, 'h-auto py-3');

/** Who reported what and when, one line per report. */
function ReportLines({ reports }: { reports: Report[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1 text-body-sm">
      {reports.map((r) => (
        <li key={r.id}>
          <span className="font-semibold">{r.reason}</span> by {r.reporter}, {timeAgo(r.createdAt)}
          {r.details && <span className="text-muted-foreground"> — {r.details}</span>}
        </li>
      ))}
    </ul>
  );
}

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
    <li className="rounded-xl border border-border bg-surface p-3">
      <p className="text-body-sm">
        <span className="rounded-sm bg-annotation px-1.5">“{a.quote}”</span> {a.gone && <Chip>Deleted or hidden</Chip>}
      </p>
      <p className="mt-1 text-body-sm whitespace-pre-wrap">{a.body}</p>
      <p className="mt-1 text-caption text-muted-foreground">Annotation by {a.author}</p>
      <ReportLines reports={reports} />
      <div className="mt-3 flex flex-col gap-1.5">
        <label htmlFor={`ann-remark-${a.id}`} className="text-body-sm font-semibold">
          Resolution remark (required)
        </label>
        <textarea
          id={`ann-remark-${a.id}`}
          value={remark}
          maxLength={300}
          rows={2}
          onChange={(e) => setRemark(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={remarkClass}
        />
        {error && (
          <p role="alert" className="text-body-sm font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={() => resolve('dismiss')}>
          Dismiss
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={() => resolve('hide')}>
          Hide annotation
        </Button>
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
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const reviewButtons = useRef(new Map<number, HTMLButtonElement>());
  const lastOpen = useRef<number | null>(null);
  // The panel sits below the queue; bring it into view and move focus there when a review opens.
  const openKey = open?.id;
  useEffect(() => {
    if (openKey !== undefined) panel.current?.focus();
  }, [openKey]);
  // When the panel closes, focus goes back to that group's Review button, or the heading if the row is gone.
  useEffect(() => {
    if (openId === null && lastOpen.current !== null)
      (reviewButtons.current.get(lastOpen.current) ?? heading.current)?.focus();
    lastOpen.current = openId;
  }, [openId]);
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
    if (open.reportCount - count > 0) return;
    setOpenId(null);
    if (data?.nextCursor && data.groups.every((g) => g.id === open.id)) reload(); // page emptied: fetch the next groups
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
    <section className="flex flex-col gap-4">
      <AdminHeading
        headingRef={heading}
        count={data ? `${data.groups.length}${data.nextCursor ? '+' : ''}` : undefined}
      >
        Reported content
      </AdminHeading>
      <Notices
        error={error ?? detail.error}
        status={
          status && (
            <>
              {status}{' '}
              {hidden && (
                <Link to={`/admin/users?q=${encodeURIComponent(hidden.name)}`} className="text-primary underline">
                  Review {hidden.name}&apos;s account
                </Link>
              )}
            </>
          )
        }
      />
      {loading && <Loading>Loading…</Loading>}
      {data?.groups.length === 0 && (
        <PageMessage title="No open reports" body="Reported notes and annotations appear here, oldest first." />
      )}
      {data && data.groups.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.groups.map((g) => (
            <li
              key={g.id}
              className={cn(
                cardClass,
                'flex flex-wrap items-center justify-between gap-3',
                g.id === openId && 'border-primary',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-title-sm font-semibold break-words">{g.title}</p>
                <p className="text-body-sm text-muted-foreground">
                  by {g.author.displayName} · {g.reportCount} {g.reportCount === 1 ? 'report' : 'reports'} · oldest{' '}
                  {timeAgo(g.oldestReportAt)}
                </p>
                <p className="text-body-sm">{[...new Set(g.reports.map((r) => r.reason))].join(', ')}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="max-md:min-h-11"
                onClick={() => (setOpenId(g.id), setRemark(''), setFormError(null))}
                aria-label={`Review ${g.title}`}
                ref={(el) => void (el ? reviewButtons.current.set(g.id, el) : reviewButtons.current.delete(g.id))}
              >
                Review
              </Button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <section
          ref={panel}
          tabIndex={-1}
          aria-label={`Review ${open.title}`}
          className={cn(cardClass, 'flex scroll-mt-20 flex-col gap-3')}
        >
          <h2 className="text-title font-bold">{open.title}</h2>
          <p className="text-body-sm text-muted-foreground">
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
              <h3 className="text-title-sm font-semibold">Reported annotations</h3>
              <ul className="flex flex-col gap-3">
                {[...byAnnotation].map(([annId, rs]) => (
                  <AnnotationReview key={annId} reports={rs} onResolved={annotationResolved} />
                ))}
              </ul>
            </>
          )}
          {noteReports.length > 0 && (
            <>
              <h3 className="text-title-sm font-semibold">Reports on the note</h3>
              <ReportLines reports={noteReports} />
              <form onSubmit={(e) => resolve(e, 'dismiss')} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resolve-remark" className="text-body-sm font-semibold">
                    Resolution remark (required)
                  </label>
                  <textarea
                    id="resolve-remark"
                    value={remark}
                    maxLength={300}
                    rows={2}
                    onChange={(e) => setRemark(e.target.value)}
                    aria-invalid={formError ? true : undefined}
                    className={remarkClass}
                  />
                  {formError && (
                    <p role="alert" className="text-body-sm font-medium text-destructive">
                      {formError}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="outline" disabled={busy}>
                    Dismiss
                  </Button>
                  <Button type="button" variant="destructive" disabled={busy} onClick={(e) => resolve(e, 'hide')}>
                    Hide note
                  </Button>
                </div>
              </form>
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start max-md:min-h-11"
            onClick={() => setOpenId(null)}
          >
            Close
          </Button>
        </section>
      )}
    </section>
  );
}
