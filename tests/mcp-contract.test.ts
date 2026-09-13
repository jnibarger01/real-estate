import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.ts';
import { MCP_TOOLS } from '../src/api/mcp.ts';

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

  it('lists only read-only non-PII tools', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 10, method: 'tools/list', params: {} });
    expect(response.status).toBe(200);
    const names = (response.body.result.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toEqual(['get_dashboard_summary']);
    expect(names).not.toContain('search_properties');
    expect(names).not.toContain('get_property');
    for (const tool of MCP_TOOLS) {
      expect(tool.ownerPii).toBe(false);
      expect(tool.dbRole).toBe('dashboard_readonly');
    }
  });

  it('refuses owner-PII tool names over tools/call', async () => {
    for (const path of ['/mcp', '/api/mcp']) {
      for (const name of ['search_properties', 'get_property']) {
        const response = await request(app)
          .post(path)
          .send({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name, arguments: { q: 'MAIN' } },
          });
        expect(response.status).toBe(200);
        expect(response.body.result).toBeUndefined();
        expect(response.body.error).toBeTruthy();
        expect(response.body.error.code).toBe(-32001);
        expect(String(response.body.error.message)).toMatch(/Owner PII|REST \/api\/properties/i);
      }
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
