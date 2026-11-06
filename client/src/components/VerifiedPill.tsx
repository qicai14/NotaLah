import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Verified by Dr Lee": the lecturer-validation mark (FR1, FR2), a neutral pill with only "Verified" in the dot face. */
export function VerifiedPill({ by, className }: { by: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-body-sm font-semibold text-foreground',
        className,
      )}
    >
      <Check className="size-3.5" aria-hidden="true" />
      <span>
        {/* 15px and the heaviest weight: at 13px the dots wash out on a 1x screen. */}
        <span className="font-dot text-body leading-none font-black">Verified</span> by {by ?? 'a lecturer'}
      </span>
    </span>
  );
}
