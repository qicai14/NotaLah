import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/api';

/** UI guard only; the server enforces every role check itself. */
export function ProtectedRoute({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <p role="alert" className="text-slate-700">
        You do not have permission to view this page.
      </p>
    );
  }
  return children;
}
