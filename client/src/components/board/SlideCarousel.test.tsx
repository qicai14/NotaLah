// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { dotWindow, MAX_DOTS, SlideCarousel } from './SlideCarousel';

afterEach(cleanup);

const slides = (n: number) =>
  Array.from({ length: n }, () => ({ background: { kind: 'color' as const, color: '#ffffff' }, elements: [] }));
const indexes = (count: number, cur: number) => dotWindow(count, cur).map((d) => d.index);

describe('carousel dots', () => {
  it('CLI-TC42: up to seven slides get one dot each, none flagged as an edge', () => {
    expect(dotWindow(1, 0)).toHaveLength(1);
    expect(indexes(7, 3)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dotWindow(7, 3).some((d) => d.edge)).toBe(false);
    expect(
      dotWindow(5, 4)
        .filter((d) => d.active)
        .map((d) => d.index),
    ).toEqual([4]);
  });

  it('CLI-TC43: more than seven slides show a window of seven that slides with the current slide', () => {
    expect(MAX_DOTS).toBe(7);
    expect(indexes(20, 0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(indexes(20, 10)).toEqual([7, 8, 9, 10, 11, 12, 13]);
    expect(indexes(20, 19)).toEqual([13, 14, 15, 16, 17, 18, 19]);
    for (const cur of [0, 5, 10, 19]) {
      const w = dotWindow(20, cur);
      expect(w).toHaveLength(7);
      expect(w.filter((d) => d.active)).toHaveLength(1);
      expect(w[0].index).toBeLessThanOrEqual(cur);
      expect(w[6].index).toBeGreaterThanOrEqual(cur);
    }
  });

  it('CLI-TC44: only a window edge with more slides beyond it is drawn small', () => {
    expect(dotWindow(20, 0).map((d) => d.edge)).toEqual([false, false, false, false, false, false, true]);
    expect(dotWindow(20, 10).map((d) => d.edge)).toEqual([true, false, false, false, false, false, true]);
    expect(dotWindow(20, 19).map((d) => d.edge)).toEqual([true, false, false, false, false, false, false]);
  });

  it('CLI-TC46: the rendered dots mark the current slide, cap at seven and follow Next; one slide shows no controls', async () => {
    const { container } = render(<SlideCarousel slides={slides(12)} aspect="4:5" assets={{}} />);
    const dots = () => [...container.querySelectorAll('[data-dot]')].map((d) => d.getAttribute('data-dot'));
    expect(dots()).toHaveLength(7);
    expect(dots()[0]).toBe('current');
    expect(dots()[6]).toBe('edge');
    for (let i = 0; i < 6; i++) await userEvent.click(container.querySelector('button[aria-label="Next slide"]')!);
    expect(dots()[3]).toBe('current');
    expect(dots()[0]).toBe('edge');
    for (let i = 0; i < 5; i++) await userEvent.click(container.querySelector('button[aria-label="Next slide"]')!);
    expect(document.activeElement).toBe(container.querySelector('[aria-roledescription="carousel"]'));
    cleanup();
    const one = render(<SlideCarousel slides={slides(1)} aspect="4:5" assets={{}} />);
    expect(one.container.querySelector('button')).toBeNull();
  });
});

describe('lazy slides', () => {
  it('CLI-TC70: asks for the rest only once the reader reaches the last loaded slide', async () => {
    const more = vi.fn();
    const { container, rerender } = render(
      <SlideCarousel slides={slides(2)} slideCount={5} onNeedMore={more} aspect="4:5" assets={{}} />,
    );
    expect(container.querySelectorAll('[data-dot]')).toHaveLength(5);
    expect(more).not.toHaveBeenCalled();
    await userEvent.click(container.querySelector('button[aria-label="Next slide"]')!);
    expect(more).toHaveBeenCalledTimes(1);
    rerender(<SlideCarousel slides={slides(2)} slideCount={5} onNeedMore={more} aspect="4:5" assets={{}} />);
    expect(more).toHaveBeenCalledTimes(1);
    await userEvent.click(container.querySelector('button[aria-label="Next slide"]')!);
    expect(more).toHaveBeenCalledTimes(2);
    cleanup();
    const full = vi.fn();
    render(<SlideCarousel slides={slides(2)} slideCount={2} onNeedMore={full} aspect="4:5" assets={{}} />);
    await userEvent.click(document.querySelector('button[aria-label="Next slide"]')!);
    expect(full).not.toHaveBeenCalled();
  });
});
