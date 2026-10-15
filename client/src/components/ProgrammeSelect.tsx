import type { ChangeEvent } from 'react';
import { useFetch } from '../lib/useFetch';

interface Props {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  error?: string;
}

/** Programme picker fed by the public catalogue; a stored value missing from it stays selectable so it is not silently changed. */
export function ProgrammeSelect({ value, onChange, error }: Props) {
  const { data } = useFetch<{ items: string[] }>('/programmes');
  const items = data?.items ?? [];
  const options = value && !items.includes(value) ? [value, ...items] : items;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="field-programme" className="text-sm font-medium">
        Programme
      </label>
      <select
        id="field-programme"
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
      {error && (
        <p id="field-programme-error" role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
