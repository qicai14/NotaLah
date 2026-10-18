// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Drafts from './Drafts';
import { PublishDialog } from './PublishDialog';

const slide = {
  background: { kind: 'color' as const, color: '#ffffff' },
  elements: [],
};

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status: 200,
      ok: true,
      headers: new Headers(),
      json: () =>
        Promise.resolve({
          notes: [
            {
              id: 3,
              title: 'Indexing: B-tree vs hash',
              module: { id: 1, code: 'CT030', name: 'Databases' },
              hashtags: [],
              updatedAt: new Date().toISOString(),
              aspect: '4:5',
              slideCount: 4,
              cover: slide,
              assets: {},
            },
          ],
          nextCursor: null,
        }),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('drafts and publish preview', () => {
  it('NOTE-TC90: draft tiles show the first slide, module, slide count and a way back into the editor', async () => {
    render(
      <MemoryRouter>
        <Drafts />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Indexing: B-tree vs hash')).toBeTruthy();
    expect(screen.getByText('CT030')).toBeTruthy();
    expect(screen.getByText(/4 slides/)).toBeTruthy();
    expect(document.querySelector('[aria-roledescription=slide]')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Continue editing Indexing: B-tree vs hash' });
    expect(link.getAttribute('href')).toBe('/notes/3/edit');
  });

  it('NOTE-TC90: the publish dialog previews the first slide with the slide count and size', () => {
    render(
      <PublishDialog
        initial={null}
        alreadyPublished={false}
        busy={false}
        onChoose={() => {}}
        onClose={() => {}}
        preview={{ title: 'Week 6', slide, aspect: '16:9', slides: 1, assets: {} }}
      />,
    );
    expect(screen.getByText('Week 6')).toBeTruthy();
    expect(screen.getByText('1 slide · 16:9')).toBeTruthy();
  });
});
