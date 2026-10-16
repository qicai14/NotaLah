import { Highlighter } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Verified by Dr Lee": the lecturer-validation mark (FR1, FR2), drawn as a highlighter stroke. */
export function VerifiedPill({ by, className }: { by: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'highlighter inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-caption font-bold',
        className,
      )}
    >
      <Highlighter className="size-3.5" aria-hidden="true" />
      Verified by {by ?? 'a lecturer'}
    </span>
  );
}
