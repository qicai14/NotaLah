import { Editor } from '@tiptap/react';
import { TEXT_EXTENSIONS } from './elements';

export type BoxMark = 'bold' | 'italic' | 'underline' | 'strike';
export type BoxList = 'bulletList' | 'orderedList';

const TAGS: Record<BoxMark | BoxList, string> = {
  bold: 'strong, b',
  italic: 'em, i',
  underline: 'u',
  strike: 's, del',
  bulletList: 'ul',
  orderedList: 'ol',
};

/**
 * Whether every visible character of a closed text box carries the mark (or sits in the list), read from its HTML
 * without mounting an editor, so the toolbar can show the whole-box state of the selected box (D43).
 */
export function wholeBoxHas(html: string, name: BoxMark | BoxList): boolean {
  const key = `${name}|${html}`;
  const hit = seen.get(key);
  if (hit !== undefined) return hit;
  const result = scan(html, name);
  if (seen.size >= 200) seen.delete(seen.keys().next().value!); // the oldest goes first
  seen.set(key, result);
  return result;
}

/** The toolbar asks for six states on every render; the answers depend only on the HTML, so they are kept. */
const seen = new Map<string, boolean>();

function scan(html: string, name: BoxMark | BoxList): boolean {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let any = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent?.trim()) continue;
    any = true;
    if (!n.parentElement?.closest(TAGS[name])) return false;
  }
  return any;
}

/**
 * Applies a mark or list to the whole of a closed text box: the HTML goes through a detached TipTap editor with the
 * same extensions as the open box, so the result is exactly what typing would have produced.
 */
export function styleWholeBox(html: string, name: BoxMark | BoxList, on: boolean): string {
  const editor = new Editor({ element: null, extensions: TEXT_EXTENSIONS, content: html });
  try {
    const chain = editor.chain().selectAll();
    if (name === 'bulletList' || name === 'orderedList') {
      const command = name === 'bulletList' ? chain.toggleBulletList() : chain.toggleOrderedList();
      command.run();
    } else if (on) chain.setMark(name).run();
    else chain.unsetMark(name).run();
    return editor.isEmpty ? '' : editor.getHTML();
  } finally {
    editor.destroy();
  }
}
