import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

const port = 3219;

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

test('GET /api/health returns database health JSON in dev mode', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), DISABLE_HMR: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await waitForServer(child);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /application\/json/);
    const body = await response.json();
    assert.equal(body.process.ok, true);
    assert.equal(body.database.ok, true);
    const invalidBbox = await fetch(`http://127.0.0.1:${port}/api/map/properties?bbox=-181,38,-93,39`);
    assert.equal(invalidBbox.status, 400);
    assert.deepEqual(await invalidBbox.json(), {
      error: 'validation_error',
      message: 'Request parameters are invalid',
    });
  } finally {
    child.kill('SIGTERM');
  }
});
