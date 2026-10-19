import { LIMITS, type SlideElement } from '@notalah/shared';
import { type CSSProperties, useEffect, useRef } from 'react';
import { FONT_STACK } from '@/components/board/geometry';
import { patchElement, useEditor } from './store';

type El<T extends SlideElement['type']> = Extract<SlideElement, { type: T }>;

/** Typing previews into the deck; the whole visit is one undo step, committed when the block closes. */
function useCommitOnClose() {
  useEffect(() => () => useEditor.getState().commit(), []);
}

/**
 * Plain-text code typed straight into the block (monospace, no highlighting; the language is a label for readers and
 * for search). Escape closes it, as for text boxes.
 */
export function CodeEditing({ el, slide }: { el: El<'code'>; slide: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useCommitOnClose();
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    t.setSelectionRange(t.value.length, t.value.length);
  }, []);
  const light = el.theme === 'light';
  return (
    <textarea
      ref={ref}
      aria-label="Edit code"
      spellCheck={false}
      maxLength={LIMITS.code}
      value={el.code}
      onPointerDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const code = e.target.value;
        useEditor.getState().preview((d) => patchElement(d, slide, el.id, { code }));
      }}
      className="block size-full resize-none outline-none"
      style={{
        margin: 0,
        padding: el.size * 0.8,
        borderRadius: el.size * 0.5,
        fontFamily: FONT_STACK['jetbrains-mono'],
        fontSize: el.size,
        lineHeight: 1.45,
        whiteSpace: 'pre',
        overflow: 'hidden',
        background: light ? 'var(--board-code-light)' : 'var(--board-code-dark)',
        color: light ? 'var(--board-code-light-foreground)' : 'var(--board-code-dark-foreground)',
        caretColor: 'currentColor',
      }}
    />
  );
}

/** Every cell of the table as a text field, laid out like the table itself; Tab moves cell to cell. */
export function TableEditing({ el, slide }: { el: El<'table'>; slide: number }) {
  const first = useRef<HTMLInputElement>(null);
  useCommitOnClose();
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const setCell = (r: number, c: number, v: string) =>
    useEditor.getState().preview((d) =>
      patchElement(d, slide, el.id, {
        cells: el.cells.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)),
      }),
    );
  const cell: CSSProperties = {
    border: `2px solid ${el.borderColor}`,
    padding: 0,
  };
  return (
    <table
      className="size-full"
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontFamily: FONT_STACK[el.font],
        fontSize: el.size,
        color: el.color,
      }}
    >
      <tbody>
        {el.cells.map((row, r) => (
          <tr key={r}>
            {row.map((value, c) => (
              <td key={c} style={cell}>
                <input
                  ref={r === 0 && c === 0 ? first : undefined}
                  aria-label={`Row ${r + 1}, column ${c + 1}${el.headerRow && r === 0 ? ', header' : ''}`}
                  value={value}
                  maxLength={LIMITS.tableCell}
                  onChange={(e) => setCell(r, c, e.target.value)}
                  className="block w-full bg-transparent outline-none focus:bg-primary/10"
                  style={{
                    padding: el.size * 0.4,
                    fontWeight: el.headerRow && r === 0 ? 700 : undefined,
                    color: 'inherit',
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
