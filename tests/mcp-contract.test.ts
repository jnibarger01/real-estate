import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';

const app = createApp({ enforceAuth: false });

describe('MCP fail-closed contract', () => {
  it('initializes on /mcp and /api/mcp', async () => {
    for (const path of ['/mcp', '/api/mcp']) {
      const response = await request(app)
        .post(path)
        .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
      expect(response.status).toBe(200);
      expect(response.body.result.serverInfo.name).toBe('jackson-county-dashboard');
    }
  });

  it('does not return fixture success from tools/call', async () => {
    for (const path of ['/mcp', '/api/mcp']) {
      const response = await request(app)
        .post(path)
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'search_properties', arguments: { q: 'MAIN' } },
        });
      expect(response.status).toBe(200);
      expect(response.body.result).toBeUndefined();
      expect(response.body.error).toBeTruthy();
      expect(String(response.body.error.message)).toMatch(/not mocked/i);
    }
  });

  it('protects both MCP paths when auth is configured', async () => {
    const previousUser = process.env.DASHBOARD_AUTH_USER;
    const previousPassword = process.env.DASHBOARD_AUTH_PASSWORD;
    process.env.DASHBOARD_AUTH_USER = 'dashboard-user';
    process.env.DASHBOARD_AUTH_PASSWORD = 'dashboard-pass';
    try {
      const locked = createApp({ enforceAuth: false });
      for (const path of ['/mcp', '/api/mcp']) {
        const denied = await request(locked)
          .post(path)
          .send({ jsonrpc: '2.0', id: 3, method: 'initialize', params: {} });
        expect(denied.status).toBe(401);
      }
    } finally {
      if (previousUser == null) delete process.env.DASHBOARD_AUTH_USER;
      else process.env.DASHBOARD_AUTH_USER = previousUser;
      if (previousPassword == null) delete process.env.DASHBOARD_AUTH_PASSWORD;
      else process.env.DASHBOARD_AUTH_PASSWORD = previousPassword;
    }
  });
});
