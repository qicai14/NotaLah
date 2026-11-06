// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { DraftFromText, forgetAiProbe, MAX_CHARS } from './DraftFromText';
import { SaveStatus } from './EditorPage';
import { emptyDeck, useEditor } from './store';

const reply = (status: number, body: unknown = {}) =>
  ({ status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body) }) as Response;
const outline = { outline: { slides: [{ layout: 'title', title: 'Hi' }] } };

/** A fresh availability answer (cached per page load); the probe answers `probe`, outline calls wait in `calls`. */
async function mount(probe: number) {
  forgetAiProbe();
  const calls: ((r: Response) => void)[] = [];
  const fetchMock = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        if (!(JSON.parse(init.body as string) as { text?: string }).text) return resolve(reply(probe, { error: 'x' }));
        if (init.signal!.aborted) return reject(init.signal!.reason);
        init.signal!.addEventListener('abort', () => reject(init.signal!.reason));
        calls.push(resolve);
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  render(<DraftFromText />);
  return { calls, useEditor, fetchMock };
}
const open = async () => fireEvent.click(await screen.findByRole('button', { name: /Draft slides from text/ }));
const send = (text = 'notes') => {
  fireEvent.change(screen.getByLabelText('Text to turn into slides'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('DraftFromText (R28)', () => {
  it('AI-TC29: the notice comes before Send; hidden on 404, still shown on 400, 403 and 429', async () => {
    await mount(400);
    await open();
    expect((await screen.findByRole('dialog')).textContent).toContain('sent to an external AI service');
    for (const status of [403, 429]) {
      cleanup();
      await mount(status);
      expect(await screen.findByRole('button', { name: /Draft slides from text/ })).toBeTruthy();
    }
    cleanup();
    const { fetchMock } = await mount(404);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Draft slides from text/ })).toBeNull();
  });

  it('AI-TC29: cancel, resend, timeout and a late reply behave', async () => {
    const { calls, useEditor } = await mount(400);
    await open();

    // Cancel aborts the request and closes the dialog; its late settle changes nothing.
    send();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    calls[0](reply(200, outline));
    await Promise.resolve();
    expect(useEditor.getState().deck.slides).toHaveLength(1);

    // Cancel then resend: the first request settling must not clear the second one's pending state.
    await open();
    send();
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await open();
    send();
    await vi.waitFor(() => expect(calls).toHaveLength(3));
    await screen.findByRole('button', { name: 'Drafting…' });
    calls[1](reply(200, outline));
    await Promise.resolve();
    expect((screen.getByRole('button', { name: 'Drafting…' }) as HTMLButtonElement).disabled).toBe(true);

    // A reply after the Note changed is dropped and the dialog closes without a message.
    useEditor.getState().load(useEditor.getState().deck);
    calls[2](reply(200, outline));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(useEditor.getState().deck.slides).toHaveLength(1);

    // The 30 s stop shows its own message.
    const timedOut = new AbortController();
    timedOut.abort(new DOMException('timeout', 'TimeoutError'));
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timedOut.signal);
    await open();
    send();
    expect((await screen.findByRole('alert')).textContent).toContain('took too long');
  });

  it('AI-TC41: an imported file fills the box with a notice and sends nothing until Send', async () => {
    const { fetchMock } = await mount(400);
    await open();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const long = new File(['a'.repeat(MAX_CHARS + 5)], 'n.txt');
    fireEvent.change(screen.getByLabelText(/import a file/i), { target: { files: [long] } });
    await vi.waitFor(() =>
      expect((screen.getByLabelText('Text to turn into slides') as HTMLTextAreaElement).value).toHaveLength(MAX_CHARS),
    );
    expect(screen.getByRole('status').textContent).toContain('cut to fit');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const init = fetchMock.mock.calls[1][1];
    expect(init.body).not.toBeInstanceOf(FormData);
    expect(JSON.parse(init.body as string).text).toHaveLength(MAX_CHARS);
  });

  it('AI-TC45: Send waits for a running import, and a result arriving after the dialog closed is dropped', async () => {
    const { calls } = await mount(400);
    await open();
    const box = () => screen.getByLabelText('Text to turn into slides') as HTMLTextAreaElement;
    const sendBtn = () => screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    const pick = (f: File) => fireEvent.change(screen.getByLabelText(/import a file/i), { target: { files: [f] } });
    let release!: () => void;
    const slow = (body: string) => {
      const f = new File([body], 'n.txt');
      vi.spyOn(f, 'text').mockReturnValue(new Promise<string>((r) => (release = () => r(body))));
      return f;
    };

    fireEvent.change(box(), { target: { value: 'mine' } });
    pick(slow('imported'));
    expect(sendBtn().disabled).toBe(true);
    fireEvent.submit(box().closest('form')!); // Enter is blocked too
    expect(calls).toHaveLength(0);
    release();
    await vi.waitFor(() => expect(box().value).toBe('imported'));
    expect(sendBtn().disabled).toBe(false);

    pick(slow('late'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    release();
    await new Promise((r) => setTimeout(r, 0));
    await open();
    expect(box().value).toBe('imported');
    expect(sendBtn().disabled).toBe(false);
  });

  it('AI-TC43: a .pptx import in the dialog shows the PowerPoint message', async () => {
    await mount(400);
    await open();
    fireEvent.change(screen.getByLabelText(/import a file/i), { target: { files: [new File(['x'], 'n.pptx')] } });
    expect((await screen.findByRole('alert')).textContent).toContain('PowerPoint');
  });

  it('AI-TC55: an applied outline keeps its token for the next save, and the editor shows the saved label', async () => {
    useEditor.getState().load(emptyDeck());
    const { calls } = await mount(400);
    await open();
    send();
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0](reply(200, { ...outline, aiToken: 'tok-outline' }));
    await vi.waitFor(() => expect(useEditor.getState().meta.aiToken).toBe('tok-outline'));
    cleanup();

    render(<SaveStatus />);
    expect(screen.queryByText('AI-assisted')).toBeNull();
    act(() => useEditor.getState().setMeta({ aiAssisted: true }));
    expect(screen.getByText('AI-assisted')).toBeTruthy();
  });
});
