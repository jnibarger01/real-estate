/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type RequestHandler } from 'express';
import { ZodError } from 'zod';
import { GoogleGenAI, Type } from '@google/genai';
import { inspectDatabase } from './db/pool.js';
import dashboardRouter from './routes/dashboard.js';
import { createProviderRouter } from './routes/provider.js';
import { apiRateLimit, accessLog, corsAllowList, piiRateLimit, requestId, securityHeaders } from '../server/httpDefaults.js';
import { createProtectMiddleware, mcpEnabled } from './auth.js';

export { createProtectMiddleware, assertDashboardAuthConfigured } from './auth.js';

const MCP_TOOLS = [
  {
    name: 'search_properties',
    description: 'Search Jackson County properties by address, parcel, owner, and value filters.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' }, limit: { type: 'number' } } },
  },
  {
    name: 'get_property',
    description: 'Retrieve a county property record by integer property_id.',
    inputSchema: { type: 'object', properties: { propertyId: { type: 'number' } }, required: ['propertyId'] },
  },
];

function handleMcpJsonRpc(body: Record<string, unknown>) {
  const method = body?.method;
  const id = body?.id;
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'jackson-county-dashboard', version: '2.0.0' },
      },
    };
  }
  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
  }
  if (method === 'tools/call') {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: 'Use REST /api/properties/*; MCP tool execution is not mocked.' },
    };
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${String(method)}` } };
}

export function createApp(options: { enforceAuth?: boolean } = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(accessLog);
  app.use(corsAllowList());
  app.use('/api', apiRateLimit());
  app.use(['/api/properties', '/api/map'], piiRateLimit());

  const protect = createProtectMiddleware(options);

  const healthHandler: RequestHandler = async (_req, res) => {
    const inspection = await inspectDatabase();
    const processOk = true;
    const ingestStale = !inspection.ingestFreshness.ok;
    const status = !inspection.database.ok
      ? 'error'
      : !inspection.postgis.ok || !inspection.queryReadiness.ok || ingestStale
        ? 'degraded'
        : 'ok';
    const failClosed = process.env.NODE_ENV === 'production' && (status === 'error' || ingestStale);
    const http = failClosed || status === 'error' ? 503 : 200;
    res.status(http).json({
      status: failClosed ? 'error' : status,
      process: { ok: processOk, uptimeSec: Math.round(process.uptime()) },
      database: inspection.database,
      postgis: inspection.postgis,
      queryReadiness: inspection.queryReadiness,
      ingestFreshness: inspection.ingestFreshness,
      time: new Date().toISOString(),
    });
  };

  app.get('/api/health', healthHandler);
  app.get('/healthz', healthHandler);
  app.get('/health', healthHandler);

  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/provider/status') return next();
    return protect(req, res, next);
  });
  app.use('/api', dashboardRouter);
  app.use('/api', createProviderRouter());

  if (mcpEnabled()) {
    app.post(['/mcp', '/api/mcp'], protect, (req, res) => {
      res.json(handleMcpJsonRpc(req.body || {}));
    });
  } else {
    const disabled: RequestHandler = (_req, res) => {
      res.status(404).json({ error: 'mcp_disabled' });
    };
    app.post(['/mcp', '/api/mcp'], disabled);
  }

  app.post('/api/zillow/mcp', async (req, res) => {
    const { toolName, params } = req.body || {};
    const allowedTools = new Set(['zillow_search', 'zillow_property_details', 'zillow_market_trends']);
    if (!toolName || typeof toolName !== 'string' || !allowedTools.has(toolName)) {
      return res.status(400).json({ success: false, error: 'toolName is invalid.' });
    }
    if (!process.env.RENTCAST_API_KEY?.trim() && !process.env.ZILLOW_MCP_SERVER_URL) {
      return res.status(503).json({
        success: false,
        error: 'Live provider is not configured on the backend.',
        source: 'unconfigured',
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const mcpServerUrl = process.env.ZILLOW_MCP_SERVER_URL;
      if (mcpServerUrl) {
        const response = await fetch(mcpServerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tools/call',
            params: { name: toolName, arguments: params },
            id: Date.now(),
          }),
        });
        if (!response.ok) {
          return res.status(502).json({ success: false, error: 'mcp_upstream_failed' });
        }
        const rpcData = await response.json();
        return res.json({
          success: true,
          data: rpcData.result || rpcData,
          source: 'mcp_server',
          timestamp: new Date().toISOString(),
        });
      }

      const { executeRentCastTool } = await import('../server/rentcast.js');
      const data = await executeRentCastTool(toolName, params || {});
      return res.json({
        success: true,
        data,
        provider: 'rentcast',
        source: 'mcp_server',
        timestamp: new Date().toISOString(),
      });
    } catch {
      return res.status(502).json({ success: false, error: 'mcp_upstream_failed' });
    }
  });

  app.post('/api/market-insights', async (req, res) => {
    const { marketSummary = {}, searchRegion = 'selected area' } = req.body || {};
    const apiKeyGemini = process.env.GEMINI_API_KEY;
    if (!apiKeyGemini) {
      const total = Number(marketSummary.totalProperties || 0);
      const median = Number(marketSummary.medianListingPrice || 0);
      return res.json({
        isAiGenerated: false,
        executiveSummary: `${searchRegion}: ${total} records currently in the filtered result set${median ? ` with a median of $${median.toLocaleString()}` : ''}.`,
        verifiedFacts: [`${total} records matched the current filters.`],
        calculatedMetrics: [],
        aiInterpretations: [],
        missingDataNotes: ['Deterministic fallback; GEMINI_API_KEY is not configured.'],
        predictions: [],
        generatedAt: new Date().toISOString(),
      });
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKeyGemini });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: `Analyze this market snapshot for ${searchRegion}: ${JSON.stringify(marketSummary)}. Distinguish verified facts from interpretation.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
              calculatedMetrics: { type: Type.ARRAY, items: { type: Type.STRING } },
              aiInterpretations: { type: Type.ARRAY, items: { type: Type.STRING } },
              missingDataNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
              predictions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['executiveSummary', 'verifiedFacts', 'calculatedMetrics', 'aiInterpretations'],
          },
        },
      });
      return res.json({
        ...JSON.parse(response.text || '{}'),
        isAiGenerated: true,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Gemini market insights failed:', error);
      return res.status(500).json({ error: 'Failed to generate AI insights' });
    }
  });

  app.get('/api/mcp/status', (_req, res) => {
    res.json({
      mcpConfigured: Boolean(process.env.ZILLOW_MCP_SERVER_URL),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Request parameters are invalid',
      });
    }
    console.error('Unhandled API error:', error);
    return res.status(500).json({ error: 'internal_error', message: 'Internal server error' });
  });

  return app;
}
