import {
  type Alignment,
  alignBoxes,
  BOARD_WIDTH,
  boardHeight,
  type Box,
  distributeBoxes,
  groupBounds,
  type SlideElement,
} from '@parp/shared';
import { mapElements, useEditor } from './store';

export const boxOf = (e: SlideElement): Box => ({ x: e.x, y: e.y, w: e.w, h: e.h, rotation: e.rotation });

/** The selected elements on the active slide, in slide (stacking) order. */
export function selectedElements(): SlideElement[] {
  const { deck, activeSlide, selection } = useEditor.getState();
  return deck.slides[activeSlide].elements.filter((e) => selection.includes(e.id));
}

/**
 * Aligns the selection (to its own frame, or to the slide when one element is selected) or spaces it evenly along an
 * axis. Locked elements stay where they are but still count towards the frame. One undo step.
 */
export function arrange(kind: Alignment | 'x' | 'y'): void {
  const { deck, activeSlide, apply } = useEditor.getState();
  const all = selectedElements();
  const free = all.filter((e) => !e.locked);
  if (!free.length) return;
  let out: Box[];
  if (kind === 'x' || kind === 'y') {
    out = distributeBoxes(free.map(boxOf), kind);
  } else {
    const frame =
      all.length > 1 ? groupBounds(all.map(boxOf)) : { x: 0, y: 0, w: BOARD_WIDTH, h: boardHeight(deck.aspect) };
    out = alignBoxes(free.map(boxOf), frame, kind);
  }
  if (free.every((e, i) => e.x === out[i].x && e.y === out[i].y)) return;
  const moved = new Map(free.map((e, i) => [e.id, out[i]]));
  apply((d) =>
    mapElements(d, activeSlide, [...moved.keys()], (e) => {
      const b = moved.get(e.id)!;
      return { ...e, x: b.x, y: b.y };
    }),
  );
}
