import type { Request, RequestHandler } from 'express';
import helmet from 'helmet';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { resolveDashboardUsername } from '../api/auth.js';

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

/** Per-principal bucket: session user, validated Basic user, API key, else IP. */
export function rateLimitKeyForRequest(req: Request): string {
  const principal = resolveDashboardUsername(req);
  if (principal) return `principal:${principal}`;
  const ip = typeof req.ip === 'string' && req.ip ? req.ip : req.socket?.remoteAddress || 'unknown';
  return `ip:${ipKeyGenerator(ip)}`;
}

function rateLimitExceededHandler(req: Request, res: import('express').Response): void {
  res.status(429).json({
    success: false,
    error: 'rate_limit_exceeded',
    message: 'Too many requests. Please retry shortly.',
    requestId: req.requestId,
  });
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

/** Tighter limit for owner-PII / search-heavy property + map routes. */
export function piiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: parsePositiveInt(process.env.PII_RATE_LIMIT_PER_MINUTE, 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: rateLimitKeyForRequest,
    handler: rateLimitExceededHandler,
  });
}

/** General API limit (covers /api/dashboard/* and the rest of /api). */
export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: parsePositiveInt(process.env.API_RATE_LIMIT_PER_MINUTE, 60),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: rateLimitKeyForRequest,
    handler: rateLimitExceededHandler,
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
