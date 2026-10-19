import { useEffect, useRef, useState } from 'react';

/** Delete-style button that asks "Sure?" inline instead of window.confirm. Cancel returns focus to the trigger; after a confirm the row is usually gone, so focus moves to <main>. */
export function ConfirmButton({
  label,
  onConfirm,
  disabled,
  focusMain = true,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  /** Move focus to <main> after a confirm (the row is gone); false inside a dialog, which keeps its own focus. */
  focusMain?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasAsking = useRef(false);

  useEffect(() => {
    if (wasAsking.current && !asking) trigger.current?.focus();
    wasAsking.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        onClick={() => setAsking(true)}
        className="rounded-full px-2 py-1 text-body-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        {label}
      </button>
    );
  }
  return (
    <span
      role="group"
      aria-label={`Confirm: ${label}`}
      onKeyDown={(e) => e.key === 'Escape' && setAsking(false)}
      className="inline-flex flex-wrap items-center gap-1.5 text-body-sm"
    >
      <span className="font-medium text-destructive">Are you sure?</span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          wasAsking.current = false; // do not refocus the trigger; the item is about to disappear
          setAsking(false);
          if (focusMain) document.getElementById('main')?.focus();
          onConfirm();
        }}
        className="rounded-full bg-destructive px-3 py-1 font-semibold text-destructive-foreground"
      >
        Yes, {label.toLowerCase()}
      </button>
      <button
        type="button"
        onClick={() => setAsking(false)}
        className="rounded-full px-3 py-1 font-semibold hover:bg-accent"
      >
        Cancel
      </button>
    </span>
  );
}
