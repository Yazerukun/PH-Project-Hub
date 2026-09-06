import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../stores/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, initialized } = useAuth();
  const location = useLocation();
  if (!initialized) return null;
  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

export function AdminRoute({ children, roles = ['OWNER', 'ADMIN'] }: { children: ReactNode; roles?: string[] }) {
  const { user, initialized } = useAuth();
  if (!initialized) return null;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-10 text-center">
        <p className="text-lg font-semibold text-red-300">403 — Access denied</p>
        <p className="mt-1 text-sm text-gray-400">You don&apos;t have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}