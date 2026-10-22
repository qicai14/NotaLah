// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import AdminLecturers from './AdminLecturers';
import AdminReports from './AdminReports';

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
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(String(url)).toMatch(/\/lecturer-applications\/4\/reject$/);
    expect(String(init.body)).toContain('"reason":"Not staff"');
  });

  it('CLI-TC77: approving removes the row, announces it and keeps the other application', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Approve Daniel Wong' }));
    await waitFor(() => expect(screen.queryByText('Daniel Wong')).toBeNull());
    expect(screen.getByRole('status').textContent).toBe('Daniel Wong approved as a lecturer.');
    expect(screen.getByText('Aisyah Rahman')).toBeTruthy();
  });
});

describe('admin reports', () => {
  it('CLI-TC77: opening a review focuses its panel and closing returns focus to Review', async () => {
    const group = {
      id: 9,
      title: 'Indexing',
      author: { id: 2, displayName: 'Priya' },
      reportCount: 1,
      oldestReportAt: new Date().toISOString(),
      reports: [{ id: 1, reason: 'spam', reporter: 'Farah', details: null, createdAt: new Date().toISOString() }],
    };
    fetchMock.mockImplementation(async (url: string) => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve(
          String(url).endsWith('/admin/reports')
            ? { groups: [group], nextCursor: null }
            : {
                group: {
                  ...group,
                  status: 'published',
                  module: { code: 'CT030' },
                  slides: [],
                  aspect: '4:5',
                  assets: {},
                },
              },
        ),
    }));
    render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>,
    );
    const review = await screen.findByRole('button', { name: 'Review Indexing' });
    fireEvent.click(review);
    const panel = await screen.findByRole('region', { name: 'Review Indexing' });
    await waitFor(() => expect(document.activeElement).toBe(panel));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.activeElement).toBe(review));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Reported content');
  });
});
