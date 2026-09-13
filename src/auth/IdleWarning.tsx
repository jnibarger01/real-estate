/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button } from '../components/ui/button';
import { useAuth } from './AuthContext';

export default function IdleWarning() {
  const { showIdleWarning, session, extendSession, logout, dismissIdleWarning } = useAuth();
  if (!showIdleWarning || !session?.authenticated) return null;

  const seconds = session.expiresAt
    ? Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000))
    : 0;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-300 bg-amber-50 px-4 py-3 shadow-lg"
      role="alertdialog"
      aria-label="Session expiring soon"
      data-testid="idle-warning"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-950">
          Your session will expire in about {seconds}s due to the configured timeout. Extend to keep
          working, or log out to clear owner data from this tab.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void logout()} data-testid="idle-logout">
            Log out
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              dismissIdleWarning();
              void extendSession();
            }}
            data-testid="idle-extend"
          >
            Extend session
          </Button>
        </div>
      </div>
    </div>
  );
}
