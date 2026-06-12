/**
 * Route guards
 *
 * RequireAuth     — redirects to /login if not authenticated
 * RequireRole     — redirects to role root if wrong role
 * RedirectToRole  — after login, sends user to their role's root path
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getRoleRoot } from '../config/navigation';
import type { UserRole } from '../stores/authStore';

// ── RequireAuth ───────────────────────────────────────────────────────────────

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ── RequireRole ───────────────────────────────────────────────────────────────

interface RequireRoleProps {
  children: React.ReactNode;
  roles: UserRole[];
}

export function RequireRole({ children, roles }: RequireRoleProps) {
  const { user, isAuthenticated, clearAuth } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    // Token persisted but user missing — clear and re-login
    clearAuth();
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(user.role as UserRole)) {
    // Redirect to the user's own role root
    const root = getRoleRoot(user.role);
    return <Navigate to={root} replace />;
  }

  return <>{children}</>;
}

// ── RedirectToRole ────────────────────────────────────────────────────────────
// Used at "/" — sends authenticated users to their role's home

export function RedirectToRole() {
  const { user, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const root = user ? getRoleRoot(user.role) : '/login';
  return <Navigate to={root} replace />;
}
