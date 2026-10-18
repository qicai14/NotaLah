import { LIMITS } from '@parp/shared';
import { mapSlide, useEditor } from './store';

/** Private page notes for the active slide (R21 spec 1.2); typing is one undo step per visit to the box. */
export function PageNotes({ readOnly = false }: { readOnly?: boolean }) {
  const active = useEditor((s) => s.activeSlide);
  const notes = useEditor((s) => s.deck.slides[s.activeSlide].notes);
  return (
    <div className="flex flex-col gap-1 border-t bg-background px-4 py-2">
      <label htmlFor="page-notes" className="text-caption font-semibold text-muted-foreground">
        Notes for slide {active + 1} (only you and co-authors see these)
      </label>
      <textarea
        id="page-notes"
        rows={2}
        maxLength={LIMITS.pageNotes}
        value={notes}
        readOnly={readOnly}
        placeholder="What to say about this slide"
        onChange={(e) => {
          const text = e.target.value;
          useEditor.getState().preview((d) => mapSlide(d, active, (s) => ({ ...s, notes: text })));
        }}
        onBlur={() => useEditor.getState().commit()}
        className="w-full resize-none rounded-md border border-input bg-surface px-3 py-2 text-body-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25"
      />
    </div>
  );
}
