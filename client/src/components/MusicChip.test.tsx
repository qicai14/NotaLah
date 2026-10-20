// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vite-plus/test';
import { jamendoStreamUrl } from '@notalah/shared';
import { useActiveSound } from '@/hooks/useActiveSound';
import { MusicChip } from './MusicChip';

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();
beforeAll(() => {
  window.HTMLMediaElement.prototype.play = play;
  window.HTMLMediaElement.prototype.pause = pause;
});
afterEach(() => {
  cleanup();
  play.mockClear();
  pause.mockClear();
});

const music = {
  trackId: 168,
  title: 'Slow Piano',
  artist: 'An Artist',
  cover: 'https://usercontent.jamendo.com?type=album&id=1&width=200',
  licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
  volume: 40,
};
const audio = () => document.querySelector('audio')!;

describe('MusicChip', () => {
  it('MUS-TC18: shows the credit and licence link, and does not autoplay', () => {
    render(<MusicChip music={music} />);
    expect(screen.getByText('Slow Piano — An Artist')).toBeTruthy();
    const link = screen.getByRole('link', { name: /CC licence/ });
    expect(link.getAttribute('href')).toBe(music.licenseUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(audio().getAttribute('src')).toBe(jamendoStreamUrl(168));
    expect(audio().getAttribute('preload')).toBe('none');
    expect(audio().loop).toBe(true);
    expect(audio().volume).toBeCloseTo(0.4);
    expect(play).not.toHaveBeenCalled();
  });

  it('MUS-TC19: a tap plays and a second tap pauses, under one fixed label', () => {
    render(<MusicChip music={music} />);
    const button = screen.getByRole('button', { name: /^Background music/ });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(play).toHaveBeenCalledTimes(1);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(pause).toHaveBeenCalled();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('MUS-TC20: starting music releases a video holding the sound, and the reverse', () => {
    let video!: ReturnType<typeof useActiveSound>;
    const Video = () => ((video = useActiveSound('video-1')), null);
    render(
      <>
        <Video />
        <MusicChip music={music} />
      </>,
    );
    act(() => video.claim());
    expect(video.active).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Background music/ }));
    expect(video.active).toBe(false);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
    act(() => video.claim());
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    expect(pause).toHaveBeenCalled();
    act(() => video.release());
  });

  it('MUS-TC21: a track saved with no details shows a generic Jamendo credit and no licence link', () => {
    render(<MusicChip music={{ ...music, title: null, artist: null, cover: null, licenseUrl: null }} />);
    expect(screen.getByText('Music from Jamendo')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: /^Background music/ })).toBeTruthy();
  });
});
