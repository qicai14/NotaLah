import { type Aspect, BOARD_WIDTH, boardHeight, type Fill, type FontId, type SlideElement } from '@notalah/shared';

/** Scale that fits the whole board inside a box of the given pixel size; 0 until the box has been measured. */
export const fitScale = (boxW: number, boxH: number, aspect: Aspect): number =>
  boxW > 0 && boxH > 0 ? Math.min(boxW / BOARD_WIDTH, boxH / boardHeight(aspect)) : 0;

/** Elements in reading order (y, then x) with the z-index each keeps from its place in the array (R21 spec 1.1). */
export const inReadingOrder = (elements: SlideElement[]): { el: SlideElement; z: number }[] =>
  elements.map((el, z) => ({ el, z })).sort((a, b) => a.el.y - b.el.y || a.el.x - b.el.x);

/** Size and offset of the full image inside its frame so that only the crop rectangle (fractions 0-1) shows. */
export const cropBox = (w: number, h: number, crop: { x: number; y: number; w: number; h: number }) => {
  const cw = Math.max(crop.w, 0.01);
  const ch = Math.max(crop.h, 0.01);
  return {
    width: w / cw,
    height: h / ch,
    left: (-crop.x * w) / cw,
    top: (-crop.y * h) / ch,
  };
};

/** Triangle with its tip at (x, y), pointing right (dir 1) or left (dir -1). */
export const arrowHead = (x: number, y: number, dir: 1 | -1, size: number): string =>
  `${x},${y} ${x - dir * size},${y - size / 2} ${x - dir * size},${y + size / 2}`;

export const shapePoints = (shape: 'triangle' | 'diamond' | 'arrow', w: number, h: number, inset: number): string => {
  const [l, t, r, b] = [inset, inset, w - inset, h - inset];
  if (shape === 'triangle') return `${w / 2},${t} ${r},${b} ${l},${b}`;
  if (shape === 'diamond') return `${w / 2},${t} ${r},${h / 2} ${w / 2},${b} ${l},${h / 2}`;
  const neck = w * 0.6;
  return `${l},${h * 0.3} ${neck},${h * 0.3} ${neck},${t} ${r},${h / 2} ${neck},${b} ${neck},${h * 0.7} ${l},${h * 0.7}`;
};

export const backgroundCss = (fill: Fill): string | undefined =>
  fill.kind === 'color'
    ? fill.color
    : fill.kind === 'gradient'
      ? `linear-gradient(${fill.angle}deg, ${fill.from}, ${fill.to})`
      : undefined;

/** Curated fonts (R21 spec 1.2) with system fallbacks; the self-hosted woff2 files arrive with R21d. */
export const FONT_STACK: Record<FontId, string> = {
  'source-sans-3': "'Source Sans 3', ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
  atkinson: "'Atkinson Hyperlegible', ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
  lora: 'Lora, ui-serif, Georgia, serif',
  merriweather: 'Merriweather, ui-serif, Georgia, serif',
  montserrat: "Montserrat, ui-sans-serif, system-ui, 'Segoe UI', sans-serif",
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, 'Cascadia Code', Menlo, monospace",
};
