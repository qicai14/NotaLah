import type { ReactNode } from 'react';

/** Centred title, one sentence and an optional action: empty results, dead links, missing pages. */
export function PageMessage({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <p className="text-title font-bold">{title}</p>
      <p className="mt-2 text-body text-muted-foreground">{body}</p>
      {action && <div className="mt-5 flex flex-col items-center gap-2">{action}</div>}
    </div>
  );
}
