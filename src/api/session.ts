/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Signed httpOnly session cookies for the dashboard SPA.
 * Absolute TTL from SESSION_TTL_MS (default 30m). Idle warning window from
 * SESSION_IDLE_WARNING_MS (default min(60s, 10% of TTL)).
 */

import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'dashboard_session';

export type SessionPayload = {
  u: string;
  exp: number;
  iat: number;
};

/** In-memory denylist of revoked session tokens until their natural expiry. */
const revokedSessions = new Map<string, number>();

function pruneRevoked(now = Date.now()): void {
  for (const [token, exp] of revokedSessions) {
    if (exp <= now) revokedSessions.delete(token);
  }
}

export function revokeSessionToken(token: string, exp: number, now = Date.now()): void {
  pruneRevoked(now);
  if (exp > now) revokedSessions.set(token, exp);
}

export function isSessionTokenRevoked(token: string, now = Date.now()): boolean {
  pruneRevoked(now);
  const exp = revokedSessions.get(token);
  if (exp == null) return false;
  if (exp <= now) {
    revokedSessions.delete(token);
    return false;
  }
  return true;
}

/** Test helper */
export function clearRevokedSessionsForTests(): void {
  revokedSessions.clear();
}

export function getSessionTtlMs(): number {
  const raw = process.env.SESSION_TTL_MS ?? process.env.DASHBOARD_SESSION_TTL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30 * 60_000;
}

export function getIdleWarningMs(): number {
  const ttl = getSessionTtlMs();
  const raw = process.env.SESSION_IDLE_WARNING_MS;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), ttl);
  return Math.min(60_000, Math.max(5_000, Math.floor(ttl / 10)));
}

function sessionSecret(): Buffer {
  const explicit = process.env.SESSION_SECRET?.trim();
  const material =
    explicit ||
    [
      'dashboard-session',
      process.env.DASHBOARD_AUTH_USER || '',
      process.env.DASHBOARD_AUTH_PASSWORD || '',
      process.env.DASHBOARD_AUTH_USERS || '',
      process.env.API_KEY || '',
    ].join(':');
  return createHash('sha256').update(material).digest();
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function sign(payloadB64: string): string {
  return b64url(createHmac('sha256', sessionSecret()).update(payloadB64).digest());
}

function safeEqualStr(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(username: string, now = Date.now()): { token: string; expiresAt: number; iat: number } {
  const iat = now;
  const expiresAt = now + getSessionTtlMs();
  const payload: SessionPayload = { u: username, iat, exp: expiresAt };
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const token = `${payloadB64}.${sign(payloadB64)}`;
  return { token, expiresAt, iat };
}


/** Decode a signed token without expiry/revocation checks (logout / revoke). */
export function decodeSessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig || !safeEqualStr(sign(payloadB64), sig)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload || typeof payload.u !== 'string' || typeof payload.exp !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string, now = Date.now()): SessionPayload | null {
  if (!token || isSessionTokenRevoked(token, now)) return null;
  const payload = decodeSessionToken(token);
  if (!payload || payload.exp <= now) return null;
  return payload;
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function readSessionFromRequest(req: Pick<Request, 'headers'>, now = Date.now()): SessionPayload | null {
  const cookies = parseCookieHeader(req.headers.cookie);
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  return verifySessionToken(raw, now);
}

export function setSessionCookie(res: Response, token: string, expiresAt: number): void {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}

export function sessionPublicInfo(payload: SessionPayload | null, authRequired: boolean) {
  if (!payload) {
    return {
      authenticated: false,
      authRequired,
      ttlMs: getSessionTtlMs(),
      idleWarningMs: getIdleWarningMs(),
    };
  }
  return {
    authenticated: true,
    authRequired,
    username: payload.u,
    expiresAt: payload.exp,
    issuedAt: payload.iat,
    ttlMs: getSessionTtlMs(),
    idleWarningMs: getIdleWarningMs(),
  };
}
