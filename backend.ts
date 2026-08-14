import express from 'express';
import dotenv from 'dotenv';
import { executeRentCastTool, isRentCastConfigured, RentCastProviderError } from './src/server/rentcast';
import { LruCache } from './src/server/lruCache';
import { apiRateLimit, corsAllowList, log, requestId, securityHeaders } from './src/server/httpDefaults';
import { zillowMcpRequestSchema } from './src/server/validation';

dotenv.config();
const ttl = Math.max(60_000, Number(process.env.PROVIDER_CACHE_TTL_MS || 300_000));
const cache = new LruCache<unknown>(Math.max(10, Number(process.env.PROVIDER_CACHE_MAX_ENTRIES || 200)), ttl);

export function createBackendApp() {
  const app = express(); app.disable('x-powered-by'); app.use(requestId, securityHeaders, express.json({ limit: '1mb' }), corsAllowList());
  app.get('/healthz', (_req, res) => res.json({ status: 'ok', provider: 'rentcast', providerConfigured: isRentCastConfigured(), timestamp: new Date().toISOString() }));
  app.get('/api/provider/status', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ provider: 'rentcast', configured: isRentCastConfigured(), cacheTtlSeconds: Math.round(ttl / 1000), capabilities: { activeSaleListings: true, recentPublicRecordSales: true, zipMarketStatistics: true, pendingStatus: false, avm: true }, timestamp: new Date().toISOString() }); });
  app.post('/api/zillow/mcp', apiRateLimit(), async (req, res) => {
    const parsed = zillowMcpRequestSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid MCP request.', details: parsed.error.issues.map(issue => issue.message), requestId: req.requestId });
    if (!isRentCastConfigured()) return res.status(503).json({ success: false, provider: 'rentcast', source: 'mock_adapter', error: 'Live provider is not configured on the backend.', requestId: req.requestId, timestamp: new Date().toISOString() });
    const cacheKey = `${parsed.data.toolName}:${JSON.stringify(parsed.data.params)}`; const cached = cache.get(cacheKey);
    try { const data = cached ?? await executeRentCastTool(parsed.data.toolName, parsed.data.params); if (!cached) cache.set(cacheKey, data); res.setHeader('X-Provider-Cache', cached ? 'HIT' : 'MISS'); return res.json({ success: true, data, provider: 'rentcast', source: 'mcp_server', timestamp: new Date().toISOString(), requestId: req.requestId }); }
    catch (error) { const provider = error instanceof RentCastProviderError ? error : new RentCastProviderError('Live property provider request failed.'); log('error', 'provider_request_failed', { requestId: req.requestId, status: provider.statusCode }); return res.status(provider.statusCode).json({ success: false, provider: 'rentcast', source: 'mcp_server', error: provider.message, requestId: req.requestId, timestamp: new Date().toISOString() }); }
  });
  app.post('/api/market-insights', apiRateLimit(), (req, res) => { const summary = req.body?.marketSummary || {}; const region = String(req.body?.searchRegion || 'selected area').slice(0, 100); const total = Number(summary.totalProperties || 0); const median = Number(summary.medianListingPrice || 0); res.json({ isAiGenerated: false, executiveSummary: `${region}: ${total} provider-backed records are in the filtered result set${median ? ` with a median asking/sale price of $${median.toLocaleString()}` : ''}.`, verifiedFacts: [`${total} provider-backed records matched the current filters.`], calculatedMetrics: median ? [`Median price: $${median.toLocaleString()}.`] : [], aiInterpretations: [], missingDataNotes: ['This deterministic response is not an appraisal or forecast.', 'Pending-listing status requires a licensed MLS provider.'], predictions: [], generatedAt: new Date().toISOString() }); });
  return app;
}
const app = createBackendApp();
if (import.meta.url === `file://${process.argv[1]}`) { const port = Number(process.env.PORT || 3000); app.listen(port, '0.0.0.0', () => log('info', 'backend_started', { port })); }
export default app;
