import { useState } from 'react';

/** Delete-style button that asks "Sure?" inline instead of window.confirm. */
export function ConfirmButton({ label, onConfirm, disabled }: { label: string; onConfirm(): void; disabled?: boolean }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" disabled={disabled} onClick={() => setAsking(true)} className="rounded-md border border-red-300 px-2 py-1 text-sm text-red-700 disabled:opacity-60">
        {label}
      </button>
    );
  }
  return (
    <span role="group" aria-label={`Confirm: ${label}`} className="inline-flex items-center gap-1 text-sm">
      <span className="text-red-700">Are you sure?</span>
      <button
        type="button"
        autoFocus
        onClick={() => {
          setAsking(false);
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
