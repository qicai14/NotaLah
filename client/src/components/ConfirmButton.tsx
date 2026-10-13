import { useEffect, useRef, useState } from 'react';

/** Delete-style button that asks "Sure?" inline instead of window.confirm. Cancel returns focus to the trigger; after a confirm the row is usually gone, so focus moves to <main>. */
export function ConfirmButton({ label, onConfirm, disabled }: { label: string; onConfirm(): void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (wasAsking.current && !asking) trigger.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <button ref={trigger} type="button" disabled={disabled} onClick={() => setAsking(true)} className="rounded-md border border-red-300 px-2 py-1 text-sm text-red-700 disabled:opacity-60">
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={`Confirm: ${label}`} onKeyDown={(e) => e.key === 'Escape' && setAsking(false)} className="inline-flex items-center gap-1 text-sm">
      <span className="text-red-700">Are you sure?</span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          wasAsking.current = false; // do not refocus the trigger; the item is about to disappear
          setAsking(false);
          document.getElementById('main')?.focus();
          onConfirm();
        }}
        className="rounded-md bg-red-600 px-2 py-1 text-white"
      >
        Yes, {label.toLowerCase()}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="rounded-md border border-slate-300 px-2 py-1">
        Cancel
      </button>
    </span>
  );
}
