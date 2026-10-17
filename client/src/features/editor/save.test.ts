// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_PREFIX, clearAllBackups } from './backup';
import { autosaveDelay, readBackup, saveNote, writeBackup } from './save';
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

  it('NOTE-TC63: a backup is restored only for its owner and base version, valid and with clean text', () => {
    const textDeck = emptyDeck();
    textDeck.slides[0].elements = [
      {
        id: 'text-0000001',
        type: 'text',
        x: 0,
        y: 0,
        w: 500,
        h: 100,
        rotation: 0,
        opacity: 1,
        locked: false,
        html: '<p onclick="steal()">Hi <script>alert(1)</script><a href="x">link</a> <span style="color:#ff0000">red</span></p>',
        font: 'source-sans-3',
        size: 30,
        weight: 400,
        color: '#111111',
        align: 'left',
        lineHeight: 1.2,
        letterSpacing: 0,
        padding: 0,
      },
    ];
    s().load(textDeck, { ...emptyMeta(), noteId: 5, baseUpdatedAt: 'v1', title: 'Week 6' });
    expect(writeBackup(7)).toBe(true);
    expect(readBackup(5, 'v1', 8)).toBeNull(); // another user's backup is dropped
    expect(localStorage.getItem(BACKUP_PREFIX + 5)).toBeNull();

    writeBackup(7);
    expect(readBackup(5, 'v2', 7)).toBeNull(); // the server moved on: stale
    expect(localStorage.getItem(BACKUP_PREFIX + 5)).toBeNull();

    writeBackup(7);
    const ok = readBackup(5, 'v1', 7);
    const el = ok?.deck.slides[0].elements[0];
    expect(el?.type === 'text' && el.html).toBe('<p>Hi link <span style="color:#ff0000">red</span></p>');

    localStorage.setItem(BACKUP_PREFIX + 5, JSON.stringify({ owner: 7, base: 'v1', deck: { aspect: '1:1' } }));
    expect(readBackup(5, 'v1', 7)).toBeNull(); // fails the deck schema
  });

  it('NOTE-TC64: clearing backups touches only backup keys, and sign-in keeps backups of the same user', () => {
    localStorage.setItem('notalah-theme', 'dark');
    localStorage.setItem(BACKUP_PREFIX + 1, JSON.stringify({ owner: 7 }));
    localStorage.setItem(BACKUP_PREFIX + 2, JSON.stringify({ owner: 8 }));
    clearAllBackups(7);
    expect(localStorage.getItem(BACKUP_PREFIX + 1)).not.toBeNull();
    expect(localStorage.getItem(BACKUP_PREFIX + 2)).toBeNull();
    clearAllBackups();
    expect(localStorage.getItem(BACKUP_PREFIX + 1)).toBeNull();
    expect(localStorage.getItem('notalah-theme')).toBe('dark');
  });

  it('NOTE-TC65: a save reply that arrives after another note was loaded does not touch it', async () => {
    let answer: (r: Response) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((res) => (answer = res))),
    );
    s().setMeta({ title: '' });
    const pending = saveNote();
    s().load(emptyDeck()); // the author opened a new note meanwhile
    answer(
      new Response(JSON.stringify({ note: { id: 9, updatedAt: 'v1', status: 'draft', visibility: null } }), {
        status: 201,
      }),
    );
    await pending;
    expect(s().meta.noteId).toBeNull();
    expect(s().saveState).toBe('idle');
  });

  it('NOTE-TC66: an untitled draft saves as "Untitled note", and a 423 puts the editor in the locked state', async () => {
    const post = reply(201, { note: { id: 9, updatedAt: 'v1', status: 'draft', visibility: null } });
    vi.stubGlobal('fetch', post);
    s().setMeta({ title: '  ' });
    await saveNote();
    expect(JSON.parse(String(post.mock.calls[0][1]?.body)).title).toBe('Untitled note');

    vi.stubGlobal('fetch', reply(423, { error: 'Another collaborator is editing this note' }));
    s().setMeta({ title: 'Week 6' });
    const r = await saveNote();
    expect(r).toEqual({ ok: false, errors: {} });
    expect(s().saveState).toBe('locked');
    expect(s().dirty).toBe(true);
  });

  it('NOTE-TC67: a save queued behind a new note’s first save PUTs to its id even after another note opens', async () => {
    const answers: ((r: Response) => void)[] = [];
    const fetch = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((res) => answers.push(res)));
    vi.stubGlobal('fetch', fetch);
    const first = saveNote();
    s().setMeta({ title: 'Week 6, more' });
    const queued = saveNote(); // e.g. the exit save, with its own snapshot
    s().load(emptyDeck()); // another note opens before the first reply
    answers[0](
      new Response(JSON.stringify({ note: { id: 9, updatedAt: 'v1', status: 'draft', visibility: null } }), {
        status: 201,
      }),
    );
    await first;
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch.mock.calls[1][0]).toBe('/api/notes/9');
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toMatchObject({
      title: 'Week 6, more',
      baseUpdatedAt: 'v1',
    });
    answers[1](
      new Response(JSON.stringify({ note: { id: 9, updatedAt: 'v2', status: 'draft', visibility: null } }), {
        status: 200,
      }),
    );
    await queued;
    expect(s().meta.noteId).toBeNull();
  });
});
