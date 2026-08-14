import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createBackendApp } from '../backend';
const app = createBackendApp();
describe('backend API', () => {
  it('reports health and honest provider capability status', async () => { expect((await request(app).get('/healthz')).status).toBe(200); const status = await request(app).get('/api/provider/status'); expect(status.body.capabilities.pendingStatus).toBe(false); expect(status.body.capabilities.avm).toBe(true); });
  it('rejects malformed MCP requests', async () => { const response = await request(app).post('/api/zillow/mcp').send({ toolName: 'not-a-tool' }); expect(response.status).toBe(400); expect(response.headers['x-request-id']).toBeTruthy(); });
  it('does not pretend an unconfigured provider is available', async () => { const response = await request(app).post('/api/zillow/mcp').send({ toolName: 'zillow_search', params: { location: 'Kansas City, MO' } }); expect(response.status).toBe(503); });
});
