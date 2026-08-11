# KC Real Estate Market Explorer

## Overview

KC Real Estate Market Explorer is a responsive React application for exploring a local Kansas City metro property fixture. It combines an interactive Leaflet map, filtering, property details, comparable-property scoring, and browser-side market analytics. The repository retains an optional Express backend for MCP property providers and server-side Gemini insights.

The public static demo is designed for GitHub Pages: <https://jnibarger01.github.io/real-estate/>.

## Screenshots / Demo

- Demo: <https://jnibarger01.github.io/real-estate/>
- The application includes a Kansas City skyline hero, interactive property map, property cards, comparable analysis, and analytics dashboards.

Screenshots can be added here after the first verified public deployment.

## Features

- Kansas City, MO and Overland Park, KS fixture-property search
- Price, status, property-type, bedroom, bathroom, size, and feature filters
- Leaflet maps with clustering, density overlays, boundaries, and multiple basemaps
- Property details, histories, schools, and local comparable-property scoring
- KPI summaries, distributions, modeled trend charts, and neighborhood comparisons
- CSV and JSON exports
- Keyboard-accessible map controls and responsive drawers/navigation
- Deterministic local market analysis for static hosting
- Optional Zillow MCP and Gemini integrations through the Express backend

## Architecture

```text
GitHub Pages                         Full-stack deployment
React/Vite frontend                  React/Vite frontend
  ├─ local fixture adapter             └─ Express HTTPS API
  ├─ browser-side filters                   ├─ Zillow MCP/provider proxy
  ├─ comparables and analytics              └─ Gemini market insights
  └─ Leaflet map
```

`src/config/runtime.ts` is the frontend deployment boundary. A Pages build runs in static mode and does not request local `/api/*` routes. A normal development/full-stack build preserves the existing Express endpoints. `VITE_API_BASE_URL` is optional and can point a future frontend deployment to a separately hosted HTTPS API; it never contains provider credentials.

## Tech Stack

- React 19 and TypeScript
- Vite 6 and Tailwind CSS 4
- Leaflet, D3, and Recharts
- Express
- Google GenAI SDK (server only)
- Bun lockfile and package runner

## Local Development

Requirements: Bun and a current Node.js-compatible runtime.

```bash
bun install --frozen-lockfile
bun run dev
```

The Express server hosts Vite middleware in development at `http://localhost:3000`.

Validation and builds:

```bash
bun run lint
bun run build
bun run build:pages
```

Copy `.env.example` to `.env` only for optional server-side integrations. Never commit `.env` files.

## GitHub Pages Deployment

`.github/workflows/deploy-pages.yml` runs on pushes to `main` and manual dispatch. It installs from `bun.lock`, typechecks, builds the frontend with `/real-estate/` as its Vite base, scans the compiled output for sensitive server-variable markers, uploads `dist`, and deploys using the official GitHub Pages Actions flow.

The workflow does not commit `dist` to `main`. In repository settings, configure Pages to use **GitHub Actions** as its source.

## Static Demo vs Live Backend

Static GitHub Pages mode provides:

- local fixture property data;
- browser-side search and filters;
- browser-side analytics and comparables;
- interactive mapping using public HTTPS tile services; and
- deterministic “Local Market Analysis” labeled separately from AI output.

Full-stack mode can additionally provide:

- Zillow MCP or another external property provider;
- server-side API proxying;
- Gemini-generated market insights; and
- secure server-side credential handling.

GitHub Pages cannot execute `server.ts`, Express routes, MCP proxy calls, or Gemini requests. Those capabilities require a separately hosted backend.

## Zillow MCP Integration

The frontend uses `ZillowMcpClient`, which keeps the existing local adapter and can call `/api/zillow/mcp` in full-stack mode. The server reads `ZILLOW_MCP_SERVER_URL` and proxies MCP requests when configured. If no MCP server is configured, the full-stack app also falls back to the local adapter.

The Pages build never embeds MCP credentials and does not probe an unavailable Pages API route.

## Gemini Integration

`GEMINI_API_KEY` is read only by `server.ts`. In full-stack mode, `/api/market-insights` can produce Gemini analysis. If Gemini or the backend is unavailable, the frontend presents deterministic local analysis and does not label it as AI-generated.

Do not place Gemini keys in `VITE_*` variables: Vite variables are compiled into browser JavaScript.

## Data Sources

The repository includes local mock/fixture records attributed in the individual data objects. These records power the public demo and are not a live MLS or Zillow feed. Map tiles are requested from configured public Carto, OpenStreetMap, or Esri endpoints with visible attribution.

## Data Limitations

- Fixture records may be stale, synthetic, incomplete, or unsuitable for decisions.
- The fixture currently supports Kansas City, MO and Overland Park, KS. Unsupported metro cities are not fabricated.
- Modeled trend charts are exploratory illustrations, not verified historical series.
- Values are not appraisals, offers, or professional real-estate advice.
- Public tile availability depends on third-party services and their usage policies.

## Privacy / Secrets

- No secret is required for GitHub Pages mode.
- Never put `GEMINI_API_KEY`, Zillow/MCP credentials, cookies, or private provider URLs in frontend code or `VITE_*` variables.
- Keep credentials in the separately hosted backend environment.
- `.env*` files are ignored except for the placeholder `.env.example`.

## Future Development

- Host the Express API on an HTTPS application platform and configure an optional API base URL.
- Add contract tests for provider adapters and local analysis.
- Add verified data providers with provenance/freshness metadata.
- Add automated browser regression and accessibility testing.
- Add screenshots after public deployment verification.
