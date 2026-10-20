// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import {
  applyTheme,
  ASPECTS,
  type Deck,
  deckSchema,
  LAYOUT_IDS,
  layoutSlide,
  type SlideElement,
  THEME_IDS,
  THEMES,
} from '@notalah/shared';
import { makeCode, makeLine, makeShape, makeTable, makeText } from './elements';
import { PanelBody, type Details } from './Panels';
import { emptyDeck, newId, useEditor } from './store';

const s = () => useEditor.getState();
const details: Details = {
  moduleId: '',
  hashtags: [],
  errors: {},
  modules: [],
  modulesError: null,
  setModuleId: () => {},
  setHashtags: () => {},
};
const photo: Deck['slides'][number]['background'] = {
  kind: 'image',
  image: { kind: 'upload', assetId: 7 },
};

beforeEach(() => s().load(emptyDeck()));
afterEach(cleanup);

describe('themes and layouts', () => {
  it('NOTE-TC91: applying a theme writes concrete fonts and colours and keeps photo backgrounds', () => {
    const heading = makeText('heading', 1250);
    const mono = { ...makeText('body', 1250), font: 'jetbrains-mono' as const };
    const boxed = { ...makeText('body', 1250), fill: '#ffffff', color: '#222222' };
    const els: SlideElement[] = [
      heading,
      makeText('body', 1250),
      mono,
      makeTable(1250),
      makeShape('rect', 1250),
      boxed,
    ];
    const deck: Deck = {
      ...emptyDeck(),
      slides: [
        { background: { kind: 'color', color: '#ffffff' }, elements: els, notes: 'mine' },
        { background: photo, elements: [makeCode(1250), makeLine(1250)], notes: '' },
      ],
    };
    const m = THEMES.midnight;
    const out = applyTheme(deck, 'midnight');
    expect(out.theme).toBe('midnight');
    const [h, b, code, table, shape] = out.slides[0].elements;
    expect(h).toMatchObject({ font: m.headingFont, color: m.heading, html: heading.html, x: heading.x });
    expect(b).toMatchObject({ font: m.bodyFont, color: m.text });
    expect(code).toMatchObject({ font: 'jetbrains-mono', color: m.text });
    expect(table).toMatchObject({ font: m.bodyFont, color: m.text, borderColor: m.muted });
    expect(shape).toMatchObject({ fill: m.accent, stroke: null });
    expect(out.slides[0].elements[5]).toMatchObject({ font: m.bodyFont, color: '#222222' }); // filled box keeps its colour
    expect(out.slides[0]).toMatchObject({ background: m.background, notes: 'mine' });
    expect(out.slides[1].background).toBe(photo);
    expect(out.slides[1].elements[0]).toMatchObject({ type: 'code', theme: m.code });
    expect(out.slides[1].elements[1]).toMatchObject({ stroke: m.accent });
    expect(deck.slides[0].elements[0]).toBe(heading); // the input deck is not changed
    expect(deckSchema.safeParse(out).success).toBe(true);
  });

  it('NOTE-TC92: every layout is a valid slide in every theme and aspect and is inserted as one step', () => {
    for (const theme of THEME_IDS)
      for (const aspect of ASPECTS)
        for (const id of LAYOUT_IDS) {
          const slide = layoutSlide(id, THEMES[theme], aspect, newId);
          const deck = { aspect, theme, slides: [slide], music: null };
          expect(deckSchema.safeParse(deck).success, `${theme} ${aspect} ${id}`).toBe(true);
          expect(applyTheme(deck, theme).slides[0]).toEqual(slide); // a layout is already in its theme
        }
    // The image placeholder stays muted, not accent, when the theme changes.
    const framed = applyTheme(
      { ...emptyDeck(), slides: [layoutSlide('image-caption', THEMES.plain, '4:5', newId)] },
      'journal',
    );
    expect(framed.slides[0].elements[0]).toMatchObject({ fill: THEMES.journal.muted });

    s().apply((d) => ({ ...d, slides: [{ ...d.slides[0], background: photo }] }));
    s().insertSlide(layoutSlide('title', THEMES.plain, '4:5', newId)); // empty first slide is filled
    expect(s().deck.slides).toHaveLength(1);
    expect(s().deck.slides[0].background).toBe(photo); // and keeps its photo
    s().insertSlide(layoutSlide('code', THEMES.plain, '4:5', newId)); // a full one gets a new slide after it
    expect(s().deck.slides).toHaveLength(2);
    expect(s().activeSlide).toBe(1);
    expect(s().deck.slides[1].elements.map((e) => e.type)).toEqual(['text', 'code']);
    s().undo();
    expect(s().deck.slides).toHaveLength(1);
  });

  it('NOTE-TC93: the schema rejects a font or theme outside the curated lists', () => {
    const deck = { ...emptyDeck(), slides: [layoutSlide('title', THEMES.plain, '4:5', newId)] };
    expect(deckSchema.safeParse(deck).success).toBe(true);
    expect(deckSchema.safeParse({ ...deck, theme: 'neon' }).success).toBe(false);
    const el = { ...deck.slides[0].elements[0], font: 'Comic Sans' };
    expect(deckSchema.safeParse({ ...deck, slides: [{ ...deck.slides[0], elements: [el] }] }).success).toBe(false);
  });

  it('NOTE-TC94: the Design panel applies a theme to the deck and adds a layout slide (client)', () => {
    s().addElement(makeText('heading', 1250));
    render(<PanelBody id="design" details={details} />);
    expect(screen.getByRole('radio', { name: /^Plain theme/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: /^Journal theme/ }));
    expect(s().deck.theme).toBe('journal');
    expect(s().deck.slides[0].elements[0]).toMatchObject({ font: 'lora', color: THEMES.journal.heading });
    expect(screen.getByRole('radio', { name: /^Journal theme/ }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Two columns' }));
    expect(s().deck.slides).toHaveLength(2);
    expect(s().deck.slides[1].background).toEqual(THEMES.journal.background);
    s().addSlide(); // a blank slide follows the theme too
    expect(s().deck.slides[2].background).toEqual(THEMES.journal.background);
  });
});
