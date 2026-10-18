import { type Aspect, BOARD_WIDTH, boardHeight } from '@parp/shared';
import { useState } from 'react';
import { type BoardSlide, SlideBoard } from '@/components/board/SlideBoard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export type PublishChoice = 'public' | 'contacts' | 'draft';

const OPTIONS: { value: PublishChoice; title: string; text: string }[] = [
  { value: 'public', title: 'Public', text: 'Everyone on NotaLah can see this note.' },
  { value: 'contacts', title: 'Friends only', text: 'Only your friends can see it.' },
  { value: 'draft', title: 'Keep as private draft', text: 'Only you can see it. Publish later.' },
];

/** FR10: the three choices are native radios styled as identical cards so none is nudged. A published note cannot go back to draft (D21). */
export function PublishDialog({
  initial,
  alreadyPublished,
  busy,
  onChoose,
  onClose,
  title = 'Who can see this note?',
  note,
  preview,
}: {
  initial: PublishChoice | null;
  alreadyPublished: boolean;
  busy: boolean;
  /** Replaces the heading, as when the owner publishes from a locked editor (wireframe 29). */
  title?: string;
  /** A line under the heading saying what will be published. */
  note?: string;
  /** The note as readers will first see it (wireframe 26): its first slide, size and length. */
  preview?: { title: string; slide: BoardSlide; aspect: Aspect; slides: number; assets: Record<string, string> };
  onChoose(c: PublishChoice): void;
  onClose(): void;
}) {
  const [choice, setChoice] = useState<PublishChoice | null>(initial);
  const options = alreadyPublished ? OPTIONS.slice(0, 2) : OPTIONS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={preview ? 'sm:max-w-xl' : 'sm:max-w-md'}>
        <DialogTitle className="text-title font-bold">{title}</DialogTitle>
        {note ? (
          <DialogDescription className="-mt-2 text-body-sm text-muted-foreground">{note}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">Choose the note&rsquo;s visibility.</DialogDescription>
        )}
        <div className={preview ? 'flex flex-col gap-4 sm:flex-row sm:items-start' : 'contents'}>
          {preview && (
            <figure className="flex shrink-0 items-center gap-3 sm:w-40 sm:flex-col sm:items-stretch">
              <div
                inert
                aria-hidden="true"
                className="w-20 shrink-0 overflow-hidden rounded-md border border-border bg-surface-strong shadow-(--shadow-card) sm:w-full"
                style={{ aspectRatio: BOARD_WIDTH / boardHeight(preview.aspect) }}
              >
                <SlideBoard slide={preview.slide} aspect={preview.aspect} assets={preview.assets} />
              </div>
              <figcaption className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-body-sm font-semibold">{preview.title || 'Untitled note'}</span>
                <span className="text-caption text-muted-foreground">
                  {preview.slides} {preview.slides === 1 ? 'slide' : 'slides'} · {preview.aspect}
                </span>
              </figcaption>
            </figure>
          )}
          <fieldset className="flex min-w-0 flex-1 flex-col gap-2">
            <legend className="sr-only">Visibility</legend>
            {options.map((o) => (
              <label key={o.value} className="block cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value={o.value}
                  checked={choice === o.value}
                  onChange={() => setChoice(o.value)}
                  className="peer sr-only"
                />
                <span className="block rounded-md border-2 border-input bg-card px-4 py-3 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                  <span className="block font-medium">{o.title}</span>
                  <span className="block text-sm text-muted-foreground">{o.text}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!choice || busy} onClick={() => choice && onChoose(choice)}>
            {busy ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
