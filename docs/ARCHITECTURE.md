# Jackson County Property Intelligence — Architecture

Canonical product: Jackson County assessor dashboard.

Authenticated PII surface (canonical):

```text
browser
        │
        ▼
same-origin SPA + API
(`bun run start` / production server.ts)
        │
        ▼
createApp()
   ├── /api/dashboard/*
   ├── /api/properties/*
   ├── /api/map/*
   ├── /api/health
   ├── /mcp
   └── /api/provider/*   ← RentCast, if retained
        │
        ▼
Postgres/PostGIS
api.dashboard_*
```

## Authoritative contract

| Layer | Source of truth |
|---|---|
| Browser entry | `src/main.tsx` → `DashboardApp` |
| HTTP app | `src/api/app.ts` `createApp()` |
| Local process | `server.ts` (same app + Vite) |
| Production process | `backend.ts` (same app, no Vite) |
| SQL | `sql/api_dashboard_views.sql` → `api.dashboard_*` |
| Data | `jacen_dev` / `DATABASE_URL` PostGIS |

`App.tsx` (RentCast explorer) is not mounted. Do not document it as production.

## Auth and PII

Owner name and mailing address are returned by `/api/properties/search` and `/api/properties/:id`.

- `NODE_ENV=production` refuses to start without `DASHBOARD_AUTH_USER`+`DASHBOARD_AUTH_PASSWORD` or `API_KEY`.
- The same `createProtectMiddleware` covers `/api/*` (except health, `/api/provider/status`, and `/api/auth/*`) and `/mcp`.
- SPA document is public; browsers authenticate via `POST /api/auth/login` (httpOnly `dashboard_session` cookie, TTL from `SESSION_TTL_MS`) or HTTP Basic / `X-Api-Key` for API clients. Logout clears the cookie and SPA query cache.
- Database grants revoke `PUBLIC` on schema `api`. PII views are granted only to role `dashboard_app`.

Local/test processes without auth remain usable. Networked deploys must not.

## Fail-closed providers

- `POST /mcp` and `POST /api/mcp` `tools/call` return a JSON-RPC error. They never return fixture rows as `success`.
- `POST /api/zillow/mcp` returns 503/502 when the provider is missing or fails.
- `ZillowMcpClient` propagates abort, HTTP, and network errors as `success: false`. Fixtures require an explicit `VITE_ALLOW_FIXTURE_ADAPTER=true` **dev** flag.

## Database boundary

```
raw → core → mart.residential_properties → api.dashboard_*
```

Application handlers SELECT only `api.*`. `dashboard.*` and `mart.dashboard_*` scripts in this repo are deprecated and must not be applied.

Exceptions documented in `docs/DB_CONTRACT.md`: value trends and transfer recording numbers still join `raw.assessments` JSON until those keys are promoted into mart.

## CORS

Allowlist env is `ALLOWED_ORIGINS`. Defaults include `https://jnibarger01.github.io` and local Vite/API origins. Same-origin requests (module scripts send `Origin`) are always permitted so a production SPA on an arbitrary host/port can load `/assets/*`. CORS is not access control; dashboard auth is.

## Deployment

The owner-PII product is same-origin: `bun run build && bun run start` (or Render serving `server.ts` / the SPA from the API host) with `DASHBOARD_AUTH_*`. The document is public; `/api` requires a session cookie, HTTP Basic, or `X-Api-Key`.

GitHub Pages is a public static shell. `runtimeConfig.ownerPiiEnabled` is false on Pages builds, `VITE_API_KEY` is stripped, and the workflow must not inject a credential. Do not treat `github.io` as an authenticated records app.

### Pages vs authenticated product — env checklist

| Surface | Allowed in Pages build | Forbidden in Pages build / bundle |
|---|---|---|
| Vite public config | `VITE_API_BASE_URL` (public API origin only) | Any secret-named `VITE_*` (see below) |
| Dashboard auth | — (server-only on same-origin deploy) | `DASHBOARD_AUTH_USER`, `DASHBOARD_AUTH_PASSWORD`, `DASHBOARD_AUTH_USERS` |
| API / session | — | `API_KEY`, `SESSION_SECRET`, `VITE_API_KEY` |
| Providers | — | `RENTCAST_API_KEY`, `GEMINI_API_KEY`, `VITE_RENTCAST_*`, `VITE_GEMINI_*` |
| Fixtures | — | `VITE_ALLOW_FIXTURE_ADAPTER` (dev-only; never Pages) |

**Forbidden Vite name families for Pages:** `VITE_API_KEY`, `VITE_*PASSWORD*`, `VITE_*SECRET*`, `VITE_*TOKEN*`, `VITE_*_KEY`, `VITE_DASHBOARD_*`, `VITE_SESSION_*`, `VITE_RENTCAST_*`, `VITE_GEMINI_*`, `VITE_BRIDGE_*`, `VITE_RESO_*`, `VITE_ALLOW_FIXTURE_ADAPTER`. The only Pages-allowed Vite env is `VITE_API_BASE_URL`.

CI enforces the split with `scripts/check-pages-auth-split.sh`: workflow/source policy, a Pages build poisoned with canary secret-named Vite env, and a `dist/` scan that fails if those canaries or dashboard/API secret identifiers appear. Accidentally adding a secret-named Vite env to the Pages workflow or embedding it in the bundle fails CI.

Render (`render.yaml`) still deploys `backend.ts` for API-only hosting. Point a same-origin frontend at that host, or serve the built SPA from `server.ts`.

## Map viewport

`GET /api/map/properties` requires a bbox (≤1° per axis) and optionally `zoom` / `limit`. Hard cap: **5000** features (`MAP_MAX_FEATURES`). Low zoom returns centroids; mid zoom simplifies polygons in PostGIS; high zoom returns full geometries. The dashboard MapLibre client viewport-loads on pan/zoom and clusters centroid points client-side. Source of truth remains `api.dashboard_map_properties`.

## Saved searches

Operators bookmark dashboard filter query params (`label` + sanitized `query_params`) in `api.saved_searches` via authenticated `/api/dashboard/saved-searches`. Explicit `owner` keys are rejected/stripped. The GitHub Pages shell must not persist owner names or saved-search rows in static assets or `localStorage`; `SavedSearches` is disabled when `runtimeConfig.isPagesBuild` is true.

## CSV export

Authenticated operators can download the current dashboard search as CSV via `GET /api/properties/export.csv`. Filters match `/api/properties/search`. Default columns exclude owner PII. `include_pii` + `confirm_pii` plus a live `dashboard_app` role check are required for owner columns. Row cap: **10_000** (`CSV_EXPORT_MAX_ROWS`); responses stream when large.
