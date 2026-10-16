// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SlideElement } from '@parp/shared';
import { Canvas } from './Canvas';
import { PanelBody } from './Panels';
import { emptyDeck, useEditor } from './store';

const rect = (id: string, x: number): SlideElement => ({
  id,
  type: 'shape',
  shape: x > 200 ? 'ellipse' : 'rect',
  x,
  y: 100,
  w: 200,
  h: 100,
  rotation: 0,
  opacity: 1,
  locked: false,
  fill: '#2b37e3',
  stroke: null,
  strokeWidth: 0,
  radius: 0,
});
const s = () => useEditor.getState();
const details = {
  moduleId: '',
  hashtags: [],
  errors: {},
  modules: [],
  modulesError: null,
  setModuleId: () => {},
  setHashtags: () => {},
};

beforeEach(() => {
  const deck = emptyDeck();
  deck.slides[0].elements = [rect('el-0000001', 100), rect('el-0000002', 400)];
  s().load(deck);
});
afterEach(cleanup);

describe('editor canvas', () => {
  it('NOTE-TC62: elements are focusable, and the keyboard selects, nudges and deletes them', () => {
    const { container } = render(<Canvas compact={false} />);
    // jsdom never measures the board, so it stays visibility:hidden; reach the element by its id.
    const box = container.querySelector<HTMLElement>('[data-id="el-0000001"]')!;
    expect(box.getAttribute('aria-label')).toBe('Rectangle');
    fireEvent.focus(box);
    expect(s().selection).toBe('el-0000001');
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    expect(s().deck.slides[0].elements[0]).toMatchObject({ x: 101, y: 110 });
    fireEvent.keyDown(box, { key: 'Delete' });
    expect(s().deck.slides[0].elements.map((e) => e.id)).toEqual(['el-0000002']);
    s().undo();
    expect(s().deck.slides[0].elements).toHaveLength(2);
  });

  it('NOTE-TC62: the layers panel lists top first and reorders without dragging', () => {
    render(<PanelBody id="layers" details={details} />);
    const names = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent);
    expect(names).toEqual(['Circle', 'Rectangle']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Rectangle up' }));
    expect(s().deck.slides[0].elements.map((e) => e.id)).toEqual(['el-0000002', 'el-0000001']);
  });
});
