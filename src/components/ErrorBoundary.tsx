/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App-level render error boundary for the authenticated dashboard shell.
 * Shows a recovery panel instead of a blank root; "Try again" resets the
 * boundary and remounts children. No external error reporting.
 */

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Optional sign-out action (e.g. useAuth().logout). */
  onSignOut?: () => void | Promise<void>;
};

type State = { error: Error | null; resetKey: number };

export default class ErrorBoundary extends Component<Props, State> {
  // The repo has no @types/react, so declare the Component members we use.
  declare props: Readonly<Props>;
  declare setState: (updater: (prev: State) => Partial<State>) => void;
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard render error', { message: error.message, componentStack: info.componentStack });
  }

  private reset = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render() {
    const { error, resetKey } = this.state;
    if (!error) {
      // Keyed wrapper so "Try again" remounts the subtree with fresh state.
      return <Fragment key={resetKey}>{this.props.children}</Fragment>;
    }
    const { onSignOut } = this.props;
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4" data-testid="error-boundary">
        <div
          role="alert"
          aria-live="assertive"
          className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 text-slate-900 shadow-sm"
        >
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mt-2 text-sm text-slate-600">
            The dashboard hit an unexpected error while rendering. Try again, or sign out and back in if it keeps
            happening.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="rounded-md bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800"
              data-testid="error-boundary-retry"
            >
              Try again
            </button>
            {onSignOut && (
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                data-testid="error-boundary-signout"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
