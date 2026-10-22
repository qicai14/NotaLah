import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './features/auth/AuthContext';
import { MessagingProvider } from './features/messaging/MessagingContext';
import { NotificationsProvider } from './features/notifications/NotificationsContext';
import { initErrorReporting } from './lib/errorReporting';
import './index.css';

void initErrorReporting().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MessagingProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </MessagingProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
