/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from './dashboard/DashboardPage';
import { AuthProvider, useAuth } from './auth/AuthContext';
import LoginPage from './auth/LoginPage';
import IdleWarning from './auth/IdleWarning';
import ErrorBoundary from './components/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DashboardShell() {
  const { status, logout } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] text-sm text-slate-500" data-testid="auth-loading">
        Checking session…
      </div>
    );
  }

  if (status === 'anonymous') {
    return <LoginPage />;
  }

  // Only the authenticated shell is wrapped; LoginPage keeps its own inline
  // auth error handling.
  return (
    <ErrorBoundary onSignOut={logout}>
      <DashboardPage />
      <IdleWarning />
    </ErrorBoundary>
  );
}

export default function DashboardApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DashboardShell />
      </AuthProvider>
    </QueryClientProvider>
  );
}
