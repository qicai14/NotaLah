import type { ReactNode, Ref } from 'react';
import { cn } from '@/lib/utils';

/** Page title with an optional count beside it (outside the h1, so the heading's name stays the title). `headingRef` lets a page return focus here. */
export function AdminHeading({
  children,
  count,
  headingRef,
}: {
  children: ReactNode;
  count?: number | string;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-bold outline-none">
        {children}
      </h1>
      {count !== undefined && count !== 0 && (
        <span aria-label={`${count} open`} className="text-body font-semibold text-muted-foreground tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

/** Outcome of the last action (polite status) and the last error (alert). The status region stays mounted so it is announced. */
export function Notices({ status, error }: { status?: ReactNode; error?: string | null }) {
  return (
    <>
      <p role="status" className={cn('text-body-sm font-medium text-success', !status && 'sr-only')}>
        {status}
      </p>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </>
  );
}

export function Loading({ children }: { children: string }) {
  return (
    <p role="status" className="text-body-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** Small neutral chip; `tone="warn"` marks restricted, suspended and deleted accounts (the text says it too, never colour alone). */
export function Chip({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <span
      className={cn(
        'rounded-sm px-2 text-caption font-semibold',
        tone === 'warn' ? 'bg-destructive/10 text-destructive' : 'bg-surface-strong text-foreground',
      )}
    >
      {children}
    </span>
  );
}

export const cardClass = 'rounded-xl border border-border bg-card p-4 shadow-(--shadow-card)';

/** Outline Button override for reject, suspend and delete style actions. */
export const dangerOutline = 'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive';
