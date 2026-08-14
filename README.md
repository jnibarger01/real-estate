# Jackson County Property Intelligence

## Overview

Jackson County Property Intelligence is a dashboard **web app sitting on top of an API** — the browser never talks to Postgres directly. It combines KPI cards, value/sales-style trend charts, a property-type mix, a MapLibre parcel map, and a drill-down property explorer over the Jackson County GIS + assessor dataset (233k+ residential parcels).

```text
PostgreSQL / PostGIS (jacen_dev)
        │
        ▼
   Express API  (/api/dashboard/*, /api/properties/search, /api/map/*)
        │
        ▼
   React + TypeScript + Vite dashboard
        ├── KPI cards        (properties, avg/total value, YoY change)
        ├── Charts           (Recharts: trend, distribution, type mix)
        ├── Map              (MapLibre GL: bbox parcel queries, click to inspect)
        └── Explorer table   (TanStack Table: search, sort, detail drawer)
```

**Postgres remains the source of truth; the API defines application access; the dashboard is the visualization layer.**

## Architecture

### Database (`raw → core → mart → api`)

* `raw.*` — untyped ingestion landing zone (forbidden to application queries)
* `core.*` — normalized entities (parcels, properties, parcel_properties)
* `mart.*` — domain materialized views (`mart.property_parcels`, `mart.residential_properties`)
* `api.*` — **application-facing views** the dashboard reads

The dashboard contract lives in `api.dashboard_*` views (see `db/dashboard_views.sql`):

| View | Purpose |
| :--- | :--- |
| `api.dashboard_summary_mv` | Global KPIs (counts, avg/median/total value, sqft, ppSF) — *materialized* |
| `api.dashboard_value_distribution` | Parcel count by value bucket (histogram) |
| `api.dashboard_value_trends_mv` | 5-year avg market value series (from `raw.assessments` history) — *materialized* |
| `api.dashboard_property_types` | Land-use type mix with avg/median value |
| `api.dashboard_property_search` | Explorer list with living area + centroid coords |
| `api.dashboard_map_properties` | Parcel geometry + value for bbox map queries |

The two heavy aggregations are materialized and refreshed after each ingest via `db/refresh_materialized.sh`.

### API

The Express server exposes a small, reusable surface. Any other application (Hermes, ACS agents, mobile apps, MCP tools) can consume the same data layer:

```http
GET /api/health                          DB connectivity probe
GET /api/dashboard/summary               KPI row + YoY value change
GET /api/dashboard/value-distribution    Histogram buckets
GET /api/dashboard/sales-trends          5-year market value series
GET /api/dashboard/property-types        Land-use type mix
GET /api/properties/search?q=&city=&minValue=&maxValue=&minBeds=&minSqft=&limit=&offset=
GET /api/map/properties?bbox=minLng,minLat,maxLng,maxLat    GeoJSON parcels
GET /api/map/summary?bbox=...            Aggregate counts for the visible viewport
```

Input is validated with Zod; errors return structured JSON (`400 validation_error`, `500 internal_error`). Requests are parameterized — no string interpolation of user input into SQL.

## Tech Stack

- React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- TanStack Query (data fetching), TanStack Table (explorer), MapLibre GL JS (map)
- Recharts (charts), shadcn-style UI components (`src/components/ui`)
- Express + `pg` + Zod + PostGIS on the server

## Local Development

Requirements: Bun, a current Node.js-compatible runtime, and the `jacen_dev` Postgres database (local peer auth over the Unix socket).

```bash
bun install --frozen-lockfile
# Database views (one-time, or idempotent re-runs):
psql "postgresql://jacen@/jacen_dev?host=/var/run/postgresql" -f db/dashboard_views.sql
psql "postgresql://jacen@/jacen_dev?host=/var/run/postgresql" -f db/dashboard_views_materialized.sql
bun run dev
```

The Express server hosts Vite middleware in development at `http://localhost:3000`.

Validation and builds:

```bash
bun run lint
bun run build
bun run build:pages
```

Copy `.env.example` to `.env` and set `DATABASE_URL` for non-default database targets. Never commit `.env` files.

## Static Demo vs Live Backend

The GitHub Pages build (`build:pages`) is static and does not serve the API — the dashboard needs a live backend to respond on the `/api/*` routes. The legacy "Market Explorer" fixture demo remains in `src/App.tsx` for reference.

## Data Limitations

- Market values are from Jackson County assessor records, not appraisals, offers, or professional real-estate advice.
- Historical value series are derived from assessor tax-year payloads, not verified sales transactions.
- No sales transaction data is currently present; the "sales-trends" endpoint serves the neighboring value series.
- Public map tile availability depends on third-party services and their usage policies.

## Privacy / Secrets

- Keep `DATABASE_URL` and API credentials in the backend environment only.
- Never put database URLs or keys in frontend code or `VITE_*` variables.
- `.env*` files are ignored except for the placeholder `.env.example`.
