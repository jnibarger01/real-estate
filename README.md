# Jackson County Property Intelligence

Canonical product: a Jackson County assessor dashboard over Postgres/PostGIS.

Authenticated product (owner PII):

```text
browser
        │
        ▼
same-origin SPA + API   (`bun run build && bun run start`)
        │
        ▼
createApp() + Postgres/PostGIS + api.dashboard_*
```

GitHub Pages is a public static shell only. It must not carry `VITE_API_KEY` and is not an authenticated PII deployment.
   ├── /api/dashboard/*
   ├── /api/properties/*
   ├── /api/map/*
   ├── /api/health
   ├── /mcp
   └── /api/provider/*   ← RentCast, secondary
        │
        ▼
Postgres/PostGIS
api.dashboard_*
```

`src/main.tsx` mounts `DashboardApp` only. `server.ts` and `backend.ts` both start `createApp()`. RentCast is not the production data path.

Public frontend: <https://jnibarger01.github.io/real-estate/>

## Local development

Requirements: Bun, Node.js, and PostgreSQL 16 with PostGIS (`jacen_dev`).

```bash
bun install --frozen-lockfile
cp .env.example .env
# set DATABASE_URL if you are not using the local peer-auth default
bun run db:views          # apply sql/api_dashboard_views.sql
bun run lint
bun run test
bun run dev               # Express + Vite + dashboard API on :3000
```

`bun run dev:backend` starts the same `createApp()` without Vite. It requires a reachable database and `api.dashboard_*` views.

## Database contract

The running API reads **only** `api.dashboard_*` (plus `api.ingest_state`).

```bash
psql -d jacen_dev -v ON_ERROR_STOP=1 -f sql/api_dashboard_views.sql
# or
bin/create-dashboard-contract.sh
```

A clean database that already has `raw.*` / `core.*` / `mart.residential_properties` reaches API-ready state from that script alone. `tests/fixtures/minimal.sql` plus the same views is the CI path.

Owner PII lives on `api.dashboard_property_search` and `api.dashboard_property_detail`. Those views are granted to role `dashboard_app`, not `PUBLIC`. Non-PII aggregates are also granted to `dashboard_readonly`.

After a new ingest:

```bash
db/refresh_materialized.sh
```

That refreshes `mart.residential_properties` and stamps `api.ingest_state`.

See `docs/DB_CONTRACT.md` and `docs/ARCHITECTURE.md`.

## Environment

Production (`NODE_ENV=production`) **will not start** unless dashboard auth is configured:

```dotenv
DATABASE_URL="postgresql://..."
DASHBOARD_AUTH_USER="..."
DASHBOARD_AUTH_PASSWORD="..."
# or
API_KEY="..."

ALLOWED_ORIGINS="https://jnibarger01.github.io"
```

`RENTCAST_API_KEY` is optional and only used by `/api/provider/*`. Never create `VITE_RENTCAST_API_KEY`.

Do **not** set `VITE_API_KEY` for GitHub Pages. A key in that bundle is public.

Authenticated deploy: `bun run build && bun run start` so HTTP Basic covers HTML and `/api` on one origin.

## Health and routes

| Path | Auth | Purpose |
|---|---|---|
| `GET /api/health`, `/health`, `/healthz` | public | process + Postgres + PostGIS + `api.dashboard_*` readiness |
| `GET /api/dashboard/*` | required in production | KPIs, distributions, types |
| `GET /api/properties/*` | required in production | search/detail including owner PII |
| `GET /api/map/*` | required in production | bbox GeoJSON |
| `POST /mcp`, `POST /api/mcp` | same protect as `/api` | JSON-RPC; `tools/call` is not mocked |
| `GET /api/provider/*` | required except `/provider/status` | optional RentCast |

Failures stay failures. MCP `tools/call` returns a JSON-RPC error. The explorer client (`ZillowMcpClient`) never converts abort/network/provider errors into `success: true`. Fixtures run only when `VITE_ALLOW_FIXTURE_ADAPTER=true` in a Vite dev build.

## Render

`render.yaml` deploys `backend.ts` (`createApp()`, no Vite). Set `DATABASE_URL`, `DASHBOARD_AUTH_USER`, `DASHBOARD_AUTH_PASSWORD`, and `ALLOWED_ORIGINS`. Confirm `/api/health` reports `queryReadiness.ok: true` before pointing Pages at the service.

## GitHub Pages

Pages is not the authenticated product. The workflow may inject a public `VITE_API_BASE_URL` and **never** injects `VITE_API_KEY`. The UI states that owner records are only available on the same-origin API deploy. Compiled Pages output is rejected if it contains `VITE_API_KEY`.

## Tests

```bash
bun run test:unit          # auth, MCP fail-closed, provider, search
bun run test               # unit + API integration against DATABASE_URL
bun run test:e2e           # Playwright against the production same-origin binary
```

CI applies `tests/fixtures/minimal.sql` + `sql/api_dashboard_views.sql`, runs those suites, builds the production binary, smoke-starts it with auth required, and runs the browser suite.
