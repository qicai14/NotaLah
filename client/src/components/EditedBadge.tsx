import { PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A published note changed after a lecturer verified it, so the verification no longer counts (R30, wireframe 18). Neutral on purpose: highlighter yellow is only for validation. */
export function EditedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border bg-surface px-2.5 py-1 text-caption font-bold text-foreground',
        className,
      )}
    >
      <PencilLine className="size-3.5" aria-hidden="true" />
      Edited since verification
    </span>
  );
}
