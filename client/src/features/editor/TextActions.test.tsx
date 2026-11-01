// @vitest-environment jsdom
import { THEMES } from '@notalah/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const reply = (status: number, body: unknown = {}) =>
  ({ status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body) }) as Response;
const XSS = '<img src=x onerror=alert(1)>';
const quiz = { questions: [1, 2, 3].map((n) => ({ q: `Q${n} ${XSS}`, a: `A${n}` })) };

/** Fresh modules (the availability answer is cached); the probe answers `probe`, action calls wait in `calls`. */
async function mount(probe = 400) {
  vi.resetModules();
  const calls: { body: { text: string; action: string }; answer: (r: Response) => void }[] = [];
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
  const { TextActions } = await import('./TextActions');
  const { useEditor, emptyDeck } = await import('./store');
  const { makeText } = await import('./elements');
  const el = { ...makeText('body', 1080), html: '<p>Some <strong>notes</strong></p><ul><li><p>one</p></li></ul>' };
  useEditor.getState().load({ ...emptyDeck(), slides: [{ ...emptyDeck().slides[0], elements: [el] }] });
  render(<TextActions el={el} />);
  const run = async (name: string) => {
    fireEvent.click(await screen.findByRole('button', { name: /AI help/ }));
    fireEvent.click(await screen.findByRole('button', { name }));
  };
  return { calls, useEditor, el, run };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TextActions (R28)', () => {
  it('AI-TC36: helpers read a box as lines, escape model text, and build the quiz slide with answers in the notes', async () => {
    const { htmlToText, textToHtml, quizSlide } = await import('./outline');
    expect(htmlToText('<p>Some <strong>notes</strong></p><ul><li><p>one</p></li></ul>')).toBe('Some notes\none');
    expect(textToHtml(`a & b\n\n${XSS}`)).toBe('<p>a &amp; b</p><p>&lt;img src=x onerror=alert(1)&gt;</p>');
    const { emptyDeck } = await import('./store');
    const slide = quizSlide(quiz.questions, THEMES[emptyDeck().theme], emptyDeck().aspect);
    expect(slide.notes).toBe('1. A1\n2. A2\n3. A3');
    const shown = JSON.stringify(slide.elements);
    expect(shown).not.toContain('<img');
    expect(shown).not.toContain('A1');
  });

  it('AI-TC37: Rewrite replaces the box in one undo step, closing editing first; the notice is shown', async () => {
    const { calls, useEditor, el, run } = await mount();
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

  it('AI-TC38: Quiz me adds one slide in one undo step', async () => {
    const { calls, useEditor, run } = await mount();
    await run('Quiz me');
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].answer(reply(200, quiz));
    await vi.waitFor(() => expect(useEditor.getState().deck.slides).toHaveLength(2));
    expect(useEditor.getState().deck.slides[1].notes).toBe('1. A1\n2. A2\n3. A3');
    useEditor.getState().undo();
    expect(useEditor.getState().deck.slides).toHaveLength(1);
  });

  it('AI-TC39: a reply is dropped after another Note loads or while read-only; Cancel stops the request; a long box is refused', async () => {
    const { calls, useEditor, el, run } = await mount();
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

  it('AI-TC40: the controls are hidden when the server answers 404', async () => {
    const { calls } = await mount(404);
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('button', { name: /AI help/ })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
