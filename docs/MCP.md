# MCP tool catalog (operator)

Jackson County dashboard exposes a small **read-only** Model Context Protocol (JSON-RPC) surface for aggregates. Owner PII is **not** returned over MCP.

## Bind address

| Entry | Default bind | Paths |
|---|---|---|
| `bun run dev` / `bun run start` (`server.ts`) | `0.0.0.0:${PORT}` (`PORT` default **3000**) | `POST /mcp`, `POST /api/mcp` |
| `bun run dev:backend` / `bun run start:backend` (`backend.ts`) | same | same |

Local loopback URL: `http://127.0.0.1:3000/mcp` (or your `PORT`).

## Enable / disable

| Env | Behavior |
|---|---|
| unset / non-production | MCP enabled |
| `ENABLE_MCP=true` | MCP enabled (required in production if you want `/mcp`) |
| `ENABLE_MCP=false` | `POST /mcp` and `POST /api/mcp` return **404** `{ "error": "mcp_disabled" }` |

HTTP auth matches the rest of the dashboard API (`createProtectMiddleware`): session cookie, HTTP Basic (`DASHBOARD_AUTH_*`), or `X-Api-Key` (`API_KEY`). In production those credentials are required.

## Tools

| Tool | `tools/call` | DB role | Owner PII |
|---|---|---|---|
| `get_dashboard_summary` | **yes** — `SELECT * FROM api.dashboard_summary` | `dashboard_readonly` | **no** |

`tools/list` returns only the table above (name, description, `inputSchema`). Catalog metadata in code also records `dbRole` / `ownerPii` for operators reading `src/api/mcp.ts`.

### Not exposed over MCP

| Former / guessed name | Why | Use instead |
|---|---|---|
| `search_properties` | Would return owner name / mailing | `GET /api/properties/search` (`dashboard_app`) |
| `get_property` | Would return owner PII on detail | `GET /api/properties/:id` (`dashboard_app`) |

Calling those names via `tools/call` returns a JSON-RPC error (`-32001`) directing you to REST. There is no MCP gate that turns owner PII on; keep PII on the authenticated product routes.

## Roles reminder

| Role | MCP-relevant grants |
|---|---|
| `dashboard_readonly` | Aggregates including `api.dashboard_summary` (and other non-PII views). **This is the MCP data role.** |
| `dashboard_app` | All `api.dashboard_*` including owner-PII search/detail. Used by REST, **not** by MCP tools. |

The API process usually connects as a user that holds `dashboard_app` (see `docs/DB_CONTRACT.md`). MCP handlers still only SELECT readonly-safe views and never project owner columns.

## Smoke against `jacen_dev`

Prerequisites: Postgres `jacen_dev` with views applied, Bun deps installed.

```bash
cp .env.example .env   # set DATABASE_URL if not using peer-auth default
bun run db:views
bun run dev            # listens on 0.0.0.0:3000
```

**1. List tools**

```bash
curl -sS -X POST "http://127.0.0.1:3000/mcp" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Expect `result.tools` to include `get_dashboard_summary` only (no owner-PII tools).

**2. Call one non-PII aggregate**

```bash
curl -sS -X POST "http://127.0.0.1:3000/mcp" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_dashboard_summary","arguments":{}}}'
```

Expect `result.content[0].text` JSON with `property_count` / value stats, `owner_pii: false`, and `db_role: "dashboard_readonly"`. No `owner_info` / `owner_mailing_address` keys.

If dashboard auth is configured locally, add Basic or API key:

```bash
curl -sS -u "$DASHBOARD_AUTH_USER:$DASHBOARD_AUTH_PASSWORD" -X POST "http://127.0.0.1:3000/mcp" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

curl -sS -X POST "http://127.0.0.1:3000/mcp" \
  -H "content-type: application/json" \
  -H "X-Api-Key: $API_KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_dashboard_summary","arguments":{}}}'
```

Automated coverage: unit suite lists tools and refuses PII names; API integration suite calls `get_dashboard_summary` against `DATABASE_URL` / `jacen_dev`.
