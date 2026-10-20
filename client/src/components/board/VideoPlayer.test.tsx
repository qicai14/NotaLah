// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { Slide } from '@notalah/shared';
import { SlideCarousel } from './SlideCarousel';
import { SlideBoard } from './SlideBoard';
import { SlideActive, VideoPlayer } from './VideoPlayer';

let observers: ((ratio: number) => void)[] = [];
const play = vi.fn<() => Promise<void>>();
const pause = vi.fn();

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 625 });
  const paused = (el: HTMLMediaElement, value: boolean) =>
    Object.defineProperty(el, 'paused', { configurable: true, value });
  play.mockImplementation(function (this: HTMLMediaElement) {
    paused(this, false);
    return Promise.resolve();
  });
  pause.mockImplementation(function (this: HTMLMediaElement) {
    paused(this, true);
  });
  window.HTMLMediaElement.prototype.play = play;
  window.HTMLMediaElement.prototype.pause = pause;
});
beforeEach(() => {
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: { intersectionRatio: number }[]) => void) {
        observers.push((intersectionRatio) => cb([{ intersectionRatio }]));
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  play.mockClear();
  pause.mockClear();
});

const see = (i: number, ratio: number) => act(() => observers[i](ratio));
const player = (n = 1) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <div key={i}>
        <VideoPlayer src={`/v${i}.mp4`} poster={`/v${i}.jpg`} loop={false} slideActive />
      </div>
    ))}
  </>
);
const el = { x: 0, y: 0, w: 300, h: 200, rotation: 0, opacity: 1, locked: false };
const videoSlide = (id: number): Slide =>
  ({
    background: { kind: 'color', color: '#ffffff' },
    elements: [{ ...el, id: `video-0${id}`, type: 'video', assetId: id, loop: false }],
    notes: '',
  }) as unknown as Slide;

describe('Feed video player (R29)', () => {
  it('CLI-TC71: plays muted and inline once half visible, and not before', () => {
    const { container } = render(player());
    const v = container.querySelector('video')!;
    expect(v.muted).toBe(true);
    expect(v.hasAttribute('playsinline')).toBe(true);
    expect(v.getAttribute('poster')).toBe('/v0.jpg');
    see(0, 0.3);
    expect(play).not.toHaveBeenCalled();
    see(0, 0.6);
    expect(play).toHaveBeenCalledTimes(1);
    expect(v.muted).toBe(true);
  });

  it('CLI-TC72: pauses when scrolled out of view and when its slide is not the current one', () => {
    const one = (slideActive: boolean) => (
      <VideoPlayer src="/v0.mp4" poster="/v0.jpg" loop={false} slideActive={slideActive} />
    );
    const { rerender } = render(one(true));
    see(0, 1);
    expect(play).toHaveBeenCalledTimes(1);
    see(0, 0.1);
    expect(pause).toHaveBeenCalled();
    see(0, 1);
    pause.mockClear();
    rerender(one(false));
    expect(pause).toHaveBeenCalled();
    cleanup();
    observers = [];
    play.mockClear();
    pause.mockClear();

    // In a carousel only the current slide's video is active: the neighbour's never plays.
    const view = render(
      <SlideCarousel
        slides={[videoSlide(1), videoSlide(2)]}
        aspect="4:5"
        assets={{ '1': '/a/1', '2': '/a/2' }}
        videoStatus={{ '1': 'ready', '2': 'ready' }}
      />,
    );
    const videos = view.container.querySelectorAll('video');
    expect(videos).toHaveLength(2);
    observers.forEach((o) => act(() => o(1)));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.contexts[0]).toBe(videos[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }));
    expect(play.mock.contexts[1]).toBe(videos[1]);
    expect(pause.mock.contexts).toContain(videos[0]);
  });

  it('CLI-TC73: a tap turns sound on for one video; turning on another mutes the first', () => {
    const { container } = render(player(2));
    const [a, b] = Array.from(container.querySelectorAll('video'));
    see(0, 1);
    see(1, 1);
    const [muteA, muteB] = screen.getAllByRole('button', { name: 'Video sound' });
    expect(muteA.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(a);
    expect(a.muted).toBe(false);
    expect(b.muted).toBe(true);
    fireEvent.click(muteB);
    expect(a.muted).toBe(true);
    expect(b.muted).toBe(false);
    fireEvent.click(muteB);
    expect(muteB.getAttribute('aria-pressed')).toBe('false');
    expect(b.muted).toBe(true);
    // Scrolling away hands the sound back.
    fireEvent.click(b);
    expect(b.muted).toBe(false);
    see(1, 0);
    expect(b.muted).toBe(true);
    see(1, 1);
    expect(b.muted).toBe(true);
  });

  it('CLI-TC74: with reduced motion nothing autoplays; Play starts it, Pause stops it', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { container } = render(player());
    see(0, 1);
    expect(play).not.toHaveBeenCalled();
    expect(container.querySelector('video')?.getAttribute('poster')).toBe('/v0.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    expect(play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause video' }));
    expect(pause).toHaveBeenCalled();
  });

  it('CLI-TC76: when the browser refuses to play, or the video ends, a Play button restarts it', async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error('NotAllowedError')));
    const { container } = render(player());
    see(0, 1);
    const button = await screen.findByRole('button', { name: 'Play video' });
    fireEvent.click(button);
    expect(play).toHaveBeenCalledTimes(2);
    fireEvent.play(container.querySelector('video')!);
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
    fireEvent.ended(container.querySelector('video')!);
    expect(screen.getByRole('button', { name: 'Play video' })).toBeTruthy();
    see(0, 0);
    expect(screen.queryByRole('button', { name: 'Play video' })).toBeNull();
  });

  it('CLI-TC75: shows the poster outside a carousel, and processing and failed tiles instead of a player', () => {
    const slide = videoSlide(5);
    const board = (status: 'processing' | 'ready' | 'failed', assets = {}) => (
      <SlideActive value>
        <SlideBoard slide={slide} aspect="4:5" assets={assets} videoStatus={{ '5': status }} />
      </SlideActive>
    );
    const a = render(board('processing'));
    expect(screen.getByRole('img', { name: 'Processing…' })).toBeTruthy();
    expect(a.container.querySelector('video')).toBeNull();
    a.rerender(board('failed'));
    expect(screen.getByRole('img', { name: 'Video could not be processed' })).toBeTruthy();
    cleanup();
    const tile = render(
      <SlideBoard slide={slide} aspect="4:5" assets={{ '5': '/a/5' }} videoStatus={{ '5': 'ready' }} />,
    );
    expect(tile.container.querySelector('video')).toBeNull();
    expect(tile.container.querySelector('img')?.getAttribute('src')).toBe('/a/5?poster=1');
  });
});
