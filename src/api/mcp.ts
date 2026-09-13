/**
 * Jackson County dashboard MCP (JSON-RPC) surface.
 *
 * Owner PII is never returned over MCP. Property search/detail stay on
 * authenticated REST `/api/properties/*` (role `dashboard_app`).
 * MCP tools use only `dashboard_readonly` aggregates.
 */

import { queryOne } from './db/pool.js';

export type McpDbRole = 'dashboard_readonly' | 'dashboard_app';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Postgres role the tool's SELECT is granted to. */
  dbRole: McpDbRole;
  /** Owner name / mailing address present in the payload. */
  ownerPii: boolean;
}

/** Tools advertised by `tools/list` and executable via `tools/call`. */
export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_dashboard_summary',
    description:
      'Non-PII county KPI aggregate from api.dashboard_summary (property counts, value stats). Uses dashboard_readonly grants; never returns owner name or mailing address.',
    inputSchema: { type: 'object', properties: {} },
    dbRole: 'dashboard_readonly',
    ownerPii: false,
  },
];

const PII_TOOL_NAMES = new Set(['search_properties', 'get_property']);

function toolCatalogForRpc() {
  return MCP_TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

function mcpTextResult(id: unknown, payload: unknown, isError = false) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      isError,
    },
  };
}

function mcpError(id: unknown, code: number, message: string) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

async function executeGetDashboardSummary(): Promise<Record<string, unknown>> {
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM api.dashboard_summary`);
  if (!row) {
    throw new Error('dashboard_summary unavailable');
  }
  return {
    property_count: row.property_count ?? row.total_properties ?? null,
    total_properties: row.total_properties ?? row.property_count ?? null,
    distinct_cities: row.distinct_cities ?? null,
    distinct_zips: row.distinct_zips ?? null,
    avg_value: row.avg_value ?? row.avg_market_value ?? null,
    avg_market_value: row.avg_market_value ?? row.avg_value ?? null,
    median_value: row.median_value ?? row.median_market_value ?? null,
    median_market_value: row.median_market_value ?? row.median_value ?? null,
    total_assessed_value: row.total_assessed_value ?? null,
    total_market_value: row.total_market_value ?? null,
    max_market_value: row.max_market_value ?? null,
    median_sqft: row.median_sqft ?? null,
    median_price_per_sqft: row.median_price_per_sqft ?? null,
    with_sqft: row.with_sqft ?? null,
    under_1m: row.under_1m ?? null,
    over_1m: row.over_1m ?? null,
    source_view: 'api.dashboard_summary',
    db_role: 'dashboard_readonly',
    owner_pii: false,
    queried_at: new Date().toISOString(),
  };
}

export async function handleMcpJsonRpc(body: Record<string, unknown>) {
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
    return { jsonrpc: '2.0', id, result: { tools: toolCatalogForRpc() } };
  }

  if (method === 'tools/call') {
    const params = (body.params || {}) as { name?: string; arguments?: Record<string, unknown> };
    const name = params.name;

    if (!name || typeof name !== 'string') {
      return mcpError(id, -32602, 'tools/call requires params.name');
    }

    if (PII_TOOL_NAMES.has(name)) {
      return mcpError(
        id,
        -32001,
        'Owner PII tools are not exposed over MCP. Use authenticated REST /api/properties/* (dashboard_app).',
      );
    }

    if (name === 'get_dashboard_summary') {
      try {
        const summary = await executeGetDashboardSummary();
        return mcpTextResult(id, summary, false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'dashboard_summary failed';
        return mcpError(id, -32000, message);
      }
    }

    return mcpError(
      id,
      -32601,
      `Unknown MCP tool: ${name}. Call tools/list for the read-only catalog.`,
    );
  }

  return mcpError(id, -32601, `Method not found: ${String(method)}`);
}
