// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const reply = (status: number, body: unknown = {}) =>
  Promise.resolve({ status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body) } as Response);

async function mount(status: number) {
  vi.resetModules(); // the availability answer is cached per page load
  vi.stubGlobal(
    'fetch',
    vi.fn(() => reply(status, { error: 'x' })),
  );
  const { DraftFromText } = await import('./DraftFromText');
  render(<DraftFromText />);
}
beforeEach(() => vi.unstubAllGlobals());
afterEach(cleanup);

describe('DraftFromText (R28)', () => {
  it('AI-TC29: the dialog says the text goes to an external AI service, and the controls are hidden on a 404', async () => {
    await mount(400);
    (await screen.findByRole('button', { name: /Draft slides from text/ })).click();
    expect((await screen.findByRole('dialog')).textContent).toContain('sent to an external AI service');
    cleanup();
    await mount(404);
    await vi.waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Draft slides from text/ })).toBeNull();
  });
});
