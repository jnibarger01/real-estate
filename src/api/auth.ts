/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { readSessionFromRequest } from './session.js';

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function parseDashboardUsers(raw = process.env.DASHBOARD_AUTH_USERS): Array<{ user: string; password: string }> {
  const pairs: Array<{ user: string; password: string }> = [];
  const singleUser = process.env.DASHBOARD_AUTH_USER?.trim();
  const singlePassword = process.env.DASHBOARD_AUTH_PASSWORD?.trim();
  if (singleUser && singlePassword) pairs.push({ user: singleUser, password: singlePassword });
  for (const entry of String(raw || '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) continue;
    const user = trimmed.slice(0, separator).trim();
    const password = trimmed.slice(separator + 1);
    if (user && password) pairs.push({ user, password });
  }
  return pairs;
}

export function dashboardAuthConfigured(): boolean {
  const apiKey = process.env.API_KEY?.trim();
  return parseDashboardUsers().length > 0 || Boolean(apiKey);
}

export function shouldEnforceDashboardAuth(explicit?: boolean): boolean {
  if (explicit != null) return explicit;
  return process.env.NODE_ENV === 'production';
}

export function assertDashboardAuthConfigured(): void {
  if (dashboardAuthConfigured()) return;
  throw new Error(
    'Dashboard auth is required: set DASHBOARD_AUTH_USERS, or DASHBOARD_AUTH_USER+DASHBOARD_AUTH_PASSWORD, or API_KEY. Production will not start fail-open over owner PII.',
  );
}

function matchesBasicUser(username: string, password: string): boolean {
  let matched = false;
  for (const pair of parseDashboardUsers()) {
    const userOk = constantTimeEqual(username, pair.user);
    const passOk = constantTimeEqual(password, pair.password);
    if (userOk && passOk) matched = true;
  }
  return matched;
}

/** Validate dashboard login credentials (Basic users and/or API_KEY). */
export function validateDashboardCredentials(username: string, password: string, apiKey?: string): boolean {
  if (username && password && matchesBasicUser(username, password)) return true;
  const configured = process.env.API_KEY?.trim();
  if (apiKey && configured && constantTimeEqual(apiKey, configured)) return true;
  return false;
}

export function createProtectMiddleware(options: { enforceAuth?: boolean } = {}): RequestHandler {
  const enforceAuth = shouldEnforceDashboardAuth(options.enforceAuth);
  if (enforceAuth) assertDashboardAuthConfigured();

  return (req, res, next) => {
    const users = parseDashboardUsers();
    const apiKey = process.env.API_KEY?.trim();

    if (users.length === 0 && !apiKey) {
      if (enforceAuth) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      return next();
    }

    if (apiKey) {
      const provided = req.get('x-api-key') || '';
      if (provided && constantTimeEqual(provided, apiKey)) return next();
    }

    const session = readSessionFromRequest(req);
    if (session) return next();

    if (users.length > 0) {
      const authorization = req.get('authorization');
      if (authorization?.startsWith('Basic ')) {
        const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
        const separator = decoded.indexOf(':');
        if (separator >= 0) {
          const username = decoded.slice(0, separator);
          const password = decoded.slice(separator + 1);
          if (matchesBasicUser(username, password)) return next();
        }
      }
      // Prefer session/login UX for browsers; still advertise Basic for API clients.
      res.set('WWW-Authenticate', 'Basic realm="Jackson County Property Intelligence"');
    }

    return res.status(401).json({ error: 'unauthorized' });
  };
}

export function isUnauthenticatedPublicPath(path: string): boolean {
  return (
    path === '/health' ||
    path === '/healthz' ||
    path === '/api/health' ||
    path === '/api/provider/status' ||
    path === '/api/auth/login' ||
    path === '/api/auth/logout' ||
    path === '/api/auth/session' ||
    path === '/api/auth/touch'
  );
}

export function isPublicApiPath(path: string): boolean {
  return (
    path === '/health' ||
    path === '/provider/status' ||
    path === '/auth/login' ||
    path === '/auth/logout' ||
    path === '/auth/session' ||
    path === '/auth/touch'
  );
}

export function mcpEnabled(): boolean {
  const raw = process.env.ENABLE_MCP?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  return process.env.NODE_ENV !== 'production';
}
