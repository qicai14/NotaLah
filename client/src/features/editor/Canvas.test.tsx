// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import type { SlideElement } from '@notalah/shared';
import { arrange } from './arrange';
import { Canvas } from './Canvas';
import { PanelBody } from './Panels';
import { emptyDeck, patchElement, useEditor } from './store';

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
    expect(s().selection).toEqual(['el-0000001']);
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    fireEvent.keyDown(box, { key: 'ArrowDown', shiftKey: true });
    expect(s().deck.slides[0].elements[0]).toMatchObject({ x: 101, y: 110 });
    fireEvent.keyDown(box, { key: 'Delete' });
    expect(s().deck.slides[0].elements.map((e) => e.id)).toEqual(['el-0000002']);
    s().undo();
    expect(s().deck.slides[0].elements).toHaveLength(2);
    expect(s().deck.slides[0].elements[0]).toMatchObject({ x: 101, y: 110 }); // the nudges are their own step
    s().undo();
    expect(s().deck.slides[0].elements[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('NOTE-TC62: the layers panel lists top first and reorders without dragging', () => {
    render(<PanelBody id="layers" details={details} />);
    const names = screen.getAllByRole('button', { pressed: false }).map((b) => b.textContent);
    expect(names).toEqual(['Circle', 'Rectangle']);
    fireEvent.click(screen.getByRole('button', { name: 'Move Rectangle up' }));
    expect(s().deck.slides[0].elements.map((e) => e.id)).toEqual(['el-0000002', 'el-0000001']);
  });

  it('NOTE-TC79: Shift-click builds a selection that nudges, aligns, duplicates and deletes as one', () => {
    const { container } = render(<Canvas compact={false} />);
    const one = container.querySelector<HTMLElement>('[data-id="el-0000001"]')!;
    const two = container.querySelector<HTMLElement>('[data-id="el-0000002"]')!;
    fireEvent.pointerDown(one, { button: 0 });
    fireEvent.pointerUp(window, { button: 0 });
    fireEvent.pointerDown(two, { button: 0, shiftKey: true });
    expect(s().selection).toEqual(['el-0000001', 'el-0000002']);
    expect(screen.getByLabelText('Circle, selected')).toBeTruthy();
    fireEvent.keyDown(two, { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyUp(two, { key: 'ArrowDown' });
    expect(s().deck.slides[0].elements.map((e) => e.y)).toEqual([110, 110]);
    s().updateElement('el-0000002', { y: 300 });
    s().select(['el-0000001', 'el-0000002']);
    arrange('top');
    expect(s().deck.slides[0].elements.map((e) => e.y)).toEqual([110, 110]);
    const before = s().past.length;
    fireEvent.keyDown(two, { key: 'Delete' });
    expect(s().deck.slides[0].elements).toHaveLength(0);
    expect(s().past.length).toBe(before + 1); // one undo step for the whole selection
    act(() => {
      s().undo();
      s().select(['el-0000001']);
    });
    fireEvent.pointerDown(container.querySelector('[data-id="el-0000001"]')!, { button: 0, ctrlKey: true });
    expect(s().selection).toEqual([]); // Ctrl-click on a selected element takes it out
  });

  it('NOTE-TC88: Shift+Space toggles the focused element, and a cancelled drag leaves no trace', () => {
    const { container } = render(<Canvas compact={false} />);
    const one = container.querySelector<HTMLElement>('[data-id="el-0000001"]')!;
    const two = container.querySelector<HTMLElement>('[data-id="el-0000002"]')!;
    fireEvent.focus(one);
    fireEvent.keyDown(two, { key: ' ', shiftKey: true });
    expect(s().selection).toEqual(['el-0000001', 'el-0000002']);
    fireEvent.keyDown(two, { key: ' ', shiftKey: true });
    expect(s().selection).toEqual(['el-0000001']);
    const before = s().deck;
    act(() => {
      s().preview((d) => patchElement(d, 0, 'el-0000001', { x: 600 }));
      s().cancelPreview(); // what the canvas does when the lock is lost mid-drag
    });
    expect(s().deck).toBe(before);
    expect(s().past).toHaveLength(0);
  });
});
