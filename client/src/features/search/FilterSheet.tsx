import { useEffect, useState } from 'react';
import { inputClass } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import type { ModuleRef } from '../../types';
import { dateRangeError, type SearchState, withFilters } from './searchParams';

export interface TermOption {
  id: number;
  name: string;
}

const label = 'text-body-sm font-semibold';
const hint = 'text-caption text-muted-foreground';

/**
 * The note filters of FR15 (lecturer, term, dates, module) as a sheet: right-hand panel on desktop, bottom sheet on
 * phones. Edits are held until "Show results", so the URL (and the request) change once. The term control is absent
 * when no terms exist; modules are absent for guests, whose API cannot list them.
 */
export function FilterSheet({
  open,
  onOpenChange,
  state,
  terms,
  modules,
  onApply,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  state: SearchState;
  terms: TermOption[];
  modules: ModuleRef[] | null;
  onApply(next: SearchState): void;
}) {
  const desktop = useMediaQuery(DESKTOP);
  const [draft, setDraft] = useState(state);
  useEffect(() => {
    if (open) setDraft(state);
  }, [open, state]);

  const patch = (p: Partial<SearchState>) => setDraft((d) => withFilters(d, p));
  const rangeError = dateRangeError(draft);
  const lecturerValue = draft.lecturer === 'any' ? 'any' : draft.lecturer ? 'one' : 'off';
  const reset = () => setDraft({ ...draft, lecturer: null, term: null, from: null, to: null, module: null });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? 'right' : 'bottom'}
        className={cn('gap-0 p-0', desktop ? 'w-[26rem] sm:max-w-[26rem]' : 'max-h-[88dvh] rounded-t-2xl border-t-0')}
      >
        <div className="flex items-center justify-between border-b px-5 py-4 pr-14">
          <SheetTitle className="text-title-sm font-bold">Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow the note results</SheetDescription>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rangeError) onApply(draft);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Lecturer content</legend>
              <label className="flex min-h-10 items-start gap-3 text-body">
                <input
                  type="checkbox"
                  checked={lecturerValue === 'any'}
                  onChange={(e) => patch({ lecturer: e.target.checked ? 'any' : null })}
                  className="mt-1 size-5 accent-primary"
                />
                <span>
                  Lecturer content only
                  <span className={cn(hint, 'block')}>Written or Super Liked by a lecturer</span>
                </span>
              </label>
              {lecturerValue === 'one' && (
                <p className={hint}>
                  Showing one lecturer's notes and the ones they validated.{' '}
                  <button
                    type="button"
                    onClick={() => patch({ lecturer: null })}
                    className="font-semibold text-primary underline underline-offset-2"
                  >
                    Clear lecturer
                  </button>
                </p>
              )}
            </fieldset>

            {terms.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-term" className={label}>
                  Academic term
                </label>
                <select
                  id="filter-term"
                  value={draft.term ?? ''}
                  onChange={(e) => patch({ term: e.target.value || null })}
                  className={inputClass}
                >
                  <option value="">Any term</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className={label}>Date range</legend>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filter-from" className="text-caption font-semibold text-muted-foreground">
                    From
                  </label>
                  <input
                    id="filter-from"
                    type="date"
                    value={draft.from ?? ''}
                    max={draft.to ?? undefined}
                    onChange={(e) => patch({ from: e.target.value || null })}
                    aria-describedby="filter-date-hint"
                    aria-invalid={rangeError ? true : undefined}
                    className={cn(inputClass, 'h-11 px-3 text-body-sm')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="filter-to" className="text-caption font-semibold text-muted-foreground">
                    To
                  </label>
                  <input
                    id="filter-to"
                    type="date"
                    value={draft.to ?? ''}
                    min={draft.from ?? undefined}
                    onChange={(e) => patch({ to: e.target.value || null })}
                    aria-describedby="filter-date-hint"
                    aria-invalid={rangeError ? true : undefined}
                    className={cn(inputClass, 'h-11 px-3 text-body-sm')}
                  />
                </div>
              </div>
              <p id="filter-date-hint" className={hint}>
                {terms.length > 0 ? 'Use a term or a custom range, not both.' : 'Days are Malaysian calendar days.'}
              </p>
              {rangeError && (
                <p role="alert" className="text-body-sm font-medium text-destructive">
                  {rangeError}
                </p>
              )}
            </fieldset>

            {modules && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="filter-module" className={label}>
                  Module
                </label>
                <select
                  id="filter-module"
                  value={draft.module ?? ''}
                  onChange={(e) => patch({ module: e.target.value || null })}
                  className={inputClass}
                >
                  <option value="">Any module</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} {m.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 border-t bg-popover px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" size="lg" onClick={reset}>
              Reset
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={!!rangeError}>
              Show results
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
