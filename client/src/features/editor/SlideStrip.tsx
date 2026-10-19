import { type Aspect, LIMITS, type Slide } from '@notalah/shared';
import { ArrowLeft, ArrowRight, Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { memo, type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { SlideBoard } from '@/components/board/SlideBoard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useEditor } from './store';

/** A slide preview that re-renders only when its own slide changes (unchanged slides keep their object identity). */
const Thumb = memo(function Thumb({
  slide,
  aspect,
  assets,
}: {
  slide: Slide;
  aspect: Aspect;
  assets: Record<string, string>;
}) {
  return (
    <span className="pointer-events-none block size-full" aria-hidden="true">
      <SlideBoard slide={slide} aspect={aspect} assets={assets} />
    </span>
  );
});

/**
 * Thumbnails of every slide: click to open, drag with a mouse to reorder (the menu's Move left/right is the single-pointer and
 * keyboard alternative), and add, duplicate or delete.
 */
export function SlideStrip({ compact, readOnly = false }: { compact: boolean; readOnly?: boolean }) {
  const deck = useEditor((s) => s.deck);
  const active = useEditor((s) => s.activeSlide);
  const assets = useEditor((s) => s.assets);
  const { setActiveSlide, addSlide, duplicateSlide, deleteSlide, moveSlide } = useEditor.getState();
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const dragged = useRef(false);
  const full = deck.slides.length >= LIMITS.slides;
  const thumbW = compact ? 'w-12' : 'w-20';

  function startDrag(e: ReactPointerEvent, from: number) {
    // Touch drags scroll the strip; phones reorder from the slide menu instead.
    if (e.button !== 0 || e.pointerType !== 'mouse' || readOnly) return;
    const x0 = e.clientX;
    let dragging = false;
    dragged.current = false;
    const indexAt = (x: number) => {
      const items = [...(list.current?.querySelectorAll<HTMLElement>('[data-slide]') ?? [])];
      const i = items.findIndex((n) => x < n.getBoundingClientRect().right);
      return i === -1 ? items.length - 1 : i;
    };
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.abs(ev.clientX - x0) < 6) return;
      dragging = true;
      setDrag({ from, over: indexAt(ev.clientX) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragging) moveSlide(from, indexAt(ev.clientX));
      dragged.current = dragging;
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <ol ref={list} aria-label="Slides" className="flex min-w-0 items-end gap-2 overflow-x-auto px-1 py-2">
        {deck.slides.map((s, i) => (
          <li
            key={i}
            data-slide={i}
            className={cn('group relative shrink-0', drag?.over === i && drag.from !== i && 'pl-3')}
          >
            <button
              type="button"
              aria-label={`Slide ${i + 1}`}
              aria-current={i === active ? 'true' : undefined}
              onClick={() => !dragged.current && setActiveSlide(i)}
              onPointerDown={(e) => startDrag(e, i)}
              className={cn(
                'block overflow-hidden rounded-sm bg-surface ring-offset-2 ring-offset-background transition-shadow duration-(--duration-fast)',
                thumbW,
                deck.aspect === '16:9' ? 'aspect-video' : deck.aspect === '9:16' ? 'aspect-[9/16]' : 'aspect-[4/5]',
                i === active ? 'ring-2 ring-primary' : 'ring-1 ring-border hover:ring-input',
                drag?.from === i && 'opacity-50',
              )}
            >
              <Thumb slide={s} aspect={deck.aspect} assets={assets} />
            </button>
            <span className="pointer-events-none absolute bottom-1 left-1 rounded-sm bg-board-credit px-1 text-caption tabular-nums text-board-credit-foreground">
              {i + 1}
            </span>
            {!compact && !readOnly && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    aria-label={`Slide ${i + 1} options`}
                    className="absolute top-1 right-1 opacity-0 shadow-(--shadow-card) group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem disabled={full} onSelect={() => duplicateSlide(i)}>
                    <Copy /> Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === 0} onSelect={() => moveSlide(i, i - 1)}>
                    <ArrowLeft /> Move left
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === deck.slides.length - 1} onSelect={() => moveSlide(i, i + 1)}>
                    <ArrowRight /> Move right
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => deleteSlide(i)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ol>
      {!readOnly && (
        <Button
          variant="secondary"
          size={compact ? 'icon-sm' : 'icon'}
          aria-label="Add slide"
          title="Add slide"
          disabled={full}
          onClick={addSlide}
          className="shrink-0 rounded-md"
        >
          <Plus />
        </Button>
      )}
      {compact && !readOnly && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Slide ${active + 1} options`}
              className="shrink-0 rounded-md"
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={full} onSelect={() => duplicateSlide(active)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem disabled={active === 0} onSelect={() => moveSlide(active, active - 1)}>
              <ArrowLeft /> Move left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={active === deck.slides.length - 1}
              onSelect={() => moveSlide(active, active + 1)}
            >
              <ArrowRight /> Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => deleteSlide(active)}>
              <Trash2 /> Delete slide
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
