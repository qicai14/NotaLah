import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** The NotaLah mark: an ink-blue tile with a folded corner, plus the wordmark unless `compact`. */
export function Logo({ compact = false, to = '/', className }: { compact?: boolean; to?: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label="NotaLah home"
      className={cn('inline-flex items-center gap-2.5 rounded-md text-foreground', className)}
    >
      <span
        aria-hidden="true"
        className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-[0.65rem] bg-primary text-[1.05rem] font-extrabold text-primary-foreground"
      >
        N
        <span className="absolute top-0 right-0 size-2.5 rounded-bl-[0.3rem] bg-primary-foreground/35" />
      </span>
      {!compact && <span className="text-title-sm font-extrabold tracking-[-0.03em]">NotaLah</span>}
    </Link>
  );
}
