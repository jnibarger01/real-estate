/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { type RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { pool } from './src/api/db/pool.js';
import dashboardRouter from './src/api/routes/dashboard.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

const authUser = process.env.DASHBOARD_AUTH_USER;
const authPassword = process.env.DASHBOARD_AUTH_PASSWORD;

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

const dashboardAuth: RequestHandler = (req, res, next) => {
  if (!authUser || !authPassword) return next();

  const authorization = req.get('authorization');
  if (authorization?.startsWith('Basic ')) {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator >= 0) {
      const username = decoded.slice(0, separator);
      const password = decoded.slice(separator + 1);
      if (constantTimeEqual(username, authUser) && constantTimeEqual(password, authPassword)) return next();
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Jackson County Property Intelligence"');
  return res.status(401).send('Authentication required');
};

// === API health check ===
app.get('/api/health', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, db: rows[0]?.ok === 1 ? 'connected' : 'unavailable', time: new Date().toISOString() });
  } catch (err: any) {
    res.status(503).json({ ok: false, db: 'error', detail: err.message });
  }
});

// === Dashboard API routes ===
app.use('/api', dashboardAuth, dashboardRouter);

// Protect the browser dashboard and its Vite/static assets when credentials are configured.
// MCP remains a separate integration surface and keeps its existing behavior.
app.use((req, res, next) => {
  if (req.path === '/mcp') return next();
  return dashboardAuth(req, res, next);
});

// === MCP endpoint (keep existing behavior) ===
app.all('/mcp', async (req, res) => {
  try {
    const body = req.body;
    const response = handleMcpJsonRpc(body);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'Internal error', data: err.message },
    });
  }
});

// === Static + Vite (dev mode) ===
async function startDevServer() {
  const vite = await createViteServer({ server: { middlewareMode: true }, root: __dirname });
  app.use(vite.middlewares);
  app.use(express.static(path.resolve(__dirname, 'dist', 'client')));
  return vite;
}

const viteDev = await startDevServer();

// === existing MCP tools kept ===
const MCP_TOOLS = [
  {
    name: 'search_properties',
    description: 'Search properties by location, price, bedrooms, bathrooms, square footage, property type, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City, state, or ZIP code (e.g. Kansas City, Overland Park 66204)' },
        minPrice: { type: 'number' },
        maxPrice: { type: 'number' },
        minBeds: { type: 'number' },
        minBaths: { type: 'number' },
        propertyType: { type: 'string' },
        status: { type: 'string', enum: ['for_sale', 'recently_sold', 'pending'] },
        limit: { type: 'number', default: 50 },
      },
    },
  },
  {
    name: 'get_property',
    description: 'Retrieve detailed record for a single property by zpid or propertyId.',
    inputSchema: {
      type: 'object',
      properties: {
        zpid: { type: 'string', description: 'Unique Zillow Property ID' },
        propertyId: { type: 'string' },
      },
      required: ['zpid'],
    },
  },
  {
    name: 'get_recent_sales',
    description: 'Return recently sold properties for a specified area and date range.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        months: { type: 'number', default: 12 },
        limit: { type: 'number', default: 25 },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_market_summary',
    description: 'Calculate statistical market KPIs including medians, averages, DOM, and inventory.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
      },
      required: ['location'],
    },
  },
  {
    name: 'get_market_trends',
    description: 'Return time-series trends for home values, inventory, volume, and $/sqft.',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string' },
        period: { type: 'string', enum: ['monthly', 'quarterly'], default: 'monthly' },
      },
      required: ['location'],
    },
  },
  {
    name: 'compare_markets',
    description: 'Compare metrics side-by-side across up to 10 geographic areas or ZIP codes.',
    inputSchema: {
      type: 'object',
      properties: {
        areas: { type: 'array', items: { type: 'string' }, description: 'List of ZIP codes or neighborhoods' },
      },
      required: ['areas'],
    },
  },
  {
    name: 'get_map_data',
    description: 'Return map-ready GeoJSON features and clusters for visible map bounds.',
    inputSchema: {
      type: 'object',
      properties: {
        northEast: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
        southWest: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' } } },
        limit: { type: 'number', default: 100 },
      },
    },
  },
  {
    name: 'get_data_sources',
    description: 'Return current active data provider, coverage, provenance, and freshness timestamps.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const MCP_RESOURCES = [
  { uri: 'realestate://schema/property', name: 'Property Data Schema', mimeType: 'application/json' },
  { uri: 'realestate://schema/market-summary', name: 'Market Summary Schema', mimeType: 'application/json' },
  { uri: 'realestate://data-sources', name: 'Active Data Provenance & Sources', mimeType: 'application/json' },
  { uri: 'realestate://limitations', name: 'Data Limitations & Disclaimers', mimeType: 'text/plain' },
  { uri: 'realestate://privacy', name: 'Privacy and Usage Notice', mimeType: 'text/plain' },
];

// MCP JSON-RPC Handler function
function handleMcpJsonRpc(body: any) {
  const { jsonrpc, method, params, id } = body || {};

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 'zillow-mcp', version: '1.0.0' },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
  }

  if (method === 'resources/list') {
    return { jsonrpc: '2.0', id, result: { resources: MCP_RESOURCES } };
  }

  if (method === 'resources/read') {
    const uri = params?.uri;
    if (uri === 'realestate://limitations') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: 'LIMITATIONS: Data generated in this environment is provided for analytical exploration. Estimated property values are calculated metrics and do not constitute formal appraisals.',
          }],
        },
      };
    }
    if (uri === 'realestate://privacy') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: 'PRIVACY: No user identification credentials or non-public personal information are stored or transmitted.',
          }],
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      result: {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ activeProvider: 'fixture_adapter', status: 'operational' }) }],
      },
    };
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};

    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'success',
            tool: name,
            executedAt: new Date().toISOString(),
            provider: 'fixture_adapter',
            argumentsUsed: args,
          }),
        }],
      },
    };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
}

// === Static serve built client ===
app.use(express.static(path.resolve(__dirname, 'dist', 'client')));

app.listen(PORT, () => console.log(`Dashboard API listening on http://localhost:${PORT}`));
