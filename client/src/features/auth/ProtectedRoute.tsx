import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { Role } from '../../types';

/** UI guard only; the server enforces every role check itself. */
export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <p role="alert" className="py-10 text-center text-body text-muted-foreground">
        You do not have permission to view this page.
      </p>
    );
  }
  return children;
}
