import { type KeyboardEvent, useRef, useState } from 'react';
import type { Slide } from '../types';

/** Read-only slide viewer. Content is HTML the server already sanitised against the editor allow-list (D20). */
export function SlideViewer({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const cur = Math.min(index, Math.max(0, slides.length - 1));
  const go = (i: number) => {
    setIndex(Math.max(0, Math.min(slides.length - 1, i)));
  };
  if (slides.length === 0) return <p className="text-sm text-slate-500">This note has no slides.</p>;

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
      className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <div
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
        }}
        aria-live="polite"
        className="slide-content h-64 overflow-auto rounded-md border border-slate-200 bg-white p-4 sm:h-72"
        dangerouslySetInnerHTML={{ __html: slides[cur].content }}
      />
      <div className="mt-2 flex items-center justify-between text-sm">
        <button
          type="button"
          aria-label="Previous slide"
          disabled={cur === 0}
          onClick={() => go(cur - 1)}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          Prev
        </button>
        <span>
          {cur + 1} of {slides.length}
        </span>
        <button
          type="button"
          aria-label="Next slide"
          disabled={cur === slides.length - 1}
          onClick={() => go(cur + 1)}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
