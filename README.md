# KC Real Estate Market Explorer

## Overview

KC Real Estate Market Explorer is a responsive React application for exploring Kansas City metro housing data. The frontend is designed to remain on GitHub Pages while an optional HTTPS backend supplies live/provider-backed property data.

Public frontend: <https://jnibarger01.github.io/real-estate/>

## Architecture

```text
GitHub Pages
React / Vite frontend
        |
        | HTTPS via VITE_API_BASE_URL
        v
Standalone Express API (backend.ts)
        |
        | server-side X-Api-Key
        v
RentCast API
  ├─ active sale listings
  ├─ public-record property/sale data
  └─ ZIP-level market statistics
```

If no external API URL is configured, the Pages build continues to use the local fixture adapter. Provider credentials never need to exist in GitHub Pages or browser JavaScript.

## Features

- Kansas City metro search by city/state or ZIP code
- Price, status, property-type, bedroom, bathroom, size, and feature filters
- Leaflet maps with clustering and multiple basemaps
- Property details and local comparable-property scoring
- KPI summaries and browser-side analytics
- Deterministic market analysis when AI is not configured
- Live provider mode through a separately hosted backend
- Automatic fixture fallback when the backend is unavailable

## Live Data Provider

The initial live adapter uses RentCast.

Implemented capabilities:

- active for-sale listings via `/v1/listings/sale`;
- recent public-record sales via `/v1/properties` and `saleDateRange`;
- property-record lookup by provider ID;
- ZIP-level market statistics via `/v1/markets`;
- provider-side filtering for common price/property attributes;
- five-minute backend response caching by default; and
- explicit source attribution on normalized records.

Current limitations:

- RentCast exposes `Active` and `Inactive` sale-listing status rather than a distinct pending status, so the first adapter does not claim to provide verified pending listings.
- Listing photos are not assumed to be available. The UI uses a neutral “No listing photo supplied” placeholder rather than inventing a property photo.
- AVM/value estimates are not enabled yet. Missing estimates remain missing instead of being synthesized from listing price.
- This integration is not a direct Heartland MLS feed. A licensed MLS/RESO Web API adapter can be added behind the same backend later.

## Local Development

Requirements: Bun and a current Node.js runtime.

Install dependencies:

```bash
bun install --frozen-lockfile
```

Run the original full-stack development server:

```bash
bun run dev
```

Run only the standalone live-data backend:

```bash
cp .env.example .env
# Add RENTCAST_API_KEY to .env
bun run dev:backend
```

Build/verify:

```bash
bun run lint
bun run build
bun run build:backend
bun run build:pages
```

## Backend Environment

```dotenv
RENTCAST_API_KEY="..."
ALLOWED_ORIGINS="https://jnibarger01.github.io"
PROVIDER_CACHE_TTL_MS="300000"
```

`RENTCAST_API_KEY` is a backend-only secret. Do not create a `VITE_RENTCAST_API_KEY` variable and do not put the key in GitHub Pages settings.

## Render Deployment

`render.yaml` defines a standalone Node web service named `kc-real-estate-api`.

On the first Render Blueprint deployment:

1. connect this repository;
2. create the service from `render.yaml`;
3. provide `RENTCAST_API_KEY` when Render prompts for the `sync: false` variable;
4. wait for `/healthz` to report `providerConfigured: true`; and
5. copy the service's final HTTPS URL.

The backend binds to Render's `PORT` on `0.0.0.0` and exposes:

- `GET /healthz`
- `GET /api/provider/status`
- `POST /api/zillow/mcp` — legacy frontend compatibility path backed by the live provider
- `POST /api/market-insights` — deterministic insight response for the current result set

## Connect GitHub Pages to the Backend

After the backend is deployed, create this **GitHub repository Actions variable**:

```text
KC_REAL_ESTATE_API_BASE_URL=https://your-backend.example.com
```

Do not make it a secret; the public backend URL is intentionally shipped to the browser.

`.github/workflows/deploy-pages.yml` passes that value into the Pages build as `VITE_API_BASE_URL`. `src/config/runtime.ts` then switches the Pages bundle from local static mode to the external HTTPS API.

If the variable is empty, Pages remains in fixture mode.

## GitHub Pages Deployment

`.github/workflows/deploy-pages.yml` runs on pushes to `main` and manual dispatch. It:

- installs from `bun.lock`;
- typechecks;
- builds the frontend with `/real-estate/` as its Vite base;
- injects only the public API base URL;
- rejects server-secret markers in compiled output; and
- deploys through the official GitHub Pages Actions flow.

`.github/workflows/ci.yml` additionally validates pull requests by typechecking and building both the standalone backend and Pages frontend.

## Data Flow and Fallback

Live mode:

```text
Browser search
  -> GitHub Pages JavaScript
  -> HTTPS POST /api/zillow/mcp
  -> backend cache
  -> RentCast API
  -> normalized Property[]
  -> browser analytics/comparables/map
```

Failure mode:

```text
Backend unavailable / provider key missing / provider error
  -> client request fails
  -> existing local fixture adapter is used
```

The fallback keeps the application usable, but the UI should be checked for the data-source badge before treating records as live.

## Security

- `RENTCAST_API_KEY` stays on the backend only.
- CORS allows the GitHub Pages origin and local development origins by default.
- Additional origins must be explicitly configured with `ALLOWED_ORIGINS`.
- The backend disables the Express `X-Powered-By` header and limits JSON request bodies.
- Compiled Pages output is scanned for secret-variable markers in CI and deployment workflows.
- `.env*` files remain ignored except for `.env.example`.

## Existing Full-Stack Integrations

The repository still retains `server.ts`, the optional Zillow MCP proxy path, and optional server-side Gemini integration. The new `backend.ts` does not remove those capabilities; it provides a smaller deployable API specifically for the GitHub Pages architecture.

## Data Limitations

- Provider availability and field completeness vary by market and county.
- Public-record sale data may lag recording/ingestion timelines.
- Live provider records are not formal appraisals, title reports, or professional real-estate advice.
- The initial provider is not a direct Heartland MLS feed.
- Browser-side comparables are analytical matches within the returned dataset, not an appraisal-grade CMA.

## Next Development Targets

- Add a licensed Heartland MLS / RESO Web API provider adapter when credentials are available.
- Add RentCast AVM/value and rent-estimate endpoints if desired.
- Add persistent Redis/Postgres caching if traffic outgrows the in-memory cache.
- Add request throttling and usage telemetry before opening the backend to broader public traffic.
- Add contract tests with recorded/sanitized provider fixtures.
