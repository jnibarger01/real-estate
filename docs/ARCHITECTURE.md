# Architecture Decision: Single Production API Service + `api.*` Database Boundary

Status: **Accepted** (M1 of the completion roadmap — see the audit report delivered 2026-08-13)
Supersedes: the current `server.ts` / `backend.ts` split as the production API surface.

## Context

The repository currently ships two independent Express apps that both grew a
`/api/zillow/mcp`-shaped endpoint and a market-insights endpoint, with
different validation, logging, and fallback behavior:

- `server.ts` — the original full-stack dev server (Vite middleware/static
  host + a hand-rolled MCP JSON-RPC endpoint + a real Gemini insights call).
  **Not deployed anywhere** (`render.yaml` does not build or run it). Has no
  request validation on its MCP/insights routes and returns fixture data
  inside a `status: "success"` JSON-RPC envelope for tools that aren't
  RentCast-backed.
- `backend.ts` — the deployed API (`render.yaml` → Render service
  `kc-real-estate-api`). zod-validated, structured JSON logging with request
  IDs, LRU response cache, fails closed (503, no server-side fixture) when
  RentCast isn't configured.

Neither file has ever had database access. As of this decision, `jacen_dev`
has been verified live and its schema is now known well enough to design
against (see "Verified database state" below).

## Verified database state

Confirmed directly against the local `jacen_dev` instance (not independently
re-verified from this repository's tooling — treated as authoritative
operator-supplied evidence):

- PostgreSQL 16.14, PostGIS 3.4.2.
- `core.properties` — property-level table, PK `property_id`, indexes on
  parcel number, ZIP, and land-use.
- `core.parcels.geom` — `MultiPolygon`, SRID 4326, GiST index, all 300,512
  rows have non-null, valid, correctly projected geometry.
- `mart.property_parcels` — materialized view joining property, parcel,
  ownership, and geometry. Broadest canonical property source.
- `mart.residential_properties` — materialized, residential-only subset of
  the above.
- `mart.residential_export` — a **persisted table** (not a materialized
  view) with the same practical shape as `mart.residential_properties`,
  carrying its own PK, GiST, property, and ZIP indexes.

Spatial storage does not need rework: SRID, validity, null-geometry, and
GiST-index prerequisites are already satisfied on both `core.parcels` and
the `mart.*` layer. M3 (curated `api.*` views) is a schema-stability and
query-evidence task, not a GIS rebuild.

**Open question to resolve before or during M3:** `mart.residential_properties`
(materialized view) and `mart.residential_export` (persisted table) appear to
serve overlapping purposes. Recommendation — treat `mart.residential_export`
as the canonical residential-specific source for the API (it's already
persisted with the indexes the API needs, so it isn't subject to
materialized-view refresh-timing gaps), and confirm with the ingestion
process whether `mart.residential_properties` is an intermediate build step
feeding `mart.residential_export` or a redundant parallel path. If it's the
latter, plan to retire one of them during M11 (ingestion pipeline) rather
than carrying two residential marts indefinitely.

## Decision

### 1. Consolidate `server.ts` + `backend.ts` into one production API service

- A single new service (working location: `src/server/app.ts` plus
  `src/server/routes/v1/*`) becomes the only deployed API. It reuses
  `backend.ts`'s conventions as the baseline: zod validation on every route,
  structured JSON logging with request IDs, the CORS allow-list, and
  fail-closed behavior on unconfigured/unreachable dependencies.
- `render.yaml` is updated to build/deploy this consolidated service in
  place of `backend.ts`.
- `server.ts`'s two capabilities that are worth keeping are preserved, but
  not as a second production API:
  - **Vite dev-server hosting** stays as a local-only dev entrypoint
    (`bun run dev`), not something deployed.
  - **Real Gemini market-insights call** moves into the consolidated
    service as `POST /api/market-insights`, validated the same way
    `backend.ts`'s deterministic version already is, keeping the existing
    "deterministic fallback when `GEMINI_API_KEY` is absent" behavior.
- `server.ts`'s hand-rolled MCP JSON-RPC endpoint is retired outright, not
  ported — it's replaced by the real MCP server built in M10, on the
  official `@modelcontextprotocol/sdk`, using the same query/repository
  layer as the REST routes so the two interfaces cannot drift the way
  `server.ts`/`backend.ts` did.

### 2. Database boundary: `raw.* → core.* → mart.* → api.* views → API`

- The API's connection pool uses a **read-only Postgres role** and queries
  **only `api.*` views** — never `core.*`, `mart.*`, or `raw.*` directly.
  This keeps the API decoupled from materialized-view implementation
  details (refresh cadence, internal column naming) and gives a stable
  contract to evolve `core`/`mart` behind.
- `api.*` views are thin — selecting/renaming/casting from the marts, not
  reimplementing joins:
  - `api.properties` → `mart.property_parcels` (broad canonical source;
    property + parcel + ownership + geometry already joined there).
  - `api.residential_properties` → `mart.residential_export` (pending
    resolution of the open question above).
  - Spatial-search views (`api.parcels_near`, etc., named during M6) wrap
    `core.parcels.geom`/the mart geometry columns directly — no need to
    duplicate geometry into a new layer, since GiST indexes already exist
    where needed.
- `raw.*` is never exposed to the API layer under any circumstance,
  including through a view — it exists only for the ingestion pipeline
  (M11) to stage against.

## Consequences

- M2 (Postgres connection layer) and M3 (curated `api.*` views) can now be
  scoped precisely against real column names/types instead of the
  Phase-4-generic filter list in the original audit — a follow-up pass
  should confirm exact `core.properties`/`core.parcels`/`mart.*` column
  names before M3's view SQL is written.
- M4 onward (REST endpoints, spatial endpoints, MCP server) build directly
  on `api.*` views; no milestone needs to touch `core`/`mart` again except
  M11 (ingestion) and the open-question resolution above.
- `server.ts` is deleted once M10 (real MCP server) ships and its
  Gemini/dev-server responsibilities have landed in the consolidated
  service — tracked as part of M10's acceptance criteria, not before.

## Non-decisions (explicitly out of scope for M1)

- Exact `api.*` view SQL — M3.
- Auth/role design details beyond "read-only DB role for the API" — M8.
- Managed cloud Postgres provider selection — M12, unaffected by this
  document.
