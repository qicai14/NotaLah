import { BadgeCheck } from 'lucide-react';

/** Marks an approved lecturer next to their name. */
export function LecturerBadge() {
  return (
    <span title="Verified lecturer" className="ml-1 inline-flex items-center align-[-0.15em] text-primary">
      <BadgeCheck className="size-[1.05em]" aria-hidden="true" />
      <span className="sr-only"> verified lecturer</span>
    </span>
  );
}
