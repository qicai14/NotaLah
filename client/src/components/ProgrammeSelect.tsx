import type { ChangeEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFetch } from '../lib/useFetch';
import { inputClass } from './Field';

interface Props {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
}

/** Programme picker fed by the public catalogue; a stored value missing from it stays selectable so it is not silently changed. */
export function ProgrammeSelect({ value, onChange, error }: Props) {
  const { data, error: loadError, reload } = useFetch<{ items: string[] }>('/programmes');
  const items = data?.items ?? [];
  const options = value && !items.includes(value) ? [value, ...items] : items;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="field-programme" className="text-body-sm font-semibold">
        Programme
      </label>
      <div className="relative">
        <select
          id="field-programme"
          className={cn(inputClass, 'cursor-pointer appearance-none pr-10')}
          name="programme"
          value={value}
          onChange={onChange}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'field-programme-error' : undefined}
        >
          <option value="">Choose a programme</option>
          {options.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
      {loadError && (
        <div className="flex items-center gap-2 text-body-sm text-destructive">
          <p role="alert">Could not load programmes. {loadError}</p>
          <button type="button" onClick={reload} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}
      {error && (
        <p id="field-programme-error" role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
