import { type KeyboardEvent, useState } from 'react';

import { LIMITS } from '@parp/shared';
import { addHashtags } from '../../lib/hashtags';

/** Chip input: Enter or comma adds a tag, '#' is stripped, tags are lowercased and unique. */
export function HashtagInput({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange(v: string[]): void;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  function commit(raw: string) {
    const { tags, error: err } = addHashtags(value, raw);
    setLocal(err);
    if (tags !== value) onChange(tags);
    if (!err) setText('');
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(text);
    } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  }

  const shown = local ?? error;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="hashtag-input" className="text-sm font-medium">
        Hashtags ({value.length}/{LIMITS.hashtags})
      </label>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-md border bg-card px-2 py-1.5 ${shown ? 'border-destructive' : 'border-input'}`}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-sm text-primary"
          >
            #{t}
            <button
              type="button"
              aria-label={`Remove hashtag ${t}`}
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id="hashtag-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => text && commit(text)}
          aria-invalid={shown ? true : undefined}
          aria-describedby="hashtag-hint"
          className="min-w-24 flex-1 outline-none"
        />
      </div>
      <p id="hashtag-hint" className="text-xs text-muted-foreground">
        Press Enter or comma to add. At least one is needed to publish.
      </p>
      {shown && (
        <p role="alert" className="text-sm text-destructive">
          {shown}
        </p>
      )}
    </div>
  );
}
