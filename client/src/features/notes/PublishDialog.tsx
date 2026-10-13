import { useState } from 'react';
import { Dialog } from '../../components/Dialog';

export type PublishChoice = 'public' | 'contacts' | 'draft';

const OPTIONS: { value: PublishChoice; title: string; text: string }[] = [
  { value: 'public', title: 'Public', text: 'Everyone on PARP can see this note.' },
  { value: 'contacts', title: 'Contacts only', text: 'Only people in your contacts can see it.' },
  { value: 'draft', title: 'Keep as private draft', text: 'Only you can see it. Publish later.' },
];

/** FR10: the three choices are native radios styled as identical cards so none is nudged. A published note cannot go back to draft (D21). */
export function PublishDialog({ initial, alreadyPublished, busy, onChoose, onClose }: {
  initial: PublishChoice | null; alreadyPublished: boolean; busy: boolean; onChoose(c: PublishChoice): void; onClose(): void;
}) {
  const [choice, setChoice] = useState<PublishChoice | null>(initial);
  const options = alreadyPublished ? OPTIONS.slice(0, 2) : OPTIONS;
  return (
    <Dialog title="Who can see this note?" onClose={onClose}>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Visibility</legend>
        {options.map((o) => (
          <label key={o.value} className="block cursor-pointer">
            <input type="radio" name="visibility" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="peer sr-only" />
            <span className="block rounded-md border-2 border-slate-300 bg-white px-4 py-3 peer-checked:border-indigo-600 peer-checked:bg-indigo-50 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500">
              <span className="block font-medium">{o.title}</span>
              <span className="block text-sm text-slate-600">{o.text}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2">
          Cancel
        </button>
        <button type="button" disabled={!choice || busy} onClick={() => choice && onChoose(choice)} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">
          {busy ? 'Saving…' : 'Confirm'}
        </button>
      </div>
    </Dialog>
  );
}
