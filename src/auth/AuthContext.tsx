/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { runtimeConfig } from '../config/runtime';
import { authApi } from '../lib/api';
import type { SessionInfo } from './types';

type AuthContextValue = {
  status: 'loading' | 'anonymous' | 'authenticated';
  session: SessionInfo | null;
  showIdleWarning: boolean;
  loginError: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  extendSession: () => Promise<void>;
  dismissIdleWarning: () => void;
  clearClientState: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function clearClientStateImpl(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.clear();
  queryClient.removeQueries();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'anonymous' | 'authenticated'>('loading');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const expiryTimer = useRef<number | null>(null);
  const warnTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (expiryTimer.current != null) window.clearTimeout(expiryTimer.current);
    if (warnTimer.current != null) window.clearTimeout(warnTimer.current);
    expiryTimer.current = null;
    warnTimer.current = null;
  };

  const clearClientState = useCallback(() => {
    clearClientStateImpl(queryClient);
  }, [queryClient]);

  const applySession = useCallback(
    (info: SessionInfo) => {
      clearTimers();
      setSession(info);
      setShowIdleWarning(false);
      if (!info.authenticated) {
        setStatus(info.authRequired ? 'anonymous' : 'authenticated');
        return;
      }
      setStatus('authenticated');
      if (!info.expiresAt || !info.authRequired) return;

      const msLeft = info.expiresAt - Date.now();
      const warnIn = msLeft - (info.idleWarningMs || 60_000);
      if (warnIn <= 0) {
        setShowIdleWarning(true);
      } else {
        warnTimer.current = window.setTimeout(() => setShowIdleWarning(true), warnIn);
      }
      expiryTimer.current = window.setTimeout(() => {
        void (async () => {
          clearClientState();
          try {
            await authApi.logout();
          } catch {
            /* ignore */
          }
          setSession({ ...info, authenticated: false });
          setStatus('anonymous');
          setShowIdleWarning(false);
        })();
      }, Math.max(0, msLeft));
    },
    [clearClientState],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (runtimeConfig.isPagesBuild) {
        if (!cancelled) {
          setStatus('authenticated');
          setSession({
            authenticated: true,
            authRequired: false,
            ttlMs: 0,
            idleWarningMs: 0,
          });
        }
        return;
      }
      try {
        const info = await authApi.session();
        if (!cancelled) applySession(info);
      } catch {
        if (!cancelled) {
          setStatus('anonymous');
          setSession({
            authenticated: false,
            authRequired: true,
            ttlMs: 30 * 60_000,
            idleWarningMs: 60_000,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [applySession]);

  // When any dashboard fetch gets 401, drop client PII and return to login.
  useEffect(() => {
    const onUnauthorized = () => {
      clearClientState();
      setShowIdleWarning(false);
      setStatus('anonymous');
      setSession((prev) =>
        prev
          ? { ...prev, authenticated: false, authRequired: true }
          : { authenticated: false, authRequired: true, ttlMs: 30 * 60_000, idleWarningMs: 60_000 },
      );
    };
    window.addEventListener('dashboard:unauthorized', onUnauthorized);
    return () => window.removeEventListener('dashboard:unauthorized', onUnauthorized);
  }, [clearClientState]);

  const login = useCallback(
    async (username: string, password: string) => {
      setLoginError(null);
      try {
        const info = await authApi.login(username, password);
        if (!info.authenticated) {
          setLoginError('Invalid credentials');
          return false;
        }
        clearClientState();
        applySession(info);
        return true;
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : 'Sign-in failed');
        return false;
      }
    },
    [applySession, clearClientState],
  );

  const logout = useCallback(async () => {
    clearTimers();
    clearClientState();
    try {
      await authApi.logout();
    } catch {
      /* still clear local state */
    }
    setShowIdleWarning(false);
    setStatus('anonymous');
    setSession((prev) =>
      prev
        ? { ...prev, authenticated: false, authRequired: true }
        : { authenticated: false, authRequired: true, ttlMs: 30 * 60_000, idleWarningMs: 60_000 },
    );
  }, [clearClientState]);

  const extendSession = useCallback(async () => {
    try {
      const info = await authApi.touch();
      applySession(info);
    } catch {
      await logout();
    }
  }, [applySession, logout]);

  const dismissIdleWarning = useCallback(() => setShowIdleWarning(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      showIdleWarning,
      loginError,
      login,
      logout,
      extendSession,
      dismissIdleWarning,
      clearClientState,
    }),
    [
      status,
      session,
      showIdleWarning,
      loginError,
      login,
      logout,
      extendSession,
      dismissIdleWarning,
      clearClientState,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
