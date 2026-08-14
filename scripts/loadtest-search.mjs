#!/usr/bin/env node
/**
 * Concurrent search/map probe against a running same-origin API.
 * Usage: BASE_URL=http://127.0.0.1:3000 AUTH_USER=u AUTH_PASSWORD=p node scripts/loadtest-search.mjs
 */
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const user = process.env.AUTH_USER || '';
const password = process.env.AUTH_PASSWORD || '';
const rounds = Number(process.env.LOADTEST_ROUNDS || 20);
const headers = {};
if (user && password) {
  headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

const paths = [
  '/api/dashboard/summary',
  '/api/properties/search?limit=25&q=MAIN',
  '/api/map/properties?bbox=-94.60,39.08,-94.58,39.10&zoom=14',
];

async function hit(path) {
  const started = Date.now();
  const response = await fetch(`${base}${path}`, { headers });
  return { path, status: response.status, ms: Date.now() - started };
}

const results = [];
for (let i = 0; i < rounds; i += 1) {
  const batch = await Promise.all(paths.map(hit));
  results.push(...batch);
}

const byPath = Object.groupBy(results, (row) => row.path);
for (const [path, rows] of Object.entries(byPath)) {
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  const p95 = times[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
  const errors = rows.filter((r) => r.status >= 400).length;
  console.log(JSON.stringify({ path, n: rows.length, p95_ms: p95, errors }));
  if (p95 > 1500) {
    console.error(`FAIL p95 ${p95}ms on ${path}`);
    process.exitCode = 1;
  }
}
