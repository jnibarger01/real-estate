import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

const port = 3222;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server start timeout')), 10000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Dashboard API listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.on('exit', (code) => reject(new Error(`server exited early: ${code}`)));
  });
}

test('configured auth protects dashboard API; SPA document stays reachable for login', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DISABLE_HMR: 'true',
      DASHBOARD_AUTH_USER: 'dashboard-user',
      DASHBOARD_AUTH_PASSWORD: 'dashboard-pass',
      SESSION_SECRET: 'dashboard-auth-test-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const denied = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary`);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('www-authenticate') ?? '', /Basic/);

    const loginPage = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(loginPage.status, 200);

    const authorization = `Basic ${Buffer.from('dashboard-user:dashboard-pass').toString('base64')}`;
    const allowed = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary`, {
      headers: { authorization },
    });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.ok(Number(body.total_properties) > 0);

    const sessionLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'dashboard-user', password: 'dashboard-pass' }),
    });
    assert.equal(sessionLogin.status, 200);
    const setCookie = sessionLogin.headers.getSetCookie?.() ?? [];
    assert.ok(setCookie.some((c) => c.startsWith('dashboard_session=')));
  } finally {
    child.kill('SIGTERM');
  }
});
