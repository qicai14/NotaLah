import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

type Item = { label: string; text: string; active?: string; attrs?: Record<string, unknown>; run(e: Editor): void };

// One entry per node/mark the server allow-list accepts, and nothing else.
const ITEMS: Item[] = [
  { label: 'Bold', text: 'B', active: 'bold', run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'Italic', text: 'I', active: 'italic', run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'Strikethrough', text: 'S', active: 'strike', run: (e) => e.chain().focus().toggleStrike().run() },
  { label: 'Inline code', text: '</>', active: 'code', run: (e) => e.chain().focus().toggleCode().run() },
  {
    label: 'Heading 1',
    text: 'H1',
    active: 'heading',
    attrs: { level: 1 },
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    label: 'Heading 2',
    text: 'H2',
    active: 'heading',
    attrs: { level: 2 },
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Heading 3',
    text: 'H3',
    active: 'heading',
    attrs: { level: 3 },
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: 'Bullet list',
    text: '• List',
    active: 'bulletList',
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Numbered list',
    text: '1. List',
    active: 'orderedList',
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  { label: 'Quote', text: '“ ”', active: 'blockquote', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code block', text: '{ }', active: 'codeBlock', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Line break', text: '↵', run: (e) => e.chain().focus().setHardBreak().run() },
  { label: 'Horizontal rule', text: '―', run: (e) => e.chain().focus().setHorizontalRule().run() },
];

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render when the selection or marks change so aria-pressed stays current.
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ITEMS.map((i) => (i.active ? e.isActive(i.active, i.attrs) : false)),
  });
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap gap-1 rounded-t-md border border-input bg-surface p-1"
    >
      {ITEMS.map((i, n) => (
        <button
          key={i.label}
          type="button"
          aria-label={i.label}
          title={i.label}
          aria-pressed={i.active ? active[n] : undefined}
          onClick={() => i.run(editor)}
          className={`min-w-9 rounded px-2 py-1 text-sm ${active[n] ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-surface'} border border-border`}
        >
          {i.text}
        </button>
      ))}
    </div>
  );
}
