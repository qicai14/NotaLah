import type { TextElement } from '@parp/shared';
import { EditorContent, useEditor as useTipTap } from '@tiptap/react';
import { useEffect, useRef } from 'react';
import { textBoxStyle } from '@/components/board/SlideBoard';
import { TEXT_EXTENSIONS } from './elements';
import { patchElement, useEditor } from './store';

/**
 * TipTap mounted inside the one text box being edited (R21 spec 5). Typing previews into the deck so autosave sees it;
 * the whole edit becomes one undo step when the box closes. TipTap owns Ctrl+Z while it has focus.
 */
export function TextEditing({ el, slide }: { el: TextElement; slide: number }) {
  const base = useRef(useEditor.getState().deck);
  const editor = useTipTap({
    extensions: TEXT_EXTENSIONS,
    content: el.html,
    autofocus: 'end',
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Edit text' } },
    onUpdate: ({ editor: e }) =>
      useEditor.getState().preview((d) => patchElement(d, slide, el.id, { html: e.isEmpty ? '' : e.getHTML() })),
  });

  useEffect(() => {
    useEditor.setState({ textEditor: editor });
    return () => {
      useEditor.setState({ textEditor: null });
      useEditor.getState().commitFrom(base.current);
    };
  }, [editor]);

  return (
    <div
      className="board-text size-full cursor-text overflow-hidden break-words"
      style={textBoxStyle(el)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} className="size-full" />
    </div>
  );
}
