// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import type { SlideElement } from '@notalah/shared';
import { SlideBoard } from '@/components/board/SlideBoard';
import { limitsText, useVideoPolling, VideoPicker } from './MediaPanels';
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
      render(<SlideBoard slide={slide} aspect="4:5" {...props} />);

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
});
