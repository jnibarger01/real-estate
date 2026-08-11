import express from 'express';
import dotenv from 'dotenv';
import { executeRentCastTool, isRentCastConfigured, RentCastProviderError } from './src/server/rentcast';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

const defaultOrigins = [
  'https://jnibarger01.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
];
const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }

  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }

  next();
});

app.get('/healthz', (_req, res) => {
  res.json({
    status: 'ok',
    provider: 'rentcast',
    providerConfigured: isRentCastConfigured(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/provider/status', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    provider: 'rentcast',
    configured: isRentCastConfigured(),
    capabilities: {
      activeSaleListings: true,
      recentPublicRecordSales: true,
      zipMarketStatistics: true,
      pendingStatus: false,
      avm: false,
    },
    timestamp: new Date().toISOString(),
  });
});

// Compatibility endpoint used by the existing GitHub Pages client.
// Despite the legacy path name, this can now dispatch to a real provider.
app.post('/api/zillow/mcp', async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=60');

  if (!isRentCastConfigured()) {
    return res.status(503).json({
      success: false,
      provider: 'rentcast',
      source: 'mock_adapter',
      error: 'Live provider is not configured on the backend.',
      timestamp: new Date().toISOString(),
    });
  }

  const { toolName, params } = req.body || {};
  if (!toolName || typeof toolName !== 'string') {
    return res.status(400).json({ success: false, error: 'toolName is required.' });
  }

  try {
    const data = await executeRentCastTool(toolName, params || {});
    return res.json({
      success: true,
      data,
      provider: 'rentcast',
      source: 'mcp_server',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const providerError = error instanceof RentCastProviderError ? error : null;
    const status = providerError?.statusCode || 502;
    console.error('[Live provider request failed]', error);
    return res.status(status).json({
      success: false,
      provider: 'rentcast',
      source: 'mcp_server',
      error: providerError?.message || 'Live property provider request failed.',
      timestamp: new Date().toISOString(),
    });
  }
});

// Keep the existing insights surface usable when Pages points at this backend.
// This endpoint is deterministic unless a separate AI implementation is added later.
app.post('/api/market-insights', (req, res) => {
  const { marketSummary = {}, searchRegion = 'selected area' } = req.body || {};
  const total = Number(marketSummary.totalProperties || 0);
  const median = Number(marketSummary.medianListingPrice || 0);
  const ppsf = Number(marketSummary.medianPricePerSqFt || 0);
  const dom = Number(marketSummary.avgDaysOnMarket || 0);

  res.json({
    isAiGenerated: false,
    executiveSummary: `${searchRegion}: ${total} live/provider-backed records are currently in the filtered result set${median ? ` with a median asking/sale price of $${median.toLocaleString()}` : ''}.`,
    verifiedFacts: [
      `${total} provider-backed records matched the current filters.`,
      ...(median ? [`Median price in the current result set is $${median.toLocaleString()}.`] : []),
    ],
    calculatedMetrics: [
      ...(ppsf ? [`Median price per square foot in the current result set is $${ppsf.toLocaleString()}.`] : []),
      ...(dom ? [`Average days on market for active records in the current result set is ${dom} days.`] : []),
    ],
    aiInterpretations: [],
    missingDataNotes: [
      'This backend response is deterministic and is not an appraisal or forecast.',
      'Pending-listing status is not available from the initial RentCast adapter.',
    ],
    predictions: [],
    generatedAt: new Date().toISOString(),
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`KC Real Estate live data API listening on 0.0.0.0:${PORT}`);
});
