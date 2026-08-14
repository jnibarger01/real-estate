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

test('configured basic auth protects dashboard UI and API', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      DISABLE_HMR: 'true',
      DASHBOARD_AUTH_USER: 'dashboard-user',
      DASHBOARD_AUTH_PASSWORD: 'dashboard-pass',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const denied = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary`);
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('www-authenticate') ?? '', /Basic/);

    const deniedPage = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(deniedPage.status, 401);

    const authorization = `Basic ${Buffer.from('dashboard-user:dashboard-pass').toString('base64')}`;
    const allowed = await fetch(`http://127.0.0.1:${port}/api/dashboard/summary`, {
      headers: { authorization },
    });
    assert.equal(allowed.status, 200);
    const body = await allowed.json();
    assert.ok(Number(body.total_properties) > 0);
  } finally {
    child.kill('SIGTERM');
  }
});
