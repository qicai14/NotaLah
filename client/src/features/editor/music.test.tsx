// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { deckSchema, type SlideElement } from '@notalah/shared';
import type { MusicTrack } from '@/types';
import { VideoPicker } from './MediaPanels';
import { MusicPanel } from './MusicPanel';
import { emptyDeck, useEditor } from './store';

const track = (id: number, over: Partial<MusicTrack> = {}): MusicTrack => ({
  id,
  title: `Track ${id}`,
  artist: 'An Artist',
  cover: `https://usercontent.jamendo.com?type=album&id=${id}&width=200`,
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  duration: 185,
  audioUrl: `https://prod-1.storage.jamendo.com/?trackid=${id}&format=mp31`,
  ...over,
});
const video: SlideElement = {
  id: 'video-01',
  type: 'video',
  assetId: 5,
  loop: false,
  x: 0,
  y: 0,
  w: 300,
  h: 200,
  rotation: 0,
  opacity: 1,
  locked: false,
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
const audioSrcs: string[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  useEditor.getState().load(emptyDeck());
  play.mockClear();
  pause.mockClear();
  audioSrcs.length = 0;
  vi.stubGlobal(
    'Audio',
    class {
      volume = 1;
      onended: (() => void) | null = null;
      set src(v: string) {
        audioSrcs.push(v);
      }
      play = play;
      pause = pause;
    },
  );
  fetchMock = vi.fn(() => json({ results: [track(1), track(2)] }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const searchFor = async (text: string) => {
  fireEvent.change(screen.getByLabelText('Search free music'), { target: { value: text } });
  fireEvent.submit(screen.getByRole('search'));
  await screen.findByRole('list', { name: 'Search results' });
};
const urlOf = (n = 0) => String(fetchMock.mock.calls[n][0]);

describe('Music panel (R9)', () => {
  it('MUS-TC10: searches instrumental by default, previews only on tap, picks a track and sets the volume', async () => {
    render(<MusicPanel />);
    expect((screen.getByLabelText('Instrumental only') as HTMLInputElement).checked).toBe(true);
    expect(audioSrcs).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    await searchFor('piano');
    expect(urlOf()).toContain('/music/search?q=piano&instrumental=1&page=1');
    expect(play).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Play preview of Track 1' }));
    expect(audioSrcs).toEqual([track(1).audioUrl]);
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause preview of Track 1' }));
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Play preview of Track 1' })).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Instrumental only'));
    fireEvent.submit(screen.getByRole('search'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(urlOf(1)).toContain('instrumental=0');

    fireEvent.click(screen.getByRole('button', { name: 'Use Track 2' }));
    const { deck, tracks } = useEditor.getState();
    expect(deck.music).toEqual({ provider: 'jamendo', trackId: 2, volume: 60 });
    expect(tracks['2'].title).toBe('Track 2');
    expect(deckSchema.safeParse(deck).success).toBe(true);

    const chosen = screen.getByRole('region', { name: 'Music on this note' });
    expect(within(chosen).getByText('Track 2')).toBeTruthy();
    expect(within(chosen).getByRole('link', { name: 'Creative Commons licence' }).getAttribute('href')).toBe(
      'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    );
    fireEvent.change(within(chosen).getByLabelText(/Volume/), { target: { value: '25' } });
    fireEvent.pointerUp(within(chosen).getByLabelText(/Volume/));
    expect(useEditor.getState().deck.music?.volume).toBe(25);
  });

  it('MUS-TC11: a deck with a video disables the panel and says why', () => {
    useEditor.getState().load({
      ...emptyDeck(),
      slides: [{ background: { kind: 'color', color: '#ffffff' }, elements: [video], notes: '' }],
    });
    render(<MusicPanel />);
    expect(screen.getByRole('note').textContent).toContain('Remove videos to add music');
    expect(screen.getByLabelText('Search free music').matches(':disabled')).toBe(true);
    expect(screen.getByLabelText('Instrumental only').matches(':disabled')).toBe(true);
    fireEvent.submit(screen.getByRole('search'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('MUS-TC12: music can be removed, and adding a video while music is set asks to remove it first', () => {
    const st = useEditor.getState();
    st.addTrack(track(3));
    st.apply((d) => ({ ...d, music: { provider: 'jamendo', trackId: 3, volume: 60 } }));
    render(<VideoPicker />);
    expect(screen.queryByText('Upload a video')).toBeNull();
    expect(screen.getByText(/cannot have both music and a video/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove music' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove music' }));
    expect(useEditor.getState().deck.music).toBeNull();
    cleanup();

    useEditor.getState().apply((d) => ({ ...d, music: { provider: 'jamendo', trackId: 3, volume: 60 } }));
    render(<MusicPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove music' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove music' }));
    expect(useEditor.getState().deck.music).toBeNull();
    useEditor.getState().undo();
    expect(useEditor.getState().deck.music?.trackId).toBe(3);
  });

  it('MUS-TC13: a paused or failing search shows the server message and no results', async () => {
    fetchMock.mockImplementation(() => json({ error: 'Music search is paused' }, 503));
    render(<MusicPanel />);
    fireEvent.change(screen.getByLabelText('Search free music'), { target: { value: 'jazz' } });
    fireEvent.submit(screen.getByRole('search'));
    expect((await screen.findByRole('alert')).textContent).toContain('Music search is paused');
    expect(screen.queryByRole('list', { name: 'Search results' })).toBeNull();
  });
});
