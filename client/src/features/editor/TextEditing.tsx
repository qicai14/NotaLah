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
  const box = useRef<HTMLDivElement>(null);
  const editor = useTipTap({
    extensions: TEXT_EXTENSIONS,
    content: el.html,
    autofocus: 'end',
    editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Edit text' } },
    onUpdate: ({ editor: e }) => {
      useEditor.getState().preview((d) => patchElement(d, slide, el.id, { html: e.isEmpty ? '' : e.getHTML() }));
      // The box grows as lines are added, so typed text is never clipped (layout px inside the board are board units).
      const content = box.current?.firstElementChild?.firstElementChild as HTMLElement | null;
      const needed = content ? content.scrollHeight + el.padding * 2 : 0;
      const current = useEditor.getState().deck.slides[slide]?.elements.find((x) => x.id === el.id);
      if (current && needed > current.h + 0.5) {
        useEditor.getState().preview((d) => patchElement(d, slide, el.id, { h: Math.ceil(needed) }));
      }
    },
  });

  useEffect(() => {
    useEditor.setState({ textEditor: editor });
    // The press that opened the box focused its frame; move focus into the text once TipTap is ready.
    requestAnimationFrame(() => editor?.commands.focus('end'));
    return () => {
      useEditor.setState({ textEditor: null });
      useEditor.getState().commit();
    };
  }, [editor]);

  return (
    <div
      ref={box}
      className="board-text size-full cursor-text overflow-hidden break-words"
      style={textBoxStyle(el)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} className="size-full" />
    </div>
  );
}
