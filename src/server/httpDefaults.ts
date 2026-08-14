import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';

declare global { namespace Express { interface Request { requestId?: string } } }

const REDACT_KEY = /owner|mailing|password|authorization|api[_-]?key|cookie|token|secret/i;

export function redactLogMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = REDACT_KEY.test(key) ? '[redacted]' : value;
  }
  return out;
}

export function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...redactLogMeta(meta) }));
}

export const accessLog: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    log('info', 'http', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
};

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false,
});

export function piiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: Math.max(1, Number(process.env.PII_RATE_LIMIT_PER_MINUTE || 30)),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ success: false, error: 'Too many requests. Please retry shortly.', requestId: req.requestId }),
  });
}

export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: Math.max(1, Number(process.env.API_RATE_LIMIT_PER_MINUTE || 60)),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, error: 'Too many requests. Please retry shortly.', requestId: req.requestId }),
  });
}

function isSameOrigin(req: { headers: { host?: string; origin?: string } }, origin: string): boolean {
  const host = req.headers.host;
  if (!host) return false;
  try {
    const url = new URL(origin);
    return url.host === host && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

export function corsAllowList(): RequestHandler {
  const defaults = [
    'https://jnibarger01.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ];
  const allowed = new Set([
    ...defaults,
    ...String(process.env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean),
  ]);
  return (req, res, next) => {
    const origin = req.headers.origin;
    const permitted = !origin || isSameOrigin(req, origin) || allowed.has(origin);
    if (origin && permitted) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return permitted ? res.sendStatus(204) : res.sendStatus(403);
    if (!permitted) {
      return res.status(403).json({ success: false, error: 'Origin not allowed.', requestId: req.requestId });
    }
    next();
  };
}
