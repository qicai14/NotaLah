// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ElementBar } from './ElementBar';
import { makeText } from './elements';
import { emptyDeck, useEditor } from './store';
import { styleWholeBox, wholeBoxHas } from './wholeBox';

const s = () => useEditor.getState();
const text = () => s().deck.slides[0].elements[0] as ReturnType<typeof makeText>;

beforeEach(() => {
  s().load(emptyDeck());
  s().addElement({ ...makeText('body', 1250), html: '<p>Hash <strong>tables</strong></p>', weight: 400 });
});
afterEach(cleanup);

describe('whole-box text styling', () => {
  it('NOTE-TC70: marks apply to every character of a closed box and report their state', () => {
    expect(wholeBoxHas('<p>Hash <strong>tables</strong></p>', 'bold')).toBe(false);
    const italic = styleWholeBox('<p>Hash <strong>tables</strong></p>', 'italic', true);
    expect(wholeBoxHas(italic, 'italic')).toBe(true);
    expect(italic).toContain('<strong>');
    expect(wholeBoxHas(styleWholeBox(italic, 'italic', false), 'italic')).toBe(false);
    const list = styleWholeBox('<p>One</p><p>Two</p>', 'bulletList', true);
    expect(list).toMatch(/^<ul>/);
    expect(wholeBoxHas(list, 'bulletList')).toBe(true);
    expect(wholeBoxHas('', 'bold')).toBe(false);
  });

  it('NOTE-TC70: the toolbar says it styles the whole box and Bold uses the box weight', () => {
    render(<ElementBar />);
    expect(screen.getByText('Whole box')).toBeTruthy();
    const bold = screen.getByRole('button', { name: 'Bold (whole box)' });
    expect(bold.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(bold);
    expect(text().weight).toBe(700);
    fireEvent.click(screen.getByRole('button', { name: 'Bold (whole box)' }));
    expect(text().weight).toBe(400);
    expect(text().html).not.toContain('<strong>'); // bold runs inside are cleared too
    fireEvent.click(screen.getByRole('button', { name: 'Underline (whole box)' }));
    expect(wholeBoxHas(text().html, 'underline')).toBe(true);
    expect(screen.getByRole('button', { name: 'Underline (whole box)' }).getAttribute('aria-pressed')).toBe('true');
    s().undo();
    expect(wholeBoxHas(text().html, 'underline')).toBe(false); // each press is one undo step
  });
});
