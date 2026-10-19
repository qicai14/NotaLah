// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ProgrammeSelect } from '../../components/ProgrammeSelect';
import Register from './Register';

const register = vi.fn();
vi.mock('./AuthContext', () => ({ useAuth: () => ({ register }) }));

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: () => Promise.resolve({ items: ['Computer Science', 'Software Engineering'] }),
    })),
  );
});

afterEach(() => {
  cleanup();
  register.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('programme select', () => {
  it('CLI-TC15: lists the catalogue programmes after a placeholder', async () => {
    render(<ProgrammeSelect value="" onChange={() => {}} />);
    await screen.findByRole('option', { name: 'Software Engineering' });
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['Choose a programme', 'Computer Science', 'Software Engineering']);
  });

  it('CLI-TC16: keeps a stored programme that is no longer in the catalogue', async () => {
    render(<ProgrammeSelect value="Old Programme" onChange={() => {}} />);
    await screen.findByRole('option', { name: 'Computer Science' });
    expect((screen.getByLabelText('Programme') as HTMLSelectElement).value).toBe('Old Programme');
  });

  it('CLI-TC17: register submits the chosen programme', async () => {
    register.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>,
    );
    await screen.findByRole('option', { name: 'Software Engineering' });
    await user.selectOptions(screen.getByLabelText('Programme'), 'Software Engineering');
    await user.click(screen.getByRole('button', { name: 'Register' }));
    await waitFor(() => expect(register).toHaveBeenCalled());
    expect(register.mock.calls[0][0].programme).toBe('Software Engineering');
  });

  it('CLI-TC18: shows an alert and Retry when the programme list fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 500, ok: false, headers: new Headers(), json: () => Promise.resolve({}) })),
    );
    render(<ProgrammeSelect value="" onChange={() => {}} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load programmes');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
