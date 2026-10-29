// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ADMIN_RAIL } from '@/components/shell/nav';
import AdminModules from './AdminModules';

const list = [
  { id: 1, code: 'CT001', name: 'Intro to Computing', programme: 'BSc SE', noteCount: 3 },
  { id: 2, code: 'CT002', name: 'Databases', programme: 'BSc SE', noteCount: 1 },
];
const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => ({
  status,
  ok: status < 400,
  headers: new Headers(),
  json: () => Promise.resolve(body),
});

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '');
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).endsWith('/programmes')) return reply(200, { items: ['BSc SE'] });
    return reply(200, { modules: list });
  });
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
      <AdminModules />
    </MemoryRouter>,
  );
const writes = () => fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET');

describe('admin modules', () => {
  it('ADM-TC35: the admin rail links to Modules', () => {
    expect(ADMIN_RAIL.filter((i) => i.label === 'Modules').map((i) => i.to)).toEqual(['/admin/modules']);
  });

  it('CLI-TC87: lists every module with its programme and note count', async () => {
    renderPage();
    expect(await screen.findByText('CT001 · Intro to Computing')).toBeTruthy();
    expect(screen.getByText('BSc SE · 3 notes')).toBeTruthy();
    expect(screen.getByText('BSc SE · 1 note')).toBeTruthy();
  });

  it('CLI-TC88: adding a module posts the form and shows the new row', async () => {
    renderPage();
    await screen.findByText('CT001 · Intro to Computing');
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'CT003' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Networks' } });
    await screen.findByRole('option', { name: 'BSc SE' });
    fireEvent.change(screen.getByLabelText('Programme'), { target: { value: 'BSc SE' } });
    fetchMock.mockImplementationOnce(async () =>
      reply(201, { module: { id: 3, code: 'CT003', name: 'Networks', programme: 'BSc SE', noteCount: 0 } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));
    expect(await screen.findByText('CT003 · Networks')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Module CT003 added.');
    expect(JSON.parse(writes()[0][1].body)).toEqual({ code: 'CT003', name: 'Networks', programme: 'BSc SE' });
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('');
  });

  it('CLI-TC89: a duplicate code shows the server message and adds no row', async () => {
    renderPage();
    await screen.findByText('CT001 · Intro to Computing');
    fetchMock.mockImplementationOnce(async () => reply(409, { error: 'Module code already exists' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Module code already exists');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('CLI-TC90: validation errors from the server show beside their fields', async () => {
    renderPage();
    await screen.findByText('CT001 · Intro to Computing');
    fetchMock.mockImplementationOnce(async () =>
      reply(400, { error: 'Validation failed', errors: { code: 'Code is required', name: 'Name is required' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add module' }));
    await waitFor(() => expect(screen.getByLabelText('Code').getAttribute('aria-invalid')).toBe('true'));
    expect(screen.getByText('Code is required')).toBeTruthy();
    expect(screen.getByText('Name is required')).toBeTruthy();
  });

  it('CLI-TC91: renaming sends only the name and updates the row', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename CT002' }));
    const input = screen.getByLabelText('Name for CT002') as HTMLInputElement;
    expect(input.value).toBe('Databases');
    fireEvent.change(input, { target: { value: 'Database Systems' } });
    fetchMock.mockImplementationOnce(async () => reply(200, { module: { ...list[1], name: 'Database Systems' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('CT002 · Database Systems')).toBeTruthy();
    expect(writes()[0][0]).toBe('/api/admin/modules/2');
    expect(JSON.parse(writes()[0][1].body)).toEqual({ name: 'Database Systems' });
  });

  it('CLI-TC92: a rejected rename keeps the form open with the error inline', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Rename CT001' }));
    fireEvent.change(screen.getByLabelText('Name for CT001'), { target: { value: ' ' } });
    fetchMock.mockImplementationOnce(async () =>
      reply(400, { error: 'Validation failed', errors: { name: 'Name is required' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Name is required')).toBeTruthy();
    expect(screen.getByLabelText('Name for CT001').getAttribute('aria-invalid')).toBe('true');
  });
});
