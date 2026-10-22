// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it } from 'vite-plus/test';
import { GuestPromptProvider, useGuestPrompt } from './GuestPrompt';

afterEach(cleanup);

function LikeButton() {
  const ask = useGuestPrompt();
  return <button onClick={() => ask({ action: 'like' })}>Like</button>;
}

function LoginPage() {
  const { state } = useLocation();
  return <p>login from {(state as { from: string }).from}</p>;
}

it('CLI-TC80: the guest prompt loads on first use, names the action and sends Log in back to this page', async () => {
  render(
    <MemoryRouter initialEntries={['/notes/7?s=2']}>
      <GuestPromptProvider>
        <Routes>
          <Route path="/notes/:id" element={<LikeButton />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </GuestPromptProvider>
    </MemoryRouter>,
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Like' }));
  // The lazy chunk is transformed on first import under test, which can take over a second.
  expect(await screen.findByRole('dialog', { name: 'Log in to like this note' }, { timeout: 5000 })).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(await screen.findByText('login from /notes/7?s=2')).toBeTruthy();
});
