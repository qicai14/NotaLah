// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { SlideElement } from '@notalah/shared';
import { SlideBoard } from '@/components/board/SlideBoard';
import { SlideActive } from '@/components/board/VideoPlayer';
import { IDLE_LIMIT_MS } from '@/lib/activity';
import { limitsText, POLL_LIMIT_MS, useVideoPolling, VideoPicker } from './MediaPanels';
import { emptyDeck, useEditor } from './store';

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
const slide = { background: { kind: 'color' as const, color: '#ffffff' }, elements: [video] };
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 625 });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Video states (R40)', () => {
  it('VID-TC10: the board shows processing and failed tiles, a player when ready, and the poster while editing', () => {
    const view = (props: Partial<Parameters<typeof SlideBoard>[0]>) =>
      render(
        <SlideActive value={false}>
          <SlideBoard slide={slide} aspect="4:5" {...props} />
        </SlideActive>,
      );

    view({ videoStatus: { '5': 'processing' } });
    expect(screen.getByRole('img', { name: 'Processing…' })).toBeTruthy();
    cleanup();
    view({ videoStatus: { '5': 'failed' } });
    expect(screen.getByRole('img', { name: 'Video could not be processed' })).toBeTruthy();
    cleanup();
    const ready = view({ assets: { '5': '/api/assets/5/file' }, videoStatus: { '5': 'ready' } });
    const player = ready.container.querySelector('video');
    expect(player?.getAttribute('src')).toBe('/api/assets/5/file');
    expect(player?.getAttribute('poster')).toBe('/api/assets/5/file?poster=1');
    cleanup();
    const editing = view({ mode: 'edit', assets: { '5': '/api/assets/5/file' } });
    expect(editing.container.querySelector('video')).toBeNull();
    expect(editing.container.querySelector('img')?.getAttribute('src')).toBe('/api/assets/5/file?poster=1');
  });

  it('VID-TC11: the picker states the server limits, places the upload as processing, and polling makes it ready', async () => {
    expect(limitsText({ profile: 'standard', maxSeconds: 90, maxBytes: 50 * 1024 * 1024, maxHeight: 1080 })).toBe(
      'Videos up to 90 s, 50 MB, 1080p.',
    );
    useEditor.getState().load(emptyDeck());
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/assets/videos/limits') {
        return json({ limits: { profile: 'free', maxSeconds: 90, maxBytes: 50 * 1024 * 1024, maxHeight: 720 } });
      }
      if (url === '/api/assets/videos' && init?.method === 'POST') {
        return json(
          { asset: { id: 5, status: 'processing', width: 1280, height: 720, url: '/api/assets/5/file' } },
          202,
        );
      }
      return json({ asset: { id: 5, status: 'ready', width: 1280, height: 720, url: '/api/assets/5/file' } });
    });
    vi.stubGlobal('fetch', fetch);

    const { container } = render(<VideoPicker />);
    expect(await screen.findByText(/Demo server: videos up to 90 s, 50 MB, 720p\./)).toBeTruthy();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await waitFor(() => expect(useEditor.getState().videoStatus).toEqual({ '5': 'processing' }));
    const placed = useEditor.getState().deck.slides[0].elements[0];
    expect(placed).toMatchObject({ type: 'video', assetId: 5 });

    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toBeTruthy();

    vi.useFakeTimers();
    renderHook(() => useVideoPolling());
    await act(() => vi.advanceTimersByTimeAsync(4000));
    vi.useRealTimers();
    await waitFor(() => expect(useEditor.getState().videoStatus).toEqual({ '5': 'ready' }));
    expect(useEditor.getState().assets).toEqual({ '5': '/api/assets/5/file' });
    expect(fetch).toHaveBeenCalledWith('/api/assets/5', expect.anything());
  });

  it('VID-TC15: a video added to the slide while the upload ran is not joined by a second one', async () => {
    useEditor.getState().load(emptyDeck());
    let answer: (r: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/assets/videos'
          ? new Promise<Response>((r) => (answer = r))
          : json({ limits: { profile: 'free', maxSeconds: 90, maxBytes: 50 * 1024 * 1024, maxHeight: 720 } }),
      ),
    );
    const { container } = render(<VideoPicker />);
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    useEditor.getState().addElement({ ...video, id: 'video-02' });
    answer(
      new Response(JSON.stringify({ asset: { id: 6, status: 'processing', width: 640, height: 360, url: '/x' } }), {
        status: 202,
      }),
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(useEditor.getState().deck.slides[0].elements.filter((e) => e.type === 'video')).toHaveLength(1);
  });

  describe('polling gates (#98)', () => {
    const answer = (status: string) =>
      vi.fn(() => json({ asset: { id: 5, status, width: 1280, height: 720, url: '/api/assets/5/file' } }));
    const start = (status = 'processing') => {
      vi.useFakeTimers();
      const fetchMock = answer(status);
      vi.stubGlobal('fetch', fetchMock);
      useEditor.getState().load(emptyDeck(), undefined, {}, { '5': 'processing' });
      renderHook(() => useVideoPolling());
      return fetchMock;
    };
    const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

    it('CLI-TC100: an idle tab makes no status requests', async () => {
      const f = start();
      await wait(IDLE_LIMIT_MS);
      const before = f.mock.calls.length;
      await wait(8 * 4000);
      expect(f.mock.calls.length).toBe(before);
    });

    it('CLI-TC101: the next activity resumes the polling', async () => {
      const f = start();
      await wait(IDLE_LIMIT_MS + 8 * 4000);
      const before = f.mock.calls.length;
      fireEvent.pointerDown(window);
      await wait(4000);
      expect(f.mock.calls.length).toBe(before + 1);
    });

    it('CLI-TC102: after the time limit the video shows as failed and polling stops', async () => {
      const f = start();
      for (let t = 0; t < POLL_LIMIT_MS; t += 10 * 60_000) {
        await wait(10 * 60_000);
        fireEvent.pointerMove(window);
      }
      await wait(4000);
      expect(useEditor.getState().videoStatus).toEqual({ '5': 'failed' });
      const before = f.mock.calls.length;
      await wait(60_000);
      expect(f.mock.calls.length).toBe(before);
    });

    it('CLI-TC103: an active tab polls until the video is ready', async () => {
      const f = start('ready');
      await wait(4000);
      expect(useEditor.getState().videoStatus).toEqual({ '5': 'ready' });
      await wait(60_000);
      expect(f).toHaveBeenCalledTimes(1);
    });
  });
});
