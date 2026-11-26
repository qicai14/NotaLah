import type { Slide } from '@notalah/shared';

export interface AssetRef {
  id: number;
  kind: 'image' | 'video';
  /** "Slide 2, element 1" or "Slide 2" for a background, for error messages. */
  where: string;
}

/** Every uploaded asset a deck points at: image elements, video elements and image backgrounds. */
export function assetRefs(slides: Pick<Slide, 'background' | 'elements'>[]): AssetRef[] {
  const refs: AssetRef[] = [];
  slides.forEach((slide, i) => {
    const bg = slide.background;
    if (bg.kind === 'image' && bg.image.kind === 'upload') {
      refs.push({ id: bg.image.assetId, kind: 'image', where: `Slide ${i + 1}` });
    }
    slide.elements.forEach((e, j) => {
      const where = `Slide ${i + 1}, element ${j + 1}`;
      if (e.type === 'image' && e.source.kind === 'upload') refs.push({ id: e.source.assetId, kind: 'image', where });
      if (e.type === 'video') refs.push({ id: e.assetId, kind: 'video', where });
    });
  });
  return refs;
}
