// @vitest-environment jsdom
import { THEMES } from '@notalah/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import type { ReactNode } from 'react';
import { ElementBar } from './ElementBar';
import { forgetAiProbe, FULL } from './DraftFromText';
import { makeText } from './elements';
import { htmlToText, quizSlide, textToHtml } from './outline';
import { emptyDeck, useEditor } from './store';
import { TextActions } from './TextActions';

const reply = (status: number, body: unknown = {}) =>
  ({ status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body) }) as Response;
const XSS = '<img src=x onerror=alert(1)>';
const quiz = { questions: [1, 2, 3].map((n) => ({ q: `Q${n} ${XSS}`, a: `A${n}` })) };

const html = '<p>Some <strong>notes</strong></p><ul><li><p>one</p></li></ul>';
const el = { ...makeText('body', 1080), html };
let calls: { body: { text: string; action: string }; answer: (r: Response) => void }[] = [];

/** The probe answers `probe`; action calls wait in `calls` until a test answers them. */
function mount(probe = 400, ui: ReactNode = <TextActions el={el} />) {
  forgetAiProbe();
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const body = JSON.parse(init.body as string);
          if (!body.action) return resolve(reply(probe, { error: 'x' }));
          init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
          calls.push({ body, answer: resolve });
        }),
    ),
  );
  useEditor.getState().load({ ...emptyDeck(), slides: [{ ...emptyDeck().slides[0], elements: [el] }] });
  render(ui);
}
const run = async (name: string) => {
  fireEvent.click(await screen.findByRole('button', { name: /AI help/ }));
  fireEvent.click(await screen.findByRole('button', { name }));
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TextActions (R28)', () => {
  it('AI-TC36: helpers read a box as lines, escape model text, and build the quiz slide with answers in the notes', async () => {
    expect(htmlToText('<p>Some <strong>notes</strong></p><ul><li><p>one</p></li></ul>')).toBe('Some notes\none');
    expect(textToHtml(`a & b\n\n${XSS}`)).toBe('<p>a &amp; b</p><p>&lt;img src=x onerror=alert(1)&gt;</p>');
    const slide = quizSlide(quiz.questions, THEMES[emptyDeck().theme], emptyDeck().aspect);
    expect(slide.notes).toBe('1. A1\n2. A2\n3. A3');
    const shown = JSON.stringify(slide.elements);
    expect(shown).not.toContain('<img');
    expect(shown).not.toContain('A1');
  });

  it('AI-TC37: Rewrite replaces the box in one undo step, closing editing first; the notice is shown', async () => {
    mount();
    useEditor.getState().setEditing(el.id);
    await run('Rewrite clearer');
    expect((await screen.findByRole('dialog')).textContent).toContain('sent to an external AI service');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].body).toEqual({ text: 'Some notes\none', action: 'rewrite' });
    expect(useEditor.getState().editingId).toBeNull();
    calls[0].answer(reply(200, { text: `Clear ${XSS}\nsecond` }));
    await vi.waitFor(() => expect(useEditor.getState().past).toHaveLength(1));
    const html = useEditor.getState().deck.slides[0].elements[0];
    expect(html.type === 'text' && html.html).toBe('<p>Clear &lt;img src=x onerror=alert(1)&gt;</p><p>second</p>');
    useEditor.getState().undo();
    expect(useEditor.getState().deck.slides[0].elements[0]).toEqual(el);
  });

  it('AI-TC55: the token in an applied reply is kept for the next save; a dropped reply keeps none', async () => {
    mount();
    await run('Rewrite clearer');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].answer(reply(200, { text: 'Clear', aiToken: 'tok-1' }));
    await vi.waitFor(() => expect(useEditor.getState().meta.aiToken).toBe('tok-1'));

    cleanup();
    mount();
    await run('Rewrite clearer');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    useEditor.getState().load(emptyDeck()); // another note opened while waiting
    calls[0].answer(reply(200, { text: 'Clear', aiToken: 'tok-2' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(useEditor.getState().meta.aiToken).toBeNull();
  });

  it('AI-TC38: Quiz me adds one slide in one undo step', async () => {
    mount();
    await run('Quiz me');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].answer(reply(200, quiz));
    await vi.waitFor(() => expect(useEditor.getState().deck.slides).toHaveLength(2));
    expect(useEditor.getState().deck.slides[1].notes).toBe('1. A1\n2. A2\n3. A3');
    useEditor.getState().undo();
    expect(useEditor.getState().deck.slides).toHaveLength(1);
  });

  it('AI-TC39: a reply is dropped after another Note loads or while read-only; Cancel stops the request; a long box is refused', async () => {
    mount();
    await run('Shorten');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    useEditor.getState().load(useEditor.getState().deck);
    calls[0].answer(reply(200, { text: 'x' }));
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    expect(useEditor.getState().past).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    useEditor.setState({ readOnly: true });
    calls[1].answer(reply(200, { text: 'x' }));
    await vi.waitFor(() => expect(useEditor.getState().past).toHaveLength(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(useEditor.getState().past).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /AI help/ })).toBeNull(); // hidden while read-only
    useEditor.setState({ readOnly: false });

    fireEvent.click(await screen.findByRole('button', { name: /AI help/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Shorten' }));
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((screen.getByRole('button', { name: 'Shorten' }) as HTMLButtonElement).disabled).toBe(false);

    useEditor.getState().updateElement(el.id, { html: `<p>${'a'.repeat(2_001)}</p>` });
    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    expect((await screen.findByRole('alert')).textContent).toContain('at most 2,000');
    expect(calls).toHaveLength(3);
  });

  it('AI-TC39: a reply after switching slide leaves the other slide alone; a locked or deleted box drops it with a message', async () => {
    mount();
    const st = useEditor.getState();
    st.load({ ...st.deck, slides: [...st.deck.slides, structuredClone(st.deck.slides[0])] });
    await run('Rewrite clearer');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    useEditor.setState({ activeSlide: 1 });
    calls[0].answer(reply(200, { text: 'New words' }));
    await vi.waitFor(() => expect(useEditor.getState().past).toHaveLength(1));
    const htmlOf = (i: number) => (useEditor.getState().deck.slides[i].elements[0] as typeof el).html;
    expect(htmlOf(0)).toBe('<p>New words</p>');
    expect(htmlOf(1)).toBe(el.html);

    useEditor.setState({ activeSlide: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    useEditor.getState().updateElementOn(0, el.id, { locked: true });
    calls[1].answer(reply(200, { text: 'x' }));
    expect((await screen.findByRole('alert')).textContent).toContain('locked');

    useEditor.getState().updateElementOn(0, el.id, { locked: false });
    fireEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    useEditor.getState().deleteElement(el.id);
    calls[2].answer(reply(200, { text: 'x' }));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('gone'));
  });

  it('AI-TC39: Quiz me is disabled with the full-Note message at 30 slides', async () => {
    mount();
    const st = useEditor.getState();
    const slide = st.deck.slides[0];
    st.load({ ...st.deck, slides: Array.from({ length: 30 }, () => slide) });
    fireEvent.click(await screen.findByRole('button', { name: /AI help/ }));
    expect((await screen.findByRole('button', { name: 'Quiz me' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('dialog').textContent).toContain(FULL);
    expect(screen.getByRole('button', { name: 'Shorten' }).hasAttribute('disabled')).toBe(false);
  });

  it('AI-TC39: a reply for a box opened for typing meanwhile is dropped with a message', async () => {
    mount();
    await run('Shorten');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    useEditor.getState().setEditing(el.id);
    calls[0].answer(reply(200, { text: 'x' }));
    expect((await screen.findByRole('alert')).textContent).toContain('changed while waiting');
    expect(useEditor.getState().past).toHaveLength(0);
  });

  it('AI-TC39: the reply still lands on the recorded box after the bar unmounts (slide switch or deselect)', async () => {
    mount(400, <ElementBar />);
    const st = useEditor.getState();
    st.load({ ...st.deck, slides: [...st.deck.slides, structuredClone(st.deck.slides[0])] });
    useEditor.setState({ selection: [el.id] });
    await run('Rewrite clearer');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    useEditor.setState({ activeSlide: 1, selection: [] });
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /AI help/ })).toBeNull());
    calls[0].answer(reply(200, { text: 'Landed' }));
    await vi.waitFor(() => expect(useEditor.getState().past).toHaveLength(1));
    const box = (i: number) => (useEditor.getState().deck.slides[i].elements[0] as typeof el).html;
    expect(box(0)).toBe('<p>Landed</p>');
    expect(box(1)).toBe(el.html);
  });

  it('AI-TC40: the controls are hidden when the server answers 404', async () => {
    mount(404);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /AI help/ })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
