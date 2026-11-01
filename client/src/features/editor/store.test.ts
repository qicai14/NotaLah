import { beforeEach, describe, expect, it } from 'vite-plus/test';
import type { SlideElement } from '@notalah/shared';
import { emptyDeck, HISTORY_LIMIT, patchElement, reaspect, useEditor } from './store';

const rect = (id: string, x = 100): SlideElement => ({
  id,
  type: 'shape',
  shape: 'rect',
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

beforeEach(() => s().load(emptyDeck()));

describe('editor store', () => {
  it('NOTE-TC58: undo and redo step through discrete changes and a drag counts once', () => {
    s().addElement(rect('el-000001'));
    for (let x = 110; x <= 150; x += 10) s().preview((d) => patchElement(d, 0, 'el-000001', { x }));
    s().commit();
    expect(s().past).toHaveLength(2);
    expect(s().deck.slides[0].elements[0].x).toBe(150);
    s().undo();
    expect(s().deck.slides[0].elements[0].x).toBe(100);
    s().undo();
    expect(s().deck.slides[0].elements).toHaveLength(0);
    expect(s().selection).toEqual([]);
    s().redo();
    s().redo();
    expect(s().deck.slides[0].elements[0].x).toBe(150);
    s().apply((d) => d); // a no-op recipe adds no step
    expect(s().past).toHaveLength(2);
  });

  it('NOTE-TC58: history is capped at 100 and a new change clears redo', () => {
    s().addElement(rect('el-000001'));
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s().updateElement('el-000001', { x: i });
    expect(s().past).toHaveLength(HISTORY_LIMIT);
    s().undo();
    expect(s().future).toHaveLength(1);
    s().updateElement('el-000001', { x: 5 });
    expect(s().future).toHaveLength(0);
  });

  it('NOTE-TC59: slide strip add, duplicate with fresh ids, reorder and delete', () => {
    s().addElement(rect('el-000001'));
    s().duplicateSlide(0);
    expect(s().deck.slides).toHaveLength(2);
    expect(s().activeSlide).toBe(1);
    expect(s().deck.slides[1].elements[0].id).not.toBe('el-000001');
    s().addSlide();
    expect(s().deck.slides).toHaveLength(3);
    expect(s().activeSlide).toBe(2);
    s().moveSlide(2, 0);
    expect(s().deck.slides[0].elements).toHaveLength(0);
    expect(s().activeSlide).toBe(0);
    s().deleteSlide(2);
    expect(s().deck.slides).toHaveLength(2);
    expect(s().activeSlide).toBe(1);
    s().deleteSlide(0);
    s().deleteSlide(0);
    expect(s().deck.slides).toHaveLength(1); // the last slide is emptied, never removed
    expect(s().dirty).toBe(true);
  });

  it('NOTE-TC59: changing the aspect scales and centres content to fit', () => {
    const deck = { ...emptyDeck(), slides: [{ ...emptyDeck().slides[0], elements: [rect('el-000001', 0)] }] };
    const wide = reaspect(deck, '16:9'); // 1250 -> 562.5 high: s = 0.45
    const e = wide.slides[0].elements[0];
    expect(wide.aspect).toBe('16:9');
    expect(e.w).toBe(90);
    expect(e.x).toBe(275); // (1000 - 450) / 2
    expect(e.y).toBe(45);
    const tall = reaspect(deck, '9:16'); // taller board: no scaling, centred vertically
    expect(tall.slides[0].elements[0].w).toBe(200);
    expect(tall.slides[0].elements[0].y).toBeCloseTo(100 + (1777.8 - 1250) / 2, 0);
  });

  it('NOTE-TC60: a save only clears dirty when nothing changed while it was in flight', () => {
    s().addElement(rect('el-000001'));
    const sent = s().rev;
    s().updateElement('el-000001', { x: 300 });
    s().markSaved(s().session, sent, { noteId: 7 });
    expect(s().dirty).toBe(true);
    expect(s().meta.noteId).toBe(7);
    s().setMeta({ title: 'Week 6' });
    s().markSaved(s().session, s().rev, {});
    expect(s().dirty).toBe(false);
    expect(s().saveState).toBe('saved');
  });
});

describe('insertSlides (R28)', () => {
  const draft = (n: number) => Array.from({ length: n }, () => emptyDeck().slides[0]);
  const fill = (n: number) => s().apply((d) => ({ ...d, slides: [...d.slides, ...draft(n - d.slides.length)] }));

  it('AI-TC24: a draft goes after the active Slide, cut to 15 and to the 30-Slide limit', () => {
    expect(s().insertSlides(draft(20), s().session)).toBe(true);
    expect(s().deck.slides).toHaveLength(16);
    expect(s().activeSlide).toBe(1);
    fill(25);
    expect(s().insertSlides(draft(15), s().session)).toBe(true);
    expect(s().deck.slides).toHaveLength(30);
    expect(s().insertSlides(draft(1), s().session)).toBe(false);
    expect(s().deck.slides).toHaveLength(30);
  });

  it('AI-TC25: one undo removes the whole draft', () => {
    const before = s().deck;
    s().insertSlides(draft(5), s().session);
    s().undo();
    expect(s().deck).toBe(before);
  });

  it('AI-TC26: a reply for another Note is dropped', () => {
    const old = s().session;
    s().load(emptyDeck());
    expect(s().insertSlides(draft(3), old)).toBe(false);
    expect(s().deck.slides).toHaveLength(1);
  });

  it('AI-TC27: a reply while the editor is read-only is dropped', () => {
    useEditor.setState({ readOnly: true });
    expect(s().insertSlides(draft(3), s().session)).toBe(false);
    expect(s().deck.slides).toHaveLength(1);
    useEditor.setState({ readOnly: false });
  });
});
