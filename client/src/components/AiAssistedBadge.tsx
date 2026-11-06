import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The note was saved with accepted AI output (R28, ADR 0094); set by the server, never removed. */
export function AiAssistedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border bg-surface px-2.5 py-1 text-caption font-bold text-foreground',
        className,
      )}
    >
      <Sparkles className="size-3.5" aria-hidden="true" />
      AI-assisted
    </span>
  );
}
