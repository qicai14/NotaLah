// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AspectPicker } from './AspectPicker';
import { emptyDeck, useEditor } from './store';

const s = () => useEditor.getState();

beforeEach(() => s().load(emptyDeck()));
afterEach(cleanup);

describe('slide size picker', () => {
  it('NOTE-TC71: choosing a size waits for Resize; Cancel leaves the deck alone', () => {
    render(<AspectPicker compact={false} />);
    fireEvent.click(screen.getByRole('button', { name: /4:5 Portrait/ }));
    expect(screen.getByText(/Content is scaled to fit and centred/)).toBeTruthy();
    const resize = screen.getByRole('button', { name: 'Resize' });
    expect((resize as HTMLButtonElement).disabled).toBe(true); // the current size is not a change
    fireEvent.click(screen.getByRole('radio', { name: /16:9 Widescreen/ }));
    expect(s().deck.aspect).toBe('4:5');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(s().deck.aspect).toBe('4:5');
    fireEvent.click(screen.getByRole('button', { name: /4:5 Portrait/ }));
    fireEvent.click(screen.getByRole('radio', { name: /9:16 Full screen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Resize' }));
    expect(s().deck.aspect).toBe('9:16');
    expect(s().past).toHaveLength(1);
  });
});
