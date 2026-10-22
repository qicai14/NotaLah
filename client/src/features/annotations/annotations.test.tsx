// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { Slide } from '@notalah/shared';
import type { Annotation, Note, User } from '../../types';
import { NoteActions } from '../../components/NoteActions';
import { describe as say } from '../notifications/helpers';
import type { Notification } from '../notifications/types';
import { resolveAnchor, resolveOffset, selectionAnchor, slideOf, textRange } from './anchors';
import { AnnotationPanel, SelectionAnnotate } from './Annotations';

const askToLogIn = vi.fn();
let signedIn: User | null;
const api = vi.fn();
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: signedIn }) }));
vi.mock('../auth/GuestPrompt', () => ({ useGuestPrompt: () => askToLogIn }));
vi.mock('@/features/auth/GuestPrompt', () => ({ useGuestPrompt: () => askToLogIn }));
vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: (...a: unknown[]) => api(...a),
}));

const me: User = {
  id: 1,
  email: 'me@apu.edu.my',
  displayName: 'Sam Student',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};

const ELEMENT = 'text-el-1';
const slides = [
  {
    elements: [{ id: ELEMENT, type: 'text', html: '<p>Hello <b>big</b> world, big day</p>' }],
  },
  { elements: [] },
] as unknown as Pick<Slide, 'elements'>[];

const ann = (id: number, over: Partial<Annotation> = {}): Annotation => ({
  id,
  slideId: 1,
  elementId: ELEMENT,
  quote: 'big',
  offset: 6,
  body: `Body ${id}`,
  createdAt: new Date().toISOString(),
  author: { id: 2, displayName: 'Dr Lee', avatarUrl: null, isVerifiedLecturer: true },
  canDelete: false,
  ...over,
});

function mount(html: string) {
  const host = document.createElement('div');
  host.innerHTML = `<div data-anchor="${ELEMENT}">${html}</div><div data-anchor="other">Other text</div>`;
  document.body.append(host);
  return host;
}

beforeEach(() => {
  signedIn = me;
  api.mockReset();
  askToLogIn.mockReset();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('R10 annotations (client)', () => {
  it('ANN-TC12 maps a selection to its element, trimmed quote and plain-text offset', () => {
    const host = mount('<p>Hello <b>big</b> world</p>');
    const text = host.querySelector('[data-anchor] p')!;
    const range = document.createRange();
    range.setStart(text.firstChild!, 5); // the space before "big"
    range.setEnd(text.lastChild!, 4); // " wor|ld"
    expect(selectionAnchor(range)).toEqual({ elementId: ELEMENT, quote: 'big wor', offset: 6 });

    const across = document.createRange();
    across.setStart(text.firstChild!, 0);
    across.setEnd(host.querySelector('[data-anchor="other"]')!.firstChild!, 3);
    expect(selectionAnchor(across)).toBeNull();

    const back = textRange(host.querySelector('[data-anchor]')!, 6, 7)!;
    expect(back.toString()).toBe('big wor');
  });

  it('ANN-TC13 resolves an anchor at its offset, then the nearest occurrence, follows its element, else lists it as "Text changed"', () => {
    expect(resolveOffset('a big day, big', 'big', 11)).toBe(11);
    expect(resolveOffset('a big day, big', 'big', 7)).toBe(11); // 4 away beats 5 away
    expect(resolveOffset('big one, big two, big three', 'big', 16)).toBe(18); // nearest to the saved offset, not the first
    expect(resolveOffset('big one, big two, big three', 'big', 11)).toBe(9);
    expect(resolveOffset('a small day', 'big', 2)).toBeNull();
    expect(resolveAnchor(slides, ann(1, { offset: 17 }))).toBe(17);
    expect(resolveAnchor(slides, ann(1, { quote: 'gone' }))).toBeNull();
    expect(resolveAnchor(slides, ann(1, { slideId: 4, elementId: 'deleted-el' }))).toBeNull();

    render(
      <AnnotationPanel
        noteId={9}
        slides={slides}
        slideNo={1}
        annotations={[ann(1), ann(2, { quote: 'removed words' }), ann(3, { slideId: 2, elementId: 'elsewhere-1' })]}
        draft={null}
        onDraftDone={() => {}}
        onPosted={() => {}}
        onRemoved={() => {}}
        onShow={() => {}}
        onOff={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Show “big” on the slide' })).toBeTruthy();
    expect(screen.getByText('Text changed')).toBeTruthy();
    expect(screen.getByText('“removed words”')).toBeTruthy();
    expect(screen.queryByText('Body 3')).toBeNull(); // another slide's annotation
    cleanup();
    // A slide inserted in front: the annotation follows its element to slide 2 and still resolves.
    const moved = [{ elements: [] }, ...slides] as unknown as Pick<Slide, 'elements'>[];
    expect(slideOf(moved, ann(1))).toBe(2);
    expect(resolveAnchor(moved, ann(1))).toBe(6);
    const panel = (slideNo: number) => (
      <AnnotationPanel
        noteId={9}
        slides={moved}
        slideNo={slideNo}
        annotations={[ann(1)]}
        draft={null}
        onDraftDone={() => {}}
        onPosted={() => {}}
        onRemoved={() => {}}
        onShow={() => {}}
        onOff={() => {}}
      />
    );
    const { rerender } = render(panel(1));
    expect(screen.queryByText('Body 1')).toBeNull();
    rerender(panel(2));
    expect(screen.getByRole('button', { name: 'Show “big” on the slide' })).toBeTruthy();
    cleanup();
    const orphan = { ...ann(4, { slideId: 7, elementId: 'deleted-el' }), body: 'Orphan' };
    render(
      <AnnotationPanel
        noteId={9}
        slides={slides}
        slideNo={2}
        annotations={[orphan]}
        draft={null}
        onDraftDone={() => {}}
        onPosted={() => {}}
        onRemoved={() => {}}
        onShow={() => {}}
        onOff={() => {}}
      />,
    );
    expect(screen.getByText('Orphan')).toBeTruthy(); // its slide is gone, so it is listed on the last one
    expect(screen.getByText('Text changed')).toBeTruthy();
  });

  it('ANN-TC14 shows Delete only when allowed and Report only on other people’s annotations', async () => {
    const removed = vi.fn();
    api.mockResolvedValue({});
    render(
      <AnnotationPanel
        noteId={9}
        slides={slides}
        slideNo={1}
        annotations={[
          ann(1, { author: { ...ann(1).author, id: me.id, displayName: me.displayName }, canDelete: true }),
          ann(2),
        ]}
        draft={null}
        onDraftDone={() => {}}
        onPosted={() => {}}
        onRemoved={removed}
        onShow={() => {}}
        onOff={() => {}}
      />,
    );
    const [mine, theirs] = screen.getAllByRole('listitem');
    expect(mine.querySelectorAll('button')).toHaveLength(2); // quote and Delete, no Report
    expect(theirs.textContent).not.toContain('Delete');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith(1));
    expect(api).toHaveBeenCalledWith('/notes/9/annotations/1', { method: 'DELETE' });

    await userEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(await screen.findByRole('heading', { name: 'Report this annotation' })).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'Spam' }));
    await userEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() =>
      expect(api).toHaveBeenCalledWith('/notes/9/annotations/2/report', {
        method: 'POST',
        body: { reason: 'spam', details: null },
      }),
    );
  });

  it('ANN-TC15 hides the Annotate button when annotations are off; the owner switches them in More', async () => {
    function Deck({ enabled }: { enabled: boolean }) {
      const root = useRef<HTMLDivElement>(null);
      return (
        <div ref={root}>
          <div data-anchor={ELEMENT}>Hello big world</div>
          <SelectionAnnotate root={root} enabled={enabled} onAnnotate={() => {}} />
        </div>
      );
    }
    const select = () =>
      act(() => {
        const t = document.querySelector('[data-anchor]')!.firstChild!;
        const r = document.createRange();
        r.setStart(t, 6);
        r.setEnd(t, 9);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(r);
        document.dispatchEvent(new Event('selectionchange'));
      });
    const { rerender } = render(<Deck enabled={false} />);
    select();
    expect(screen.queryByRole('button', { name: /Annotate/ })).toBeNull();
    rerender(<Deck enabled />);
    select();
    expect(screen.getByRole('button', { name: /Annotate/ })).toBeTruthy();
    cleanup();

    const toggled = vi.fn();
    api.mockResolvedValue({ annotationsOn: true });
    const note = {
      id: 9,
      author: { id: me.id, displayName: me.displayName, role: 'student', isVerifiedLecturer: false },
      counts: { likes: 0, comments: 0, annotations: 0 },
      liked: false,
      bookmarked: false,
    } as unknown as Note;
    render(
      <MemoryRouter>
        <NoteActions
          note={note}
          annotations={{ count: 0, on: false, onOpen: () => {}, onToggled: toggled }}
          onChange={() => {}}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /^Annotations/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'More actions' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Turn annotations on' }));
    await waitFor(() => expect(toggled).toHaveBeenCalledWith(true));
    expect(api).toHaveBeenCalledWith('/notes/9/annotations', { method: 'PATCH', body: { enabled: true } });
  });

  it('ANN-TC16 describes the annotation and annotation_hidden notifications with a link to the note', () => {
    const n = (type: Notification['type']): Notification => ({
      id: 1,
      type,
      read: false,
      createdAt: '2026-10-20T10:00:00.000Z',
      actor: type === 'annotation' ? { id: 7, displayName: 'Aina' } : null,
      note: { id: 9, title: 'Joins' },
      commentId: null,
      requestId: null,
      requestStatus: null,
    });
    expect(say(n('annotation'))).toEqual({ text: 'annotated your note “Joins”', to: '/notes/9' });
    expect(say(n('annotation_hidden'))).toEqual({
      text: 'Your annotation on “Joins” was removed by an administrator.',
      to: '/notes/9',
    });
  });

  it('ANN-TC19 lists annotations read-only: no picker, composer, Delete or Report', () => {
    render(
      <AnnotationPanel
        noteId={9}
        slides={slides}
        slideNo={1}
        annotations={[ann(1, { canDelete: true }), ann(2)]}
        draft={null}
        readOnly
        onPick={() => {}}
        onShow={() => {}}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^(Delete|Report|Select text with the keyboard)/ })).toBeNull();
  });

  it('ANN-TC20 shows the annotation count on a feed card note and links to the note; nothing at zero', () => {
    const base = {
      id: 9,
      author: { id: 5, displayName: 'Aina', role: 'student', isVerifiedLecturer: false },
      liked: false,
      bookmarked: false,
    };
    const card = (annotations: number) =>
      ({ ...base, counts: { likes: 0, comments: 0, annotations } }) as unknown as Note;
    const { rerender } = render(
      <MemoryRouter>
        <NoteActions note={card(1200)} onChange={() => {}} />
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Annotations, 1200' });
    expect(link.getAttribute('href')).toBe('/notes/9');
    expect(link.textContent).toContain('1.2K');
    rerender(
      <MemoryRouter>
        <NoteActions note={card(0)} onChange={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: /^Annotations/ })).toBeNull();
  });

  it('ANN-TC21 creates an annotation from the keyboard picker and announces it', async () => {
    const picked = vi.fn();
    render(
      <AnnotationPanel
        noteId={9}
        slides={slides}
        slideNo={1}
        annotations={[]}
        draft={null}
        onPick={picked}
        onShow={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select text with the keyboard' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annotate selection' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Select some text first/);
    expect(picked).not.toHaveBeenCalled();

    const box = screen.getByRole('textbox', { name: 'Text box 1' }) as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    expect(box.value).toBe('Hello big world, big day'); // the plain text the anchors count in
    box.focus();
    act(() => {
      box.setSelectionRange(5, 9); // " big"
      box.dispatchEvent(new Event('select', { bubbles: true }));
    });
    await userEvent.click(screen.getByRole('button', { name: 'Annotate selection' }));
    expect(picked).toHaveBeenCalledWith({ elementId: ELEMENT, quote: 'big', offset: 6, slideId: 1 });
    expect(screen.getByRole('status').textContent).toMatch(/Selected “big”/);
  });
});
