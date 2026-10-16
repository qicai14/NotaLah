import { type ReactNode, useEffect, useId, useRef } from 'react';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal: focus moves in on open and back to the opener on close; Escape closes; Tab stays inside. */
export function Dialog({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current!;
    (box.querySelector<HTMLElement>(FOCUSABLE) ?? box).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab') {
        const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return e.preventDefault();
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in items-end justify-center bg-overlay fade-in-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90dvh] w-full max-w-md animate-in overflow-y-auto rounded-t-2xl bg-popover p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-(--shadow-float) outline-none duration-200 slide-in-from-bottom-4 sm:rounded-2xl sm:pb-6 sm:zoom-in-95 sm:slide-in-from-bottom-0"
      >
        <h2 id={titleId} className="mb-4 text-title font-bold">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
