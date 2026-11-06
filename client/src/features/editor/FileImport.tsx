import { useEffect, useRef, useState } from 'react';
import { importFile } from './importFile';

/** Reads a chosen file in the browser and hands its text to the paste box; nothing is sent from here. */
export function FileImport({
  limit,
  disabled,
  onText,
  onBusy,
}: {
  limit: number;
  disabled: boolean;
  onText: (text: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  useEffect(() => () => void latest.current++, []); // closing the dialog drops a read still in flight

  async function pick(file: File | undefined) {
    if (!file) return;
    const id = ++latest.current;
    setBusy(true);
    onBusy?.(true);
    try {
      const { text, truncated, note } = await importFile(file, limit);
      if (id !== latest.current) return;
      onText(text);
      setMsg(
        truncated
          ? {
              text:
                note ?? `The file was longer than ${limit.toLocaleString()} characters, so the text was cut to fit.`,
              error: false,
            }
          : null,
      );
    } catch (e) {
      if (id === latest.current) setMsg({ text: (e as Error).message, error: true });
    } finally {
      if (id === latest.current) {
        setBusy(false);
        onBusy?.(false);
      }
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="draft-file" className="text-body-sm font-semibold">
        Or import a file (.txt, .md, .docx, .pdf, up to 5 MB)
      </label>
      <input
        id="draft-file"
        type="file"
        accept=".txt,.md,.docx,.pdf"
        disabled={disabled || busy}
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
        className="text-body-sm"
      />
      <p className="text-caption text-muted-foreground">
        The file stays on your device. Its text fills the box below and goes to an external AI service only when you
        press Send.
      </p>
      {msg && (
        <p
          role={msg.error ? 'alert' : 'status'}
          className={msg.error ? 'text-body-sm font-medium text-destructive' : 'text-body-sm'}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
