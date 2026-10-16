import { type KeyboardEvent, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Aspect } from '@parp/shared';
import { Button } from '@/components/ui/button';
import { type BoardSlide, SlideBoard } from './SlideBoard';

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
  const last = slides.length - 1;
  const cur = Math.min(index, Math.max(0, last));
  const go = (i: number) => setIndex(Math.max(0, Math.min(last, i)));

  if (slides.length === 0) return <p className="text-body-sm text-muted-foreground">This note has no slides.</p>;

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(cur - 1);
    else if (e.key === 'ArrowRight') go(cur + 1);
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Slides"
      tabIndex={0}
      onKeyDown={onKey}
      className="flex size-full min-h-0 flex-col gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div
        className="min-h-0 flex-1 touch-pan-y rounded-lg"
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
            <div key={i} hidden={i !== cur} className="size-full rounded-lg">
              <SlideBoard slide={slide} aspect={aspect} assets={assets} label={`Slide ${i + 1} of ${slides.length}`} />
            </div>
          ),
        )}
      </div>
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Previous slide"
          disabled={cur === 0}
          onClick={() => go(cur - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span aria-live="polite" className="text-body-sm font-semibold tabular-nums">
          {cur + 1} of {slides.length}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Next slide"
          disabled={cur === last}
          onClick={() => go(cur + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
