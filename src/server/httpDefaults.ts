import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';

declare global { namespace Express { interface Request { requestId?: string } } }

export function log(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  console[level](JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...meta }));
}

export const requestId: RequestHandler = (req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export const securityHeaders = helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } });

export function apiRateLimit(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: Math.max(1, Number(process.env.API_RATE_LIMIT_PER_MINUTE || 60)),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ success: false, error: 'Too many requests. Please retry shortly.', requestId: req.requestId }),
  });
}

export function corsAllowList(): RequestHandler {
  const defaults = ['https://jnibarger01.github.io', 'http://localhost:5173', 'http://localhost:3000'];
  const allowed = new Set([...defaults, ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean)]);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }
    if (req.method === 'OPTIONS') return origin && !allowed.has(origin) ? res.sendStatus(403) : res.sendStatus(204);
    if (origin && !allowed.has(origin)) return res.status(403).json({ success: false, error: 'Origin not allowed.', requestId: req.requestId });
    next();
  };
}
