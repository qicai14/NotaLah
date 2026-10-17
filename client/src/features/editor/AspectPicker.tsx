import type { Aspect } from '@parp/shared';
import { ChevronDown, Proportions } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEditor } from './store';

export const ASPECT_LABELS: Record<Aspect, string> = {
  '4:5': '4:5 Portrait',
  '9:16': '9:16 Full screen',
  '16:9': '16:9 Widescreen',
};

const ASPECT_HINTS: Record<Aspect, string> = {
  '4:5': 'Fills a feed card; the default.',
  '9:16': 'Fills a phone screen top to bottom.',
  '16:9': 'Lecture slides and screenshots.',
};
/** The outline drawn for each size, in a 28 x 28 box. */
const ASPECT_ICON: Record<Aspect, { w: number; h: number }> = {
  '4:5': { w: 18, h: 22 },
  '9:16': { w: 14, h: 24 },
  '16:9': { w: 26, h: 15 },
};

/**
 * Slide size (wireframe 23): picking a size only marks it; Resize applies it to every slide, which scales content to
 * fit and centres it. One undo step.
 */
export function AspectPicker({ compact, disabled = false }: { compact: boolean; disabled?: boolean }) {
  const aspect = useEditor((s) => s.deck.aspect);
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Aspect>(aspect);
  const slides = useEditor((s) => s.deck.slides.length);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setChoice(aspect);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          size={compact ? 'icon-sm' : 'sm'}
          aria-label={compact ? `Slide size, ${ASPECT_LABELS[aspect]}` : undefined}
        >
          <Proportions aria-hidden="true" />
          {!compact && ASPECT_LABELS[aspect]}
          {!compact && <ChevronDown className="opacity-60" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-4 shadow-(--shadow-float)">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            useEditor.getState().setAspect(choice);
            setOpen(false);
          }}
          className="flex flex-col gap-3"
        >
          <div>
            <h2 id="aspect-title" className="text-title-sm font-semibold">
              Slide size
            </h2>
            <p id="aspect-hint" className="text-body-sm text-muted-foreground">
              Applies to all {slides === 1 ? 'the slide' : `${slides} slides`}. Content is scaled to fit and centred;
              you can undo it.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-labelledby="aspect-title"
            aria-describedby="aspect-hint"
            className="flex flex-col gap-1"
          >
            {(Object.keys(ASPECT_LABELS) as Aspect[]).map((a) => (
              <label
                key={a}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors duration-(--duration-fast) hover:bg-surface has-checked:bg-surface-strong has-focus-visible:ring-[3px] has-focus-visible:ring-ring/25"
              >
                <input
                  type="radio"
                  name="aspect"
                  value={a}
                  checked={choice === a}
                  onChange={() => setChoice(a)}
                  className="sr-only"
                />
                <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden="true">
                  <span
                    className="block rounded-[3px] border-2 border-foreground/70"
                    style={{ width: ASPECT_ICON[a].w, height: ASPECT_ICON[a].h }}
                  />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-sm font-semibold">
                    {ASPECT_LABELS[a]}
                    {a === aspect && <span className="font-normal text-muted-foreground"> · current</span>}
                  </span>
                  <span className="text-caption text-muted-foreground">{ASPECT_HINTS[a]}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={choice === aspect}>
              Resize
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
