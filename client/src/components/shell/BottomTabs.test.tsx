// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { BottomTabs } from './BottomTabs';

let messages = 0;
let notifications = 0;
vi.mock('@/features/messaging/MessagingContext', () => ({ useUnread: () => messages }));
vi.mock('@/features/notifications/NotificationsContext', () => ({ useNotificationUnread: () => notifications }));

afterEach(cleanup);

describe('R8 UI phone inbox badge', () => {
  it('NTF-TC25 the Inbox tab shows messages plus notifications and names both', () => {
    messages = 3;
    notifications = 2;
    render(
      <MemoryRouter>
        <BottomTabs />
      </MemoryRouter>,
    );
    const tab = screen.getByRole('link', { name: 'Inbox, 3 messages and 2 notifications' });
    expect(tab.textContent).toContain('5');
  });

  it('NTF-TC25 no badge or count label when both are zero', () => {
    messages = 0;
    notifications = 0;
    render(
      <MemoryRouter>
        <BottomTabs />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Inbox' }).textContent).toBe('Inbox');
  });
});
