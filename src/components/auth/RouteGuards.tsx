import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../lib/auth/context";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }

  if (profile && !profile.onboarding_completed && !location.pathname.startsWith("/onboarding")) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    const redirect = encodeURIComponent(location.pathname);
    return <Navigate to={`/auth?redirect=${redirect}`} replace />;
  }
  if (!isAdmin) return <Navigate to="/403" replace />;
  return children;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (profile && !profile.onboarding_completed) return <Navigate to="/onboarding" replace />;
    return <Navigate to="/app" replace />;
  }
  return children;
}
