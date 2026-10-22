// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import type { User } from '../../types';
import { MessagingProvider, useMessaging } from './MessagingContext';

// The dynamic import rejects, as when the chunk cannot be fetched.
vi.mock('socket.io-client', () => {
  throw new Error('Failed to fetch dynamically imported module');
});
const sam: User = {
  id: 1,
  email: 'sam@apu.edu.my',
  displayName: 'Sam',
  role: 'student',
  status: 'active',
  lecturerStatus: null,
  programme: null,
};
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ user: sam }) }));

afterEach(cleanup);

function Probe() {
  const { error, socket } = useMessaging();
  return <p>{error ?? (socket ? 'connected' : 'waiting')}</p>;
}

it('CLI-TC81: a socket client that fails to load shows the offline message', async () => {
  render(
    <MessagingProvider>
      <Probe />
    </MessagingProvider>,
  );
  expect(await screen.findByText('Live updates are offline. Refresh to try again.')).toBeTruthy();
});
