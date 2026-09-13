/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type FormEvent } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from './AuthContext';

export default function LoginPage() {
  const { login, loginError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4" data-testid="login-page">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Building2 className="size-6 text-violet-700" />
          <h1 className="text-xl font-bold text-slate-900">Sign in</h1>
        </div>
        <p className="mb-6 text-sm text-slate-500">
          Jackson County Property Intelligence requires authentication. Sessions expire after the
          configured TTL; sign out clears owner data from this browser tab.
        </p>
        <form className="space-y-4" onSubmit={onSubmit} data-testid="login-form">
          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-medium text-slate-700">
              Username
            </label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              data-testid="login-username"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="login-password"
            />
          </div>
          {loginError && (
            <p className="text-sm text-rose-700" role="alert" data-testid="login-error">
              {loginError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting} data-testid="login-submit">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
