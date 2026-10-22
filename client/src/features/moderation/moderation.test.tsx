// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import AdminLecturers from './AdminLecturers';

const apps = [
  {
    id: 4,
    displayName: 'Aisyah Rahman',
    email: 'a1@example.test',
    staffId: 'ST1042',
    programme: 'BSc SE',
    createdAt: new Date().toISOString(),
  },
  {
    id: 5,
    displayName: 'Daniel Wong',
    email: 'a2@example.test',
    staffId: null,
    programme: null,
    createdAt: new Date().toISOString(),
  },
];
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '');
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    status: 200,
    ok: true,
    headers: new Headers(),
    json: () => Promise.resolve(String(url).endsWith('lecturer-applications') ? { applications: apps } : {}),
  }));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminLecturers />
    </MemoryRouter>,
  );

describe('admin lecturer applications', () => {
  it('CLI-TC77: rejecting needs a reason; nothing is sent until one is typed', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reject Aisyah Rahman' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Reason is required');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Reason for rejecting'), { target: { value: 'Not staff' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reject' }));
    await waitFor(() => expect(screen.queryByText('Aisyah Rahman')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Aisyah Rahman rejected.');
  });

  it('CLI-TC77: approving removes the row, announces it and keeps the other application', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Daniel Wong' }));
    await waitFor(() => expect(screen.queryByText('Daniel Wong')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Daniel Wong approved as a lecturer.');
    expect(screen.getByText('Aisyah Rahman')).toBeTruthy();
  });
});
