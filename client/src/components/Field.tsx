import { type InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}

export const inputClass =
  'h-12 w-full rounded-md border border-transparent bg-surface px-4 text-body text-foreground outline-none transition-[border-color,box-shadow,background-color] duration-(--duration-fast) placeholder:text-muted-foreground hover:bg-surface-strong focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

/** Labelled input whose error is linked by aria-describedby and announced when it appears. Password fields get Show/Hide. */
export function Field({ label, name, error, hint, type, className, ...input }: FieldProps) {
  const id = `field-${name}`;
  const [shown, setShown] = useState(false);
  const password = type === 'password';
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={password && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={cn(inputClass, password && 'pr-20', className)}
          {...input}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-pressed={shown}
            aria-label={`Show ${label.toLowerCase()}`}
            className="absolute inset-y-1.5 right-1.5 rounded-sm px-3 text-body-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {shown ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
