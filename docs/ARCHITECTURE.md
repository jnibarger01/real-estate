# KC Real Estate Market Explorer — Architecture Decision & Target Consolidation Plan (M1)

## Executive Summary

This document defines the target system architecture for the Kansas City Real Estate Market Explorer repository (`jnibarger01/real-estate`), establishing the database layer boundaries, server consolidation strategy, API contracts, and integration patterns required for Milestone 1 (M1).

### Key Architectural Decisions
1. **Single Production API Service**: Retire the divergent dual-server setup (`server.ts` and `backend.ts`) into a single, modular Express/Node.js TypeScript API service.
2. **Preserve Best-of-Both Behaviors**: Adopt `backend.ts` production hardening (Zod validation, structured logging, restrictive CORS, rate limiting, fail-closed provider error handling) while preserving `server.ts` local Vite development middleware and real Gemini 3.6 Flash market analysis.
3. **Strict 4-Tier Database Boundary (`raw` → `core` → `mart` → `api`)**: Decouple application code from underlying database tables. Public API queries will target thin, application-facing `api.*` views layered over curated `mart.*` structures (`mart.property_parcels` and `mart.residential_properties`), completely isolating application contracts from `raw.*` and `core.*` refactoring.
4. **Official MCP Integration**: Replace legacy hand-written MCP transport handlers with the official `@modelcontextprotocol/sdk` and eliminate mock/fixture data being presented as successful live MCP execution.

---

## 1. Current-State Architecture & Dual-Server Audit

The codebase currently contains a split frontend/backend setup, with a static React/Vite frontend designed for GitHub Pages deployment (`https://jnibarger01/github.io/real-estate/`) and an Express backend server.

```
[ Current Repository Server Split ]

        Local Dev (server.ts)                  Production Render (backend.ts)
  ┌──────────────────────────────┐          ┌──────────────────────────────┐
  │ • Express + Vite middleware  │          │ • Express standalone server  │
  │ • Hand-written MCP JSON-RPC  │   VS.    │ • Zod input validation       │
  │ • Mock fixture-as-success    │          │ • Request ID / JSON logging  │
  │ • Gemini market insights     │          │ • Restrictive CORS & limits │
  │ • No PostgreSQL integration  │          │ • RentCast API proxy         │
  └──────────────────────────────┘          └──────────────────────────────┘
```

### Analysis of Dual-Server Divergence

| Feature / Behavior | `server.ts` (Legacy / Local Dev) | `backend.ts` (Render Deploy Target) | Target Consolidated State |
| :--- | :--- | :--- | :--- |
| **Primary Entrypoint** | Root `server.ts` (`bun run dev`) | Deployed on Render PaaS | Consolidated `src/api/server.ts` |
| **Vite Middleware** | Integrated via `createViteServer` | Not included (static build) | Retained for local development mode |
| **Input Validation** | Ad-hoc / minimal | Zod schema validation | **Retained from `backend.ts` (Zod)** |
| **Logging & Tracing** | Standard `console.log` | Structured JSON logging with request IDs | **Retained from `backend.ts`** |
| **CORS & Rate Limiting** | Unrestricted / missing | Restrictive origin allowlist & rate limits | **Retained from `backend.ts`** |
| **Gemini AI Insights** | Real Gemini 3.6 Flash integration | Not integrated | **Retained from `server.ts`** |
| **MCP Protocol** | Hand-written JSON-RPC dispatcher | Not integrated | **Replaced with `@modelcontextprotocol/sdk`** |
| **Fixture Spoofing** | Returns mock success on MCP calls | Fail-closed error handling | **Eliminated (Fail-closed required)** |
| **External Providers** | None (local mocks) | RentCast provider proxy | Integrated via provider adapter layer |
| **Database Connection** | None | None | PostgreSQL connection via `pg` / `Kysely` |

### Critical Problems with Current Dual-Server Setup
1. **Divergent API Behavior**: Local testing on `server.ts` does not exercise the validation, rate-limiting, CORS, or security controls enforced by `backend.ts` in production.
2. **Fixture-as-Success Anti-Pattern**: In `server.ts`, MCP tool calls return synthetic mock responses labeled as successful live executions. This hides provider failures and prevents clients from detecting missing data.
3. **No Database Layer**: Neither server currently connects to PostgreSQL, forcing the frontend to rely entirely on in-memory JSON fixtures or client-side mocks.

---

## 2. Verified Database Architecture (`jacen_dev`)

Local inspection of the production PostgreSQL 16.14 database (`jacen_dev`) with PostGIS 3.4.2 established the following verified schema and spatial facts:

```
                  [ Verified Database Architecture (jacen_dev) ]

  ┌────────────────────────┐         ┌────────────────────────────────────────┐
  │      raw.parcels       │         │            raw.assessments             │
  │     (311,110 rows)     │         │             (300,626 rows)             │
  └───────────┬────────────┘         └───────────────────┬────────────────────┘
              │                                          │
              ▼                                          ▼
  ┌────────────────────────┐    ┌─────────────────────────────────────────────┐
  │      core.parcels      │◄───┤           core.parcel_properties            │
  │     (300,512 rows)     │    │                (291,994 rows)               │
  │ MultiPolygon SRID 4326 │    └──────────────────────┬──────────────────────┘
  │ GiST: core_parcels_geom│                           │
  └────────────────────────┘                           ▼
                                     ┌────────────────────────────────────────┐
                                     │            core.properties             │
                                     │             (300,626 rows)             │
                                     └─────────────────┬──────────────────────┘
                                                       │
                                                       ▼
                                     ┌────────────────────────────────────────┐
                                     │         mart.property_parcels          │
                                     │       (Materialized Join: ~291k)       │
                                     └─────────────────┬──────────────────────┘
                                                       │
                                                       ▼
                                     ┌────────────────────────────────────────┐
                                     │      mart.residential_properties       │
                                     │       (Materialized View: 233,174)     │
                                     └─────────────────┬──────────────────────┘
                                                       │
                                                       ▼
                                     ┌────────────────────────────────────────┐
                                     │       mart.residential_export          │
                                     │       (Persisted Table: 233,174)       │
                                     └────────────────────────────────────────┘
```

### Verified Schema Facts
* **PostgreSQL Version**: 16.14
* **PostGIS Version**: 3.4.2
* **Schemas Present**: `raw`, `core`, `mart`, `public`, `export` / `residential_export`
* **`raw.parcels`**: 311,110 rows (Jackson County GIS raw ingest).
* **`raw.assessments`**: 300,626 rows (Jackson County assessor raw ingest).
* **`core.parcels`**: 300,512 rows. Column `geom` is `geometry(MultiPolygon, 4326)` with spatial index `core_parcels_geom_gix` (GiST).
  * **Geometry Quality Verification (300,512 rows checked)**:
    * `NULL` geometries: **0**
    * Invalid geometries: **0**
    * Wrong SRID (non-4326): **0**
* **`core.properties`**: 300,626 rows (`property_id` PK, indexes on parcel number, ZIP code, land use).
* **`core.parcel_properties`**: 291,994 rows (join table resolving many-to-many / 1-to-1 relationship between parcels and property records).
* **`mart.property_parcels`**: Materialized join across `core.parcel_properties`, `core.parcels`, and `core.properties` (~291,464 rows).
* **`mart.residential_properties`**: Residential-filtered materialized view over `mart.property_parcels` (233,174 rows).
* **`mart.residential_export`**: Persisted table holding 233,174 residential records with composite PK `(parcel_id, property_id)` and GiST spatial index on `geom`.

---

## 3. Data-Layer Boundaries & Flow (`raw` → `core` → `mart` → `api`)

To ensure long-term database stability, clean separation of concerns, and maintainable application code, data access will strictly adhere to a 4-tier flow:

```
  [ Jackson County Ingest ]
             │
             ▼
      ┌─────────────┐
      │    raw.*    │   Ingestion Landing Zone (untyped, unindexed strings)
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │   core.*    │   Normalized Relational Entities (FKs, validated geometry, SRID 4326)
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │   mart.*    │   Domain Materialized Views (mart.property_parcels, mart.residential_properties)
      └──────┬──────┘
             │
             ▼
      ┌─────────────┐
      │    api.*    │   Thin Application-Facing Views (Stable API Contract)
      └──────┬──────┘
             │
             ▼
  [ Consolidated API Service ]  ──►  REST /api/v1/* & MCP Tool Endpoints
```

### Layer Definitions & Responsibilities

1. **`raw.*` (Raw Ingestion)**:
   * Contains exact un-transformed tabular dumps from Jackson County GIS and tax assessor data sources.
   * *Rule*: Strictly forbidden from application query access.
2. **`core.*` (Relational Core)**:
   * Normalized entity tables (`parcels`, `properties`, `parcel_properties`).
   * Validated geometries, proper PostgreSQL types, primary keys, and spatial GiST indexes.
   * *Rule*: Internal database tier. Application queries should avoid hitting `core.*` directly to prevent complex multi-table joins on every HTTP request.
3. **`mart.*` (Domain Data Marts)**:
   * Denormalized, high-performance materialized views and tables.
   * **`mart.property_parcels`**: Canonical broad property dataset combining geometry, parcel metadata, ownership, and building details.
   * **`mart.residential_properties`**: Curated materialized subset filtered specifically for residential single-family and multi-family workflows.
   * *Rule*: Analytical and reporting data source. Serves as the foundation for `api.*` views.
4. **`api.*` (Application Database Boundary — M3 Target)**:
   * Thin database views created explicitly for application consumption (e.g. `api.v1_properties`, `api.v1_market_summary`, `api.v1_map_features`).
   * **Why `api.*` is the required application boundary**:
     * Decouples frontend and REST contracts from internal database refactoring in `core` or `mart`.
     * Allows renaming, re-indexing, or re-materializing underlying tables without breaking the public REST or MCP endpoints.
     * Enforces column-level security and explicit attribute naming suited for JSON serialization.

---

## 4. Consolidated Target Architecture

The target architecture replaces the dual-server split with a single Express/Node.js TypeScript API service hosting REST endpoints, an official MCP protocol handler, and external provider integration.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TARGET ARCHITECTURE                                    │
│                                                                                        │
│   ┌────────────────────────┐      ┌────────────────────────┐    ┌──────────────────┐   │
│   │  React/Vite Frontend   │      │   Claude / AI Agents   │    │  External Apps   │   │
│   │  (GitHub Pages / App)  │      │   (MCP Clients)        │    │  (HTTP Clients)  │   │
│   └───────────┬────────────┘      └───────────┬────────────┘    └────────┬─────────┘   │
│               │                               │                          │             │
│               │ HTTP REST                     │ JSON-RPC                 │ HTTP REST   │
│               ▼                               ▼                          ▼             │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                     Unified Express API Service (src/api)                         │  │
│  │                                                                                  │  │
│  │   Middleware: Restrictive CORS | Zod Validation | Rate Limiter | Structured Logs │  │
│  │                                                                                  │  │
│  │   ┌───────────────────────┐  ┌────────────────────────┐  ┌───────────────────┐   │  │
│  │   │  REST Routes          │  │  MCP SDK Transport     │  │  External Proxy   │   │  │
│  │   │  /api/v1/properties   │  │  /mcp or /api/mcp      │  │  RentCast Adapter │   │  │
│  │   │  /api/v1/summary      │  │  (@modelcontextprotocol│  │  Gemini 3.6 Flash │   │  │
│  │   │  /api/v1/trends       │  │   /sdk)                │  │  Insights         │   │  │
│  │   └───────────┬───────────┘  └───────────┬────────────┘  └─────────┬─────────┘   │  │
│  └───────────────┼──────────────────────────┼─────────────────────────┼─────────────┘  │
│                  │                          │                         │                │
│                  ▼                          ▼                         │                │
│  ┌───────────────────────────────────────────────────────┐            │                │
│  │             Database Query Layer (pg / Kysely)        │            │                │
│  └───────────────────────────┬───────────────────────────┘            │                │
│                              │                                        │                │
│                              ▼                                        ▼                │
│  ┌───────────────────────────────────────────────────────┐   ┌─────────────────┐       │
│  │          PostgreSQL 16 / PostGIS 3.4 (jacen_dev)      │   │ External APIs   │       │
│  │          Views: api.v1_properties, etc.               │   │ RentCast        │       │
│  └───────────────────────────────────────────────────────┘   │ Gemini API      │       │
│                                                              └─────────────────┘       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **REST API (`/api/v1/*`)**:
   * Standardized REST endpoints returning JSON responses for properties, spatial bounds searches, market statistics, and time-series trends.
   * All queries execute against `api.*` database views.
2. **MCP Protocol Transport (`/mcp` or `/api/mcp`)**:
   * Built using `@modelcontextprotocol/sdk`.
   * Exposes tools (`search_properties`, `get_property`, `get_market_summary`, `get_map_data`) directly over the unified API.
   * **Fail-Closed Policy**: If a tool query fails or data is unavailable, returns a structured error object. Mock fixture data will never be returned as successful live MCP output.
3. **External Provider & AI Aggregation**:
   * **RentCast Adapter**: Encapsulates external RentCast MLS/property calls.
   * **Gemini 3.6 Flash Insights**: `/api/market-insights` receives structured data from `api.v1_market_summary` or search parameters and generates AI market analysis using `@google/genai`.
4. **Runtime Security & Reliability Controls**:
   * **Zod Schemas**: Every route validates path parameters, query parameters, and request bodies.
   * **Request Tracing**: Middleware assigns a unique correlation ID (`x-request-id`) to every incoming request and logs structured JSON logs.
   * **Rate Limiting & Body Limits**: Configurable max request limits per window and max request payload sizes.
   * **CORS Allowlist**: Configurable via environment variable (`CORS_ORIGINS`), defaulting to restrictive origins in production.

---

## 5. Local Development vs Production Deployment Architecture

```
[ Local Development Workflow ]               [ Production Deployment (Render / PaaS) ]

   bun run dev                                 Render PaaS / Web Service
       │                                           │
       ▼                                           ▼
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ Express Server (src/api)     │            │ Standalone Express API       │
│  ├─ Vite Dev Middleware      │            │  ├─ Serves static dist/      │
│  ├─ REST /api/v1/*           │            │  ├─ REST /api/v1/*           │
│  ├─ MCP Transport            │            │  ├─ MCP Transport            │
│  └─ Gemini Market Insights   │            │  └─ Gemini Market Insights   │
└──────────────┬───────────────┘            └──────────────┬───────────────┘
               │                                           │
               ▼                                           ▼
   PostgreSQL (jacen_dev)                       Managed PostgreSQL
```

### Local Development Architecture
* **Single Process Command**: `bun run dev` (or `npm run dev`) launches `src/api/server.ts`.
* **Vite Integration**: In non-production mode (`NODE_ENV !== 'production'`), Express attaches Vite middleware (`createViteServer`), enabling Instant HMR for React components alongside live API endpoints on `http://localhost:3000`.
* **Database Target**: Connects to local PostgreSQL instance `jacen_dev` via `DATABASE_URL`.

### Production Deployment Architecture (Render / PaaS)
* **Build Step**: `bun run build` compiles the React frontend to `dist/` and bundles the Express API service using `esbuild` to `dist/server.js`.
* **Execution**: `node dist/server.js` serves static `dist/` files for SPA requests and handles `/api/v1/*`, `/mcp`, and `/api/market-insights`.
* **GitHub Pages Compatibility**: The static GitHub Pages build (`https://jnibarger01.github.io/real-estate/`) sets `VITE_API_BASE_URL` to point to the production API host for live data requests while retaining browser-side fixture fallbacks if unconfigured.

---

## 6. Server Retirement & Consolidation Strategy

To eliminate code duplication, maintenance overhead, and security drift between `server.ts` and `backend.ts`, the repository will execute the following consolidation plan:

```
                  [ Consolidation Strategy ]

   server.ts (Legacy Root)               backend.ts (Render Target)
   • Local Vite middleware               • Zod validation
   • Gemini market-insights              • Structured logging
   • Hand-written MCP                    • CORS & rate limits
             │                                     │
             └──────────────────┬──────────────────┘
                                │
                                ▼
                   ┌─────────────────────────┐
                   │   src/api/server.ts     │  <-- Single Canonical API
                   └─────────────────────────┘
```

### Step-by-Step Retirement Plan

1. **Directory Restructuring**:
   * Create `src/api/` as the single canonical location for backend code:
     * `src/api/server.ts`: Server initialization, Express setup, middleware registration.
     * `src/api/middleware/`: CORS, Zod validation, rate limiter, request ID logging.
     * `src/api/routes/`: REST v1 routes (`properties.ts`, `analytics.ts`, `insights.ts`).
     * `src/api/mcp/`: Official `@modelcontextprotocol/sdk` transport setup.
     * `src/api/providers/`: RentCast and Gemini service adapters.
     * `src/api/db/`: Database connection pool and query helpers.
2. **Merge Feature Set**:
   * Migrate `backend.ts` Zod validation, structured logging, CORS allowlist, and rate limiting into `src/api/middleware/`.
   * Migrate `server.ts` Gemini `/api/market-insights` endpoint into `src/api/routes/insights.ts`.
   * Migrate `server.ts` Vite middleware setup into `src/api/server.ts` (wrapped in `if (process.env.NODE_ENV !== 'production')`).
3. **Replace Hand-Written MCP**:
   * Replace `server.ts` `handleMcpJsonRpc` with official `@modelcontextprotocol/sdk` server instance connected to Express HTTP/SSE transport.
   * Remove all hardcoded mock responses from MCP tool handlers.
4. **Deprecate & Remove Legacy Files**:
   * Delete root `server.ts` and `backend.ts`.
   * Update `package.json` scripts: `"dev": "tsx src/api/server.ts"`, `"start": "node dist/server.js"`.
   * Update `render.yaml` or Render build commands to point exclusively to `src/api/server.ts`.

---

## 7. Ordered M2 / M3 Prerequisites Roadmap

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │  MILESTONE 1 (Current): Architecture Decision & Consolidation Plan     │
  │  • Deliverable: docs/ARCHITECTURE.md                                  │
  │  • Constraint: Documentation only; no DB or code changes              │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │  MILESTONE 2: Single API Service & Database Connection Layer          │
  │  • Consolidated src/api service structure                               │
  │  • Database driver selection (pg + Kysely or Drizzle)                  │
  │  • DATABASE_URL configuration & connection pool initialization         │
  │  • GET /api/v1/health endpoint verifying PostgreSQL connectivity       │
  │  • Zod middleware & structured logging implementation                  │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
                                      ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │  MILESTONE 3: Database Views & Public API Contract                     │
  │  • Create thin api.* views over mart.property_parcels & residential   │
  │  • Implement REST /api/v1/properties, /summary, /trends endpoints      │
  │  • Official @modelcontextprotocol/sdk integration                      │
  │  • Migrate PropertySearchService frontend client to REST /api/v1/*      │
  │  • Remove legacy mock fixture return from live MCP handlers            │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Risks and Unresolved Decisions

1. **Database Connection Pooling on PaaS (Render)**:
   * *Risk*: Free or standard PaaS hosting (Render) combined with serverless/container restarts can exhaust PostgreSQL connection limits if pooling is unmanaged.
   * *Mitigation*: Configure `pg.Pool` with explicit max connection limits (`max: 10`, `idleTimeoutMillis: 30000`) in `src/api/db/pool.ts`.
2. **Materialized View Refresh Overhead**:
   * *Risk*: `mart.property_parcels` and `mart.residential_properties` are materialized views. Querying stale materialized views avoids join cost but requires a refresh strategy when new raw ingest data arrives.
   * *Decision Needed*: Determine whether `REFRESH MATERIALIZED VIEW CONCURRENTLY` should run via scheduled background cron or post-ingest database function.
3. **Static GitHub Pages CORS Policy**:
   * *Risk*: When the frontend is hosted on `https://jnibarger01.github.io`, browser cross-origin requests to the Render API will fail unless CORS is explicitly configured with `CORS_ORIGINS=https://jnibarger01.github.io`.
   * *Mitigation*: Ensure `CORS_ORIGINS` environment variable is documented and passed in deployment manifests.
4. **Gemini & RentCast API Rate Limits**:
   * *Risk*: Upstream rate limits or quota depletion on Gemini 3.6 Flash or RentCast can cause API errors.
   * *Mitigation*: Provider adapters must fail closed gracefully, logging upstream status codes without crashing the Express process, and returning clear 502/503 HTTP status codes to clients.
