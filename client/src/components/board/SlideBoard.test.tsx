// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Slide, SlideElement } from '@parp/shared';
import { cropBox, fitScale, inReadingOrder } from './geometry';
import { SlideBoard } from './SlideBoard';
import { SlideCarousel } from './SlideCarousel';

const base = { x: 10, y: 20, w: 300, h: 200, rotation: 0, opacity: 1, locked: false };
const el = <T extends SlideElement>(e: T): T => e;

describe('board scale', () => {
  it('NOTE-TC56: fits the board to the smaller of width and height, and is 0 before measuring', () => {
    expect(fitScale(500, 10_000, '4:5')).toBe(0.5);
    expect(fitScale(10_000, 625, '4:5')).toBe(0.5);
    expect(fitScale(1000, 562.5, '16:9')).toBe(1);
    expect(fitScale(400, 400, '9:16')).toBeCloseTo(400 / (1000 / (9 / 16)), 5);
    expect(fitScale(0, 400, '4:5')).toBe(0);
  });

  it('NOTE-TC56: reading order is y then x while z keeps the array index; a crop shows only its rectangle', () => {
    const a = el({
      ...base,
      id: 'aaaaaaaa',
      type: 'line',
      y: 300,
      stroke: '#000000',
      strokeWidth: 2,
      dash: 'solid',
      startCap: 'none',
      endCap: 'none',
    } as SlideElement);
    const b = { ...a, id: 'bbbbbbbb', y: 100 };
    expect(inReadingOrder([a, b]).map((r) => [r.el.id, r.z])).toEqual([
      ['bbbbbbbb', 1],
      ['aaaaaaaa', 0],
    ]);
    expect(cropBox(200, 100, { x: 0.25, y: 0.5, w: 0.5, h: 0.5 })).toEqual({
      width: 400,
      height: 200,
      left: -100,
      top: -100,
    });
  });
});

const slide: Slide = {
  background: { kind: 'gradient', from: '#ff0000', to: '#0000ff', angle: 90 },
  notes: '',
  elements: [
    {
      ...base,
      id: 'text-001',
      type: 'text',
      html: '<h1>Big idea</h1><p>Some <strong>bold</strong> words</p>',
      font: 'lora',
      size: 32,
      weight: 400,
      color: '#111827',
      align: 'left',
      lineHeight: 1.4,
      letterSpacing: 0,
      padding: 0,
    },
    {
      ...base,
      id: 'shape-01',
      type: 'shape',
      shape: 'ellipse',
      fill: '#00ff00',
      stroke: null,
      strokeWidth: 0,
      radius: 0,
    },
    {
      ...base,
      id: 'line-001',
      type: 'line',
      stroke: '#000000',
      strokeWidth: 4,
      dash: 'dashed',
      startCap: 'none',
      endCap: 'arrow',
    },
    {
      ...base,
      id: 'image-01',
      type: 'image',
      source: { kind: 'upload', assetId: 7 },
      alt: 'A diagram of a cell',
      crop: { x: 0, y: 0, w: 1, h: 1 },
      flipX: false,
      flipY: false,
      radius: 0,
    },
    {
      ...base,
      id: 'image-02',
      type: 'image',
      source: {
        kind: 'unsplash',
        photoId: 'abc',
        url: 'https://images.unsplash.com/photo-1',
        authorName: 'Ada Lens',
        authorUrl: 'https://unsplash.com/@ada',
      },
      alt: '',
      crop: { x: 0, y: 0, w: 1, h: 1 },
      flipX: true,
      flipY: false,
      radius: 0,
    },
    { ...base, id: 'code-001', type: 'code', code: 'SELECT 1;', language: 'sql', theme: 'dark', size: 24 },
    {
      ...base,
      id: 'table-01',
      type: 'table',
      cells: [
        ['Name', 'Mark'],
        ['Ann', '90'],
      ],
      font: 'source-sans-3',
      size: 24,
      color: '#111827',
      borderColor: '#cccccc',
      headerRow: true,
    },
    { ...base, id: 'video-01', type: 'video', assetId: 9, loop: true },
  ],
};

// jsdom has no layout: give every element a 500 x 625 box so the board has a scale.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 500 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 625 });
});

afterEach(cleanup);

describe('SlideBoard', () => {
  it('NOTE-TC57: renders every element type as real DOM with an accessible name', () => {
    const { container } = render(<SlideBoard slide={slide} aspect="4:5" assets={{ '7': '/api/assets/7/file' }} />);
    const board = screen.getByRole('group', { name: 'Slide' });
    expect(within(board).getByRole('heading', { name: 'Big idea' })).toBeTruthy();
    expect(within(board).getByText('bold').tagName).toBe('STRONG');
    expect(board.querySelectorAll('svg').length).toBe(3);
    expect(board.querySelector('ellipse')?.getAttribute('fill')).toBe('#00ff00');
    expect(board.querySelectorAll('line, polygon').length).toBe(2);
    expect(screen.getByAltText('A diagram of a cell').getAttribute('src')).toBe('/api/assets/7/file');
    const pre = board.querySelector('pre');
    expect(pre?.textContent).toBe('SELECT 1;');
    expect(pre?.getAttribute('data-language')).toBe('sql');
    expect(within(board).getByRole('columnheader', { name: 'Mark' })).toBeTruthy();
    expect(within(board).getByRole('cell', { name: '90' })).toBeTruthy();
    expect(within(board).getByRole('img', { name: 'Video' })).toBeTruthy();
    const credit = within(board).getByRole('link', { name: 'Ada Lens' });
    expect(credit.getAttribute('href')).toBe('https://unsplash.com/@ada');
    expect(container.querySelector('img[src="https://images.unsplash.com/photo-1"]')?.getAttribute('alt')).toBe('');
  });

  it('NOTE-TC57: falls back to the asset file route and uses array order for z-index', () => {
    render(<SlideBoard slide={slide} aspect="16:9" />);
    expect(screen.getByAltText('A diagram of a cell').getAttribute('src')).toBe('/api/assets/7/file');
    const z = (type: string) =>
      Number((document.querySelector(`[data-element="${type}"]`) as HTMLElement).style.zIndex);
    expect(z('text')).toBe(0);
    expect(z('video')).toBe(7);
  });

  it('NOTE-TC57: the carousel mounts only the active slide and its neighbours', () => {
    const many = Array.from({ length: 5 }, () => ({ background: slide.background, elements: [] }));
    render(<SlideCarousel slides={many} aspect="4:5" assets={{}} />);
    expect(document.querySelectorAll('[aria-roledescription="slide"]').length).toBe(2);
  });
});
