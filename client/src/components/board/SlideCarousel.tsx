import { type KeyboardEvent, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Aspect } from '@notalah/shared';
import { cn } from '@/lib/utils';
import { type BoardSlide, SlideBoard } from './SlideBoard';

export const MAX_DOTS = 7;

export interface Dot {
  index: number;
  active: boolean;
  edge: boolean;
}

/**
 * The dots to draw: every slide up to MAX_DOTS, else a window of MAX_DOTS that slides with the current slide. A window
 * edge with more slides beyond it is flagged `edge` (drawn smaller), as TikTok does.
 */
export function dotWindow(count: number, current: number, max = MAX_DOTS): Dot[] {
  const size = Math.min(count, max);
  const start = Math.max(0, Math.min(current - Math.floor(size / 2), count - size));
  return Array.from({ length: size }, (_, k) => {
    const index = start + k;
    const edge = count > size && ((k === 0 && start > 0) || (k === size - 1 && start + size < count));
    return { index, active: index === current, edge };
  });
}

const arrow =
  'grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-media media-shadow transition-[opacity,transform] duration-(--duration-fast) ease-(--ease-out-soft) active:scale-90 disabled:pointer-events-none disabled:opacity-0';

/**
 * A note's slides, one at a time. Only the active slide and its two neighbours are mounted (the neighbours hidden, so
 * their images are fetched before the reader turns the page). The parent gives it a height; the board fits inside.
 */
export function SlideCarousel({
  slides,
  aspect,
  assets,
}: {
  slides: BoardSlide[];
  aspect: Aspect;
  assets: Record<string, string>;
}) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const group = useRef<HTMLDivElement>(null);
  const last = slides.length - 1;
  const cur = Math.min(index, Math.max(0, last));
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));
  /** A chevron that has just reached the end fades out and is disabled, so focus moves to the carousel instead of being lost. */
  const step = (to: number) => {
    go(to);
    if (to <= 0 || to >= last) group.current?.focus();
  };

  if (slides.length === 0) return <p className="text-body-sm text-muted-foreground">This note has no slides.</p>;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(cur - 1);
    else if (e.key === 'ArrowRight') go(cur + 1);
  };

  return (
    <div
      ref={group}
      role="group"
      aria-roledescription="carousel"
      aria-label="Slides"
      tabIndex={0}
      onKeyDown={onKey}
      className="relative size-full min-h-0 rounded-lg bg-media-backdrop outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="relative size-full touch-pan-y rounded-lg"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
        }}
      >
        {slides.map((slide, i) =>
          Math.abs(i - cur) > 1 ? null : (
            <div
              key={i}
              inert={i !== cur}
              className={
                i === cur ? 'size-full rounded-lg' : 'pointer-events-none absolute inset-0 rounded-lg opacity-0'
              }
            >
              <SlideBoard slide={slide} aspect={aspect} assets={assets} label={`Slide ${i + 1} of ${slides.length}`} />
            </div>
          ),
        )}
      </div>
      {slides.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1">
          <button
            type="button"
            aria-label="Previous slide"
            disabled={cur === 0}
            onClick={() => step(cur - 1)}
            className={cn(arrow, 'pointer-events-auto')}
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <div aria-hidden="true" className="flex h-11 items-center gap-1.5 media-shadow">
            {dotWindow(slides.length, cur).map((d) => (
              <span
                key={d.index}
                data-dot={d.active ? 'current' : d.edge ? 'edge' : 'idle'}
                className={cn(
                  'rounded-full transition-[width,height,background-color] duration-(--duration-base) ease-(--ease-out-soft)',
                  d.active ? 'size-2 bg-media' : d.edge ? 'size-1 bg-media-dim' : 'size-1.5 bg-media-dim',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next slide"
            disabled={cur === last}
            onClick={() => step(cur + 1)}
            className={cn(arrow, 'pointer-events-auto')}
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        Slide {cur + 1} of {slides.length}
      </p>
    </div>
  );
}
