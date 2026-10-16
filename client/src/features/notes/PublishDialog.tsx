import { useState } from 'react';
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
}: {
  initial: PublishChoice | null;
  alreadyPublished: boolean;
  busy: boolean;
  onChoose(c: PublishChoice): void;
  onClose(): void;
}) {
  const [choice, setChoice] = useState<PublishChoice | null>(initial);
  const options = alreadyPublished ? OPTIONS.slice(0, 2) : OPTIONS;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-title font-bold">Who can see this note?</DialogTitle>
        <DialogDescription className="sr-only">Choose the note&rsquo;s visibility.</DialogDescription>
        <fieldset className="flex flex-col gap-2">
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
