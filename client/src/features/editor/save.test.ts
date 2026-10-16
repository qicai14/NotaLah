import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { autosaveDelay, saveNote } from './save';
import { emptyDeck, emptyMeta, useEditor } from './store';

const s = () => useEditor.getState();
const reply = (status: number, body: unknown) =>
  vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

beforeEach(() => s().load(emptyDeck(), { ...emptyMeta(), title: 'Week 6' }));
afterEach(() => vi.unstubAllGlobals());

describe('editor save', () => {
  it('NOTE-TC61: autosave waits 2 s after the last change but never more than 10 s after the first', () => {
    expect(autosaveDelay(0, 0)).toBe(2000);
    expect(autosaveDelay(0, 7000)).toBe(2000);
    expect(autosaveDelay(0, 9000)).toBe(1000);
    expect(autosaveDelay(0, 12_000)).toBe(0);
  });

  it('NOTE-TC61: the first save creates the note, later saves PUT with baseUpdatedAt', async () => {
    const created = { note: { id: 9, updatedAt: '2026-10-17T06:00:00.000Z', status: 'draft', visibility: null } };
    const fetch = reply(201, created);
    vi.stubGlobal('fetch', fetch);
    s().setMeta({ hashtags: ['sql'] });
    const r = await saveNote();
    expect(r.ok).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('/api/notes');
    expect(s().meta).toMatchObject({ noteId: 9, baseUpdatedAt: '2026-10-17T06:00:00.000Z' });
    expect(s().dirty).toBe(false);

    const put = reply(200, created);
    vi.stubGlobal('fetch', put);
    s().setMeta({ title: 'Week 7' });
    await saveNote();
    const [url, init] = put.mock.calls[0];
    expect(url).toBe('/api/notes/9');
    expect(JSON.parse(String(init?.body))).toMatchObject({
      baseUpdatedAt: '2026-10-17T06:00:00.000Z',
      status: 'draft',
    });
  });

  it('NOTE-TC61: a 409 puts the editor in the conflict state and keeps the changes', async () => {
    s().setMeta({ noteId: 9, baseUpdatedAt: '2026-10-17T05:00:00.000Z' });
    vi.stubGlobal('fetch', reply(409, { error: 'This note changed since you opened it' }));
    const r = await saveNote();
    expect(r).toEqual({ ok: false, errors: {} });
    expect(s().saveState).toBe('conflict');
    expect(s().dirty).toBe(true);
  });
});
