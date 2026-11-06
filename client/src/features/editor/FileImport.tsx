import { useState } from 'react';
import { importFile } from './importFile';

/** Reads a chosen file in the browser and hands its text to the paste box; nothing is sent from here. */
export function FileImport({
  limit,
  disabled,
  onText,
}: {
  limit: number;
  disabled: boolean;
  onText: (text: string) => void;
}) {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    try {
      const { text, truncated } = await importFile(file, limit);
      onText(text);
      setMsg(
        truncated
          ? {
              text: `The file was longer than ${limit.toLocaleString()} characters, so the text was cut to fit.`,
              error: false,
            }
          : null,
      );
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
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
        disabled={disabled}
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
