import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/runtime', () => ({
  runtimeConfig: {
    isStatic: false,
    allowFixtures: false,
    apiKey: '',
    apiUrl: (path: string) => `http://provider.test${path}`,
  },
}));

import { ZillowMcpClient } from '../src/services/ZillowMcpClient.ts';

describe('ZillowMcpClient fail-closed', () => {
  beforeEach(() => {
    ZillowMcpClient.clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    ZillowMcpClient.clearCache();
  });

  it('does not convert a network failure into success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const result = await ZillowMcpClient.executeTool('zillow_search', { location: 'Kansas City, MO' });
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.source).toBe('mcp_server');
  });

  it('does not convert abort into a cached fixture success', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    const result = await ZillowMcpClient.executeTool('zillow_search', { location: 'Kansas City, MO' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('aborted');
    expect(result.data).toBeUndefined();
  });

  it('does not convert a provider 502 into success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ success: false, error: 'mcp_upstream_failed' }),
      }),
    );
    const result = await ZillowMcpClient.executeTool('zillow_search', { location: 'Kansas City, MO' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mcp_upstream_failed|502/);
  });
});
